import { webhookService } from '@/lib/microsoft/webhook-service'
import { syncOutlookSentEmails } from '@/lib/microsoft/sync-service'
import { validateWebhookEnvironment, logValidationResult } from '@/lib/utils/env-validator'

interface TrackingConfig {
  webhookEnabled: boolean
  syncFallbackEnabled: boolean
  syncIntervalMinutes: number
  lastWebhookCheck: Date | null
  webhookHealthy: boolean
}

class AdaptiveTrackingService {
  private config: TrackingConfig = {
    webhookEnabled: process.env.WEBHOOK_ENABLED === 'true',
    syncFallbackEnabled: process.env.SYNC_FALLBACK_ENABLED !== 'false',
    syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15'),
    lastWebhookCheck: null,
    webhookHealthy: false
  }

  /**
   * Démarrer le système de tracking adaptatif
   */
  async start() {
    console.log('🚀 Démarrage du système de tracking adaptatif')
    
    // Vérifier la santé des webhooks
    await this.checkWebhookHealth()
    
    // Stratégie basée sur la disponibilité
    if (this.config.webhookEnabled && this.config.webhookHealthy) {
      await this.startWebhookMode()
    } else {
      await this.startSyncMode()
    }
    
    // Surveillance continue
    this.startHealthMonitoring()
  }

  /**
   * Vérifier si les webhooks sont fonctionnels
   */
  private async checkWebhookHealth(): Promise<boolean> {
    try {
      console.log('🔍 Vérification de la santé des webhooks...')
      
      // Validation complète de l'environnement
      const validation = validateWebhookEnvironment()
      logValidationResult(validation)
      
      if (!validation.isValid) {
        console.log('❌ Variables d\'environnement manquantes pour les webhooks')
        this.config.webhookHealthy = false
        return false
      }
      
      const endpointUrl = process.env.WEBHOOK_ENDPOINT_URL!

      // Test de l'endpoint (contourner les limitations serverless)
      try {
        console.log('🔍 Vérification de l\'endpoint:', endpointUrl)
        
        // Stratégie adaptée selon l'environnement
        const isProduction = process.env.NODE_ENV === 'production'
        const isVercel = process.env.VERCEL === '1'
        
        if (isProduction || isVercel) {
          // En production/Vercel : validation de l'URL seulement (pas de self-fetch)
          const isValidUrl = endpointUrl.startsWith('https://') && endpointUrl.includes('/api/webhooks/outlook')
          
          if (isValidUrl) {
            console.log('✅ URL webhook valide (validation production)')
            this.config.webhookHealthy = true
          } else {
            throw new Error('URL webhook mal formée')
          }
        } else {
          // En développement local : test de connectivité réel
          const response = await fetch(endpointUrl, { 
            method: 'GET',
            timeout: 5000 
          } as any)
          
          if (response.ok) {
            console.log('✅ Endpoint webhook accessible (test local)')
            this.config.webhookHealthy = true
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        }
        
      } catch (error) {
        console.log('❌ Configuration webhook invalide:', error)
        this.config.webhookHealthy = false
      }

      // Vérifier les subscriptions actives
      if (this.config.webhookHealthy) {
        const subscriptions = await webhookService.listSubscriptions()
        const activeCount = subscriptions.length
        
        console.log(`📊 ${activeCount} subscription(s) active(s)`)
        
        if (activeCount === 0) {
          console.log('⚠️ Aucune subscription active')
          console.log('💡 Le système permet la création manuelle de subscriptions')
          // Ne pas marquer comme non healthy - permettre la création de subscriptions
        }
      }

      this.config.lastWebhookCheck = new Date()
      return this.config.webhookHealthy
      
    } catch (error) {
      console.error('❌ Erreur lors de la vérification webhook:', error)
      this.config.webhookHealthy = false
      return false
    }
  }

  /**
   * Démarrer le mode webhook (temps réel)
   */
  private async startWebhookMode() {
    console.log('⚡ Mode WEBHOOK actif - détection temps réel')
    console.log('📱 Les réponses seront détectées instantanément')
    
    // Synchronisation de rattrapage moins fréquente (1x par jour)
    if (this.config.syncFallbackEnabled) {
      console.log('🔄 Sync de backup programmée (1x/jour)')
      setInterval(async () => {
        console.log('🔄 Sync de backup...')
        await syncOutlookSentEmails({ days: 1 })
      }, 24 * 60 * 60 * 1000) // 24h
    }
  }

  /**
   * Démarrer le mode synchronisation (fallback)
   */
  private async startSyncMode() {
    console.log('🔄 Mode SYNCHRONISATION - polling périodique')
    console.log(`⏰ Vérification toutes les ${this.config.syncIntervalMinutes} minutes`)
    
    // Synchronisation immédiate
    await this.performSync()
    
    // Synchronisation périodique
    setInterval(async () => {
      await this.performSync()
    }, this.config.syncIntervalMinutes * 60 * 1000)
  }

  /**
   * Effectuer une synchronisation
   */
  private async performSync() {
    try {
      console.log('🔄 Synchronisation Outlook en cours...')
      const result = await syncOutlookSentEmails()
      
      if (result.success) {
        console.log(`✅ Sync réussie: ${result.newTrackedEmails} nouveaux, ${result.updatedTrackedEmails} mis à jour`)
      } else {
        console.log('❌ Sync échouée:', result.error)
      }
    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error)
    }
  }

  /**
   * Surveillance continue de la santé du système
   */
  private startHealthMonitoring() {
    console.log('🔍 Surveillance système démarrée (vérification toutes les 30min)')
    
    setInterval(async () => {
      const previousHealth = this.config.webhookHealthy
      await this.checkWebhookHealth()
      
      // Basculement automatique
      if (previousHealth && !this.config.webhookHealthy) {
        console.log('🔄 Basculement WEBHOOK → SYNC (webhook indisponible)')
        await this.startSyncMode()
      } else if (!previousHealth && this.config.webhookHealthy) {
        console.log('⚡ Basculement SYNC → WEBHOOK (webhook restauré)')
        await this.startWebhookMode()
      }
      
    }, 30 * 60 * 1000) // 30 minutes
  }

  /**
   * Obtenir le statut actuel
   */
  getStatus() {
    return {
      mode: this.config.webhookHealthy ? 'webhook' : 'sync',
      webhookEnabled: this.config.webhookEnabled,
      webhookHealthy: this.config.webhookHealthy,
      syncFallbackEnabled: this.config.syncFallbackEnabled,
      syncInterval: this.config.syncIntervalMinutes,
      lastCheck: this.config.lastWebhookCheck
    }
  }

  /**
   * Forcer une vérification manuelle
   */
  async forceHealthCheck() {
    console.log('🔄 Vérification forcée de la santé du système...')
    return await this.checkWebhookHealth()
  }
}

// Export d'une instance singleton
export const adaptiveTracking = new AdaptiveTrackingService()

// Helper pour initialiser le système
export async function initializeTracking() {
  try {
    await adaptiveTracking.start()
    console.log('🎯 Système de tracking initialisé avec succès')
  } catch (error) {
    console.error('❌ Erreur d\'initialisation du tracking:', error)
  }
}