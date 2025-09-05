import { createGraphClient } from './graph-helper'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Types for webhook subscriptions
export interface WebhookSubscription {
  id?: string
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  latestSupportedTlsVersion?: string
}

export interface WebhookNotification {
  value: Array<{
    subscriptionId: string
    subscriptionExpirationDateTime: string
    changeType: string
    resource: string
    resourceData?: {
      id: string
      '@odata.type': string
      '@odata.etag': string
      [key: string]: any
    }
    clientState: string
    tenantId: string
  }>
  validationTokens?: string[]
}

export interface SubscriptionOptions {
  userId: string
  resourceType: 'messages' | 'mailFolders' | 'events'
  changeTypes: ('created' | 'updated' | 'deleted')[]
  expirationHours?: number
}

/**
 * Service pour gérer les webhooks Microsoft Graph
 */
export class WebhookService {
  private supabase: any
  private notificationUrl: string
  private clientState: string

  constructor() {
    // Initialiser Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Configuration webhook
    this.notificationUrl = process.env.WEBHOOK_ENDPOINT_URL || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`
    
    // Générer un client state sécurisé ou utiliser celui configuré
    this.clientState = process.env.WEBHOOK_CLIENT_STATE || 
      randomBytes(32).toString('base64')
  }

  /**
   * Créer une nouvelle subscription webhook
   */
  async createSubscription(options: SubscriptionOptions): Promise<{
    success: boolean
    subscriptionId?: string
    expirationDateTime?: string
    error?: string
  }> {
    try {
      console.log('🔔 Création d\'une subscription webhook...')
      
      const graphClient = await createGraphClient()
      if (!graphClient) {
        throw new Error('Client Microsoft Graph non disponible')
      }

      // Définir la ressource à surveiller
      const resource = this.getResourcePath(options.resourceType)
      
      // Calculer la date d'expiration (max 3 jours pour les messages)
      const expirationHours = Math.min(options.expirationHours || 71, 71) // Max ~3 jours
      const expirationDateTime = new Date()
      expirationDateTime.setHours(expirationDateTime.getHours() + expirationHours)

      // Créer la subscription
      const subscription: WebhookSubscription = {
        changeType: options.changeTypes.join(','),
        notificationUrl: this.notificationUrl,
        resource: resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: this.clientState,
        latestSupportedTlsVersion: 'v1_2'
      }

      console.log('📤 Envoi de la requête de subscription:', {
        resource: subscription.resource,
        changeType: subscription.changeType,
        notificationUrl: subscription.notificationUrl
      })

      const response = await graphClient
        .api('/subscriptions')
        .post(subscription)

      console.log('✅ Subscription créée:', response)

      // Sauvegarder dans la base de données
      const { error: dbError } = await this.supabase
        .from('webhook_subscriptions')
        .insert({
          subscription_id: response.id,
          user_id: options.userId,
          resource: resource,
          change_types: options.changeTypes,
          notification_url: this.notificationUrl,
          expiration_datetime: response.expirationDateTime,
          client_state: this.clientState,
          status: 'active'
        })

      if (dbError) {
        console.error('❌ ERREUR CRITIQUE - Sauvegarde DB échouée:', dbError)
        console.error('   → Code:', dbError.code)
        console.error('   → Message:', dbError.message)
        console.error('   → Détails:', dbError.details)
        
        // CRITIQUE: Si on ne peut pas sauvegarder en DB, on doit supprimer la subscription Microsoft
        try {
          const graphClient = await createGraphClient()
          if (graphClient) {
            await graphClient.api(`/subscriptions/${response.id}`).delete()
            console.log('🧹 Subscription Microsoft supprimée (rollback)')
          }
        } catch (rollbackError) {
          console.error('⚠️ Erreur lors du rollback:', rollbackError)
        }
        
        return {
          success: false,
          error: `Impossible de sauvegarder en base de données: ${dbError.message}`
        }
      }

      return {
        success: true,
        subscriptionId: response.id,
        expirationDateTime: response.expirationDateTime
      }

    } catch (error) {
      console.error('❌ Erreur lors de la création de la subscription:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  /**
   * Renouveler une subscription existante
   */
  async renewSubscription(subscriptionId: string): Promise<{
    success: boolean
    newExpirationDateTime?: string
    error?: string
  }> {
    try {
      console.log('🔄 Renouvellement de la subscription:', subscriptionId)

      const graphClient = await createGraphClient()
      if (!graphClient) {
        throw new Error('Client Microsoft Graph non disponible')
      }

      // Nouvelle date d'expiration
      const newExpirationDateTime = new Date()
      newExpirationDateTime.setHours(newExpirationDateTime.getHours() + 71) // Max ~3 jours

      const response = await graphClient
        .api(`/subscriptions/${subscriptionId}`)
        .patch({
          expirationDateTime: newExpirationDateTime.toISOString()
        })

      console.log('✅ Subscription renouvelée:', response)

      // Mettre à jour dans la base de données
      await this.supabase
        .from('webhook_subscriptions')
        .update({
          expiration_datetime: response.expirationDateTime,
          last_renewed_at: new Date().toISOString(),
          renewal_count: this.supabase.raw('renewal_count + 1'),
          status: 'active'
        })
        .eq('subscription_id', subscriptionId)

      return {
        success: true,
        newExpirationDateTime: response.expirationDateTime
      }

    } catch (error) {
      console.error('❌ Erreur lors du renouvellement:', error)
      
      // Marquer comme failed dans la DB
      await this.supabase
        .from('webhook_subscriptions')
        .update({ status: 'failed' })
        .eq('subscription_id', subscriptionId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  /**
   * Supprimer une subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      console.log('🗑️ Suppression de la subscription:', subscriptionId)

      const graphClient = await createGraphClient()
      if (!graphClient) {
        throw new Error('Client Microsoft Graph non disponible')
      }

      await graphClient
        .api(`/subscriptions/${subscriptionId}`)
        .delete()

      // Supprimer de la base de données
      await this.supabase
        .from('webhook_subscriptions')
        .delete()
        .eq('subscription_id', subscriptionId)

      console.log('✅ Subscription supprimée')
      return true

    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error)
      return false
    }
  }

  /**
   * Lister toutes les subscriptions actives
   */
  async listSubscriptions(): Promise<any[]> {
    try {
      const graphClient = await createGraphClient()
      if (!graphClient) {
        throw new Error('Client Microsoft Graph non disponible')
      }

      const response = await graphClient
        .api('/subscriptions')
        .get()

      return response.value || []

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des subscriptions:', error)
      return []
    }
  }

  /**
   * Valider une notification webhook
   */
  validateNotification(clientState: string): boolean {
    return clientState === this.clientState
  }

  /**
   * Traiter une notification webhook
   */
  async processNotification(notification: WebhookNotification): Promise<{
    processed: number
    errors: number
  }> {
    let processed = 0
    let errors = 0

    for (const item of notification.value) {
      try {
        // Valider le client state
        if (!this.validateNotification(item.clientState)) {
          console.error('⚠️ Client state invalide pour:', item.subscriptionId)
          errors++
          continue
        }

        // Sauvegarder l'événement dans la base de données
        const { data: eventData, error: eventError } = await this.supabase
          .from('webhook_events')
          .insert({
            subscription_id: item.subscriptionId,
            event_type: `${item.resource}.${item.changeType}`,
            resource_id: item.resourceData?.id,
            resource_data: item.resourceData,
            change_type: item.changeType,
            client_state: item.clientState,
            tenant_id: item.tenantId,
            processed: false
          })
          .select()
          .single()

        if (eventError) {
          console.error('❌ Erreur lors de la sauvegarde de l\'événement:', eventError)
          errors++
          continue
        }

        // Traiter l'événement selon son type
        await this.handleEvent(eventData)
        processed++

      } catch (error) {
        console.error('❌ Erreur lors du traitement de la notification:', error)
        errors++
      }
    }

    return { processed, errors }
  }

  /**
   * Traiter un événement spécifique
   */
  private async handleEvent(event: any): Promise<void> {
    try {
      console.log('📨 Traitement de l\'événement:', event.event_type)

      // Selon le type d'événement, effectuer différentes actions
      if (event.event_type.includes('messages.created')) {
        // Un nouveau message a été créé (potentiellement une réponse)
        await this.handleNewMessage(event)
      } else if (event.event_type.includes('messages.updated')) {
        // Un message a été mis à jour
        await this.handleUpdatedMessage(event)
      }

      // Marquer l'événement comme traité
      await this.supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', event.id)

    } catch (error) {
      console.error('❌ Erreur lors du traitement de l\'événement:', error)
      
      // Logger l'erreur
      await this.supabase
        .from('webhook_events')
        .update({
          error_message: error instanceof Error ? error.message : 'Erreur inconnue',
          retry_count: this.supabase.raw('retry_count + 1')
        })
        .eq('id', event.id)
    }
  }

  /**
   * Traiter un nouveau message (potentielle réponse)
   */
  private async handleNewMessage(event: any): Promise<void> {
    const resourceData = event.resource_data
    if (!resourceData) return

    const conversationId = resourceData.conversationId
    if (!conversationId) return

    console.log('💬 Nouveau message dans la conversation:', conversationId)

    // Rechercher des emails trackés avec cette conversation ID
    // Note: Cela nécessiterait d'ajouter conversation_id à la table email_tracking
    // Pour l'instant, on peut utiliser le subject ou d'autres critères

    // Logger l'action dans webhook_processing_log
    await this.supabase
      .from('webhook_processing_log')
      .insert({
        event_id: event.id,
        action: 'check_for_reply',
        details: {
          conversation_id: conversationId,
          subject: resourceData.subject
        },
        success: true
      })
  }

  /**
   * Traiter un message mis à jour
   */
  private async handleUpdatedMessage(event: any): Promise<void> {
    const resourceData = event.resource_data
    if (!resourceData) return

    console.log('📝 Message mis à jour:', resourceData.id)

    // Logger l'action
    await this.supabase
      .from('webhook_processing_log')
      .insert({
        event_id: event.id,
        action: 'message_updated',
        details: {
          message_id: resourceData.id,
          is_read: resourceData.isRead
        },
        success: true
      })
  }

  /**
   * Renouveler automatiquement les subscriptions expirantes
   */
  async renewExpiringSubscriptions(): Promise<{
    renewed: number
    failed: number
  }> {
    let renewed = 0
    let failed = 0

    try {
      // Récupérer les subscriptions qui expirent bientôt
      const { data: subscriptions } = await this.supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('status', 'active')
        .lt('expiration_datetime', new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()) // 6 heures

      if (!subscriptions || subscriptions.length === 0) {
        console.log('✅ Aucune subscription à renouveler')
        return { renewed, failed }
      }

      console.log(`🔄 ${subscriptions.length} subscriptions à renouveler`)

      for (const sub of subscriptions) {
        const result = await this.renewSubscription(sub.subscription_id)
        if (result.success) {
          renewed++
        } else {
          failed++
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors du renouvellement automatique:', error)
    }

    return { renewed, failed }
  }

  /**
   * Obtenir le chemin de ressource selon le type
   */
  private getResourcePath(resourceType: 'messages' | 'mailFolders' | 'events'): string {
    const resourcePaths = {
      messages: '/me/messages',
      mailFolders: '/me/mailFolders',
      events: '/me/events'
    }
    return resourcePaths[resourceType] || '/me/messages'
  }

  /**
   * Nettoyer les anciens événements
   */
  async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('cleanup_old_webhook_events', { days_old: daysOld })

    if (error) {
      console.error('❌ Erreur lors du nettoyage:', error)
      return 0
    }

    console.log(`🧹 ${data} événements nettoyés`)
    return data || 0
  }
}

// Export une instance singleton
export const webhookService = new WebhookService()