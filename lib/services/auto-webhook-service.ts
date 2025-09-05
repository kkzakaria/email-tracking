import { webhookService } from '@/lib/microsoft/webhook-service'
import { createClient } from '@supabase/supabase-js'
import { createGraphClient } from '@/lib/microsoft/graph-helper'

export interface AutoWebhookResult {
  success: boolean
  action: 'created' | 'renewed' | 'exists' | 'skipped'
  subscriptionId?: string
  expirationDateTime?: string
  error?: string
  reason?: string
}

/**
 * Service pour la gestion automatique des subscriptions webhook
 * Assure qu'un utilisateur a toujours une subscription active sans intervention manuelle
 */
export class AutoWebhookService {
  private supabase: ReturnType<typeof createClient>
  private static failureCache = new Map<string, number>() // userId -> timestamp of last failure
  private static readonly COOLDOWN_PERIOD = 5 * 60 * 1000 // 5 minutes en millisecondes
  private static readonly MAX_FAILURES_BEFORE_COOLDOWN = 3

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Vérifier si l'utilisateur est en période de cooldown après des échecs répétés
   */
  private static isInCooldown(userId: string): boolean {
    const lastFailure = AutoWebhookService.failureCache.get(userId)
    if (!lastFailure) return false

    const timeSinceFailure = Date.now() - lastFailure
    if (timeSinceFailure > AutoWebhookService.COOLDOWN_PERIOD) {
      // Nettoyer le cache si le cooldown est expiré
      AutoWebhookService.failureCache.delete(userId)
      return false
    }

    return true
  }

  /**
   * Enregistrer un échec pour déclencher le cooldown
   */
  private static recordFailure(userId: string): void {
    AutoWebhookService.failureCache.set(userId, Date.now())
  }

  /**
   * Nettoyer le cache d'échec après un succès
   */
  private static clearFailure(userId: string): void {
    AutoWebhookService.failureCache.delete(userId)
  }

  /**
   * Point d'entrée principal : Assure qu'une subscription webhook existe et est active
   * @param userId - ID utilisateur Supabase
   * @returns Résultat de l'opération
   */
  async ensureWebhookSubscription(userId: string): Promise<AutoWebhookResult> {
    try {
      // Vérifier si on est en période de cooldown
      if (AutoWebhookService.isInCooldown(userId)) {
        console.log('🔔 Auto-webhook: Utilisateur en cooldown, skip pour:', userId)
        return {
          success: false,
          action: 'skipped',
          reason: 'Cooldown actif après échecs répétés'
        }
      }

      console.log('🔔 Auto-webhook: Vérification pour utilisateur:', userId)

      // 1. Vérifier les prérequis
      const prerequisiteCheck = await this.checkPrerequisites(userId)
      if (!prerequisiteCheck.success) {
        // Enregistrer l'échec pour éviter les retry répétés
        AutoWebhookService.recordFailure(userId)
        console.log('🔔 Auto-webhook: Échec prérequis, cooldown activé pour:', userId)
        return prerequisiteCheck
      }

      // 2. Vérifier l'état actuel des subscriptions
      const existingSubscription = await this.getActiveSubscription(userId)

      if (existingSubscription) {
        // Vérifier si elle expire bientôt
        const expirationTime = new Date(existingSubscription.expiration_datetime).getTime()
        const hoursUntilExpiration = (expirationTime - Date.now()) / (1000 * 60 * 60)

        if (hoursUntilExpiration > 6) {
          // Subscription active et pas d'expiration imminente
          console.log('✅ Auto-webhook: Subscription active trouvée')
          return {
            success: true,
            action: 'exists',
            subscriptionId: existingSubscription.subscription_id,
            expirationDateTime: existingSubscription.expiration_datetime,
            reason: `Subscription active, expire dans ${Math.round(hoursUntilExpiration)}h`
          }
        } else {
          // Renouveler la subscription existante
          console.log('🔄 Auto-webhook: Renouvellement nécessaire')
          return await this.renewSubscription(existingSubscription.subscription_id)
        }
      }

      // 3. Aucune subscription active, en créer une nouvelle
      console.log('🆕 Auto-webhook: Création d\'une nouvelle subscription')
      const result = await this.createNewSubscription(userId)
      
      // Si succès, nettoyer le cache d'échec
      if (result.success) {
        AutoWebhookService.clearFailure(userId)
      } else {
        // Si échec, enregistrer pour activer le cooldown
        AutoWebhookService.recordFailure(userId)
      }
      
      return result

    } catch (error) {
      console.error('❌ Auto-webhook: Erreur générale:', error)
      // Enregistrer l'échec pour éviter les retry immédiats
      AutoWebhookService.recordFailure(userId)
      
      return {
        success: false,
        action: 'skipped',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  /**
   * Vérifier tous les prérequis avant de créer/renouveler une subscription
   */
  private async checkPrerequisites(userId: string): Promise<AutoWebhookResult> {
    // 1. Vérifier la configuration webhook
    const webhookEnabled = process.env.WEBHOOK_ENABLED === 'true'
    if (!webhookEnabled) {
      return {
        success: false,
        action: 'skipped',
        reason: 'WEBHOOK_ENABLED n\'est pas activé'
      }
    }

    const webhookEndpointUrl = process.env.WEBHOOK_ENDPOINT_URL
    const webhookClientState = process.env.WEBHOOK_CLIENT_STATE
    
    if (!webhookEndpointUrl || !webhookClientState) {
      return {
        success: false,
        action: 'skipped',
        reason: 'Configuration webhook incomplète (WEBHOOK_ENDPOINT_URL ou WEBHOOK_CLIENT_STATE manquant)'
      }
    }

    // 2. Vérifier Microsoft Graph
    try {
      const graphClient = await createGraphClient()
      if (!graphClient) {
        return {
          success: false,
          action: 'skipped',
          reason: 'Client Microsoft Graph non disponible'
        }
      }
    } catch (error) {
      return {
        success: false,
        action: 'skipped',
        reason: 'Impossible de se connecter à Microsoft Graph'
      }
    }

    // 3. Vérifier la base de données et les tables webhook
    try {
      // Vérifier d'abord si les tables existent
      const { data: tables, error: tablesError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['webhook_subscriptions', 'webhook_events'])

      if (tablesError || !tables || tables.length < 2) {
        return {
          success: false,
          action: 'skipped',
          reason: 'Tables webhook non disponibles - migration requise'
        }
      }

      // Ensuite tester la connectivité
      const { error: connectError } = await this.supabase
        .from('webhook_subscriptions')
        .select('id')
        .limit(1)

      if (connectError) {
        return {
          success: false,
          action: 'skipped',
          reason: 'Erreur de connexion à la base de données webhook'
        }
      }
    } catch (error) {
      return {
        success: false,
        action: 'skipped',
        reason: 'Base de données non accessible - vérifier la configuration'
      }
    }

    return { success: true, action: 'skipped' } // Placeholder, pas utilisé
  }

  /**
   * Récupérer la subscription active de l'utilisateur
   */
  private async getActiveSubscription(userId: string): Promise<{
    id: string
    subscription_id: string
    user_id: string
    expiration_datetime: string
    status: string
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Erreur lors de la récupération de la subscription:', error)
        return null
      }

      return data || null
    } catch (error) {
      console.error('❌ Erreur lors de la recherche de subscription:', error)
      return null
    }
  }

  /**
   * Créer une nouvelle subscription webhook
   */
  private async createNewSubscription(userId: string): Promise<AutoWebhookResult> {
    try {
      const result = await webhookService.createSubscription({
        userId,
        resourceType: 'messages',
        changeTypes: ['created', 'updated'],
        expirationHours: 71 // Maximum Microsoft Graph (~3 jours)
      })

      if (result.success) {
        console.log('✅ Auto-webhook: Subscription créée avec succès')
        
        // Logger l'action automatique
        await this.logAutoAction(userId, 'subscription_created', {
          subscriptionId: result.subscriptionId,
          automated: true,
          trigger: 'ensure_webhook_subscription'
        })

        return {
          success: true,
          action: 'created',
          subscriptionId: result.subscriptionId,
          expirationDateTime: result.expirationDateTime
        }
      } else {
        return {
          success: false,
          action: 'skipped',
          error: result.error
        }
      }
    } catch (error) {
      console.error('❌ Auto-webhook: Erreur lors de la création:', error)
      return {
        success: false,
        action: 'skipped',
        error: error instanceof Error ? error.message : 'Erreur de création'
      }
    }
  }

  /**
   * Renouveler une subscription existante
   */
  private async renewSubscription(subscriptionId: string): Promise<AutoWebhookResult> {
    try {
      const result = await webhookService.renewSubscription(subscriptionId)

      if (result.success) {
        console.log('✅ Auto-webhook: Subscription renouvelée avec succès')
        
        return {
          success: true,
          action: 'renewed',
          subscriptionId,
          expirationDateTime: result.newExpirationDateTime
        }
      } else {
        // Si le renouvellement échoue, essayer de créer une nouvelle subscription
        console.log('⚠️ Auto-webhook: Échec du renouvellement, tentative de création')
        
        // D'abord, obtenir l'user_id depuis la subscription
        const { data: subscription } = await this.supabase
          .from('webhook_subscriptions')
          .select('user_id')
          .eq('subscription_id', subscriptionId)
          .single()

        if (subscription && 'user_id' in subscription && subscription.user_id) {
          return await this.createNewSubscription(subscription.user_id as string)
        }

        return {
          success: false,
          action: 'skipped',
          error: result.error
        }
      }
    } catch (error) {
      console.error('❌ Auto-webhook: Erreur lors du renouvellement:', error)
      return {
        success: false,
        action: 'skipped',
        error: error instanceof Error ? error.message : 'Erreur de renouvellement'
      }
    }
  }

  /**
   * Logger les actions automatiques pour monitoring
   */
  private async logAutoAction(userId: string, action: string, details: Record<string, unknown>): Promise<void> {
    try {
      // Vérifier si la table existe avant de tenter le logging
      const { error: checkError } = await this.supabase
        .from('webhook_processing_log')
        .select('id')
        .limit(1)
      
      if (checkError) {
        // Table n'existe pas ou pas accessible, skip le logging
        return
      }

      const logData = {
        event_id: crypto.randomUUID(),
        action: `auto_${action}`,
        details: {
          user_id: userId,
          ...details,
          timestamp: new Date().toISOString()
        },
        success: true
      }
      
      await this.supabase
        .from('webhook_processing_log')
        .insert(logData as any)
    } catch (error) {
      // Ne pas faire échouer l'opération principale pour un problème de logging
      // et ne pas logger l'erreur pour éviter le spam console
    }
  }

  /**
   * Vérifier si l'utilisateur a besoin d'une intervention automatique
   */
  async needsAutomaticIntervention(userId: string): Promise<{
    needed: boolean
    reason?: string
    action?: 'create' | 'renew'
  }> {
    try {
      // Vérifier les prérequis
      const prerequisiteCheck = await this.checkPrerequisites(userId)
      if (!prerequisiteCheck.success) {
        return { needed: false, reason: prerequisiteCheck.reason }
      }

      const subscription = await this.getActiveSubscription(userId)
      
      if (!subscription) {
        return {
          needed: true,
          reason: 'Aucune subscription active',
          action: 'create'
        }
      }

      // Vérifier l'expiration
      const expirationTime = new Date(subscription.expiration_datetime).getTime()
      const hoursUntilExpiration = (expirationTime - Date.now()) / (1000 * 60 * 60)

      if (hoursUntilExpiration <= 6) {
        return {
          needed: true,
          reason: `Subscription expire dans ${Math.round(hoursUntilExpiration)}h`,
          action: 'renew'
        }
      }

      return { needed: false, reason: 'Subscription active et valide' }

    } catch (error) {
      return { 
        needed: false, 
        reason: `Erreur lors de la vérification: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      }
    }
  }

  /**
   * Obtenir des statistiques sur les actions automatiques
   */
  async getAutomaticActionStats(userId?: string): Promise<{
    totalActions: number
    createdCount: number
    renewedCount: number
    failedCount: number
    lastAction?: string
  }> {
    try {
      // Vérifier si la table existe avant de tenter la requête
      const { error: checkError } = await this.supabase
        .from('webhook_processing_log')
        .select('id')
        .limit(1)
      
      if (checkError) {
        // Table n'existe pas, retourner stats vides
        return {
          totalActions: 0,
          createdCount: 0,
          renewedCount: 0,
          failedCount: 0
        }
      }

      let query = this.supabase
        .from('webhook_processing_log')
        .select('action, success, created_at')
        .like('action', 'auto_%')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('details->>user_id', userId)
      }

      const { data: actions } = await query.limit(100)

      if (!actions || actions.length === 0) {
        return {
          totalActions: 0,
          createdCount: 0,
          renewedCount: 0,
          failedCount: 0
        }
      }

      const stats = actions.reduce((acc, action: any) => {
        acc.totalActions++
        if (!action.success) acc.failedCount++
        if (action.action && action.action.includes('created')) acc.createdCount++
        if (action.action && action.action.includes('renewed')) acc.renewedCount++
        return acc
      }, {
        totalActions: 0,
        createdCount: 0,
        renewedCount: 0,
        failedCount: 0
      })

      return {
        ...stats,
        lastAction: actions.length > 0 && actions[0] && 'created_at' in actions[0] 
          ? (actions[0] as any).created_at 
          : undefined
      }

    } catch (error) {
      // Ne pas logger l'erreur pour éviter le spam console
      return {
        totalActions: 0,
        createdCount: 0,
        renewedCount: 0,
        failedCount: 0
      }
    }
  }
}