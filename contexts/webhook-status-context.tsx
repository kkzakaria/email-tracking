'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Structure unifiée pour le statut webhook
export interface WebhookSystemStatus {
  status: 'healthy' | 'warning' | 'error' | 'loading'
  timestamp: string
  system: {
    webhooks: {
      enabled: boolean
      configured: boolean
      activeSubscriptions: number
      subscriptionsExpiringSoon: number
      lastEventReceived: string | null
      endpointUrl: string
    }
    database: {
      connected: boolean
      migrationStatus: 'up_to_date' | 'needs_update' | 'unknown'
    }
    microsoft: {
      available: boolean
      lastConnection: string | null
    }
    overall: 'healthy' | 'warning' | 'error'
  }
  recommendations: string[]
}

interface WebhookStatusContextType {
  status: WebhookSystemStatus | null
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  refreshStatus: () => Promise<void>
  activateWebhooks: () => Promise<void>
  isActivating: boolean
}

const WebhookStatusContext = createContext<WebhookStatusContextType | undefined>(undefined)

// Configuration pour le polling
const POLLING_INTERVAL = 60000 // 60 secondes
const RETRY_DELAY = 5000 // 5 secondes en cas d'erreur

export function WebhookStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WebhookSystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [hasAutoSubscribed, setHasAutoSubscribed] = useState(false)

  // Fonction pour charger le statut
  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/tracking/status')
      const data = await response.json()
      
      if (response.ok) {
        setStatus(data)
        setError(null)
        setLastUpdate(new Date())
        setRetryCount(0)
      } else {
        throw new Error(data.error || 'Erreur lors du chargement du statut')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
      
      // Retry avec backoff exponentiel en cas d'erreur
      const nextRetry = Math.min(retryCount + 1, 5)
      setRetryCount(nextRetry)
      
      // Retry après un délai progressif
      if (nextRetry < 5) {
        setTimeout(() => {
          loadStatus()
        }, RETRY_DELAY * nextRetry)
      }
    } finally {
      setIsLoading(false)
    }
  }, [retryCount])

  // Fonction pour rafraîchir manuellement
  const refreshStatus = useCallback(async () => {
    setIsLoading(true)
    await loadStatus()
  }, [loadStatus])

  // Fonction pour activer automatiquement les webhooks
  const activateWebhooks = useCallback(async () => {
    setIsActivating(true)
    
    try {
      const response = await fetch('/api/tracking/status', {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (response.ok) {
        // Recharger le statut après activation
        await loadStatus()
        
        // Retourner les améliorations si disponibles
        if (result.improvements && result.improvements.length > 0) {
          console.log('✅ Améliorations webhook:', result.improvements)
        }
      } else {
        throw new Error(result.error || 'Erreur lors de l\'activation')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'activation'
      setError(errorMessage)
      console.error('Erreur activation webhooks:', err)
    } finally {
      setIsActivating(false)
    }
  }, [loadStatus])

  // Chargement initial et polling
  useEffect(() => {
    // Chargement initial
    loadStatus()

    // Configuration du polling
    const interval = setInterval(() => {
      // Ne pas rafraîchir si on est déjà en train de charger ou d'activer
      if (!isLoading && !isActivating) {
        loadStatus()
      }
    }, POLLING_INTERVAL)

    // Écouter les changements de visibilité de la page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoading) {
        // Rafraîchir quand l'utilisateur revient sur la page
        loadStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Nettoyage
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadStatus, isLoading, isActivating])

  // Souscription automatique quand Microsoft est disponible
  useEffect(() => {
    // Conditions pour la souscription automatique :
    // 1. Le statut est chargé
    // 2. Microsoft Graph est disponible (utilisateur connecté)
    // 3. Pas de subscription active
    // 4. Les webhooks sont configurés
    // 5. Pas déjà en train d'activer
    // 6. Pas déjà tenté automatiquement dans cette session
    
    if (
      status && 
      !hasAutoSubscribed && 
      !isActivating &&
      status.system.microsoft.available &&
      status.system.webhooks.configured &&
      status.system.webhooks.activeSubscriptions === 0
    ) {
      console.log('🚀 Détection d\'authentification Microsoft - Souscription automatique...')
      setHasAutoSubscribed(true)
      
      // Délai court pour laisser l'UI se charger
      setTimeout(() => {
        activateWebhooks()
      }, 2000)
    }
  }, [status, hasAutoSubscribed, isActivating, activateWebhooks])

  // Écouter les événements de mise à jour webhook (depuis d'autres onglets)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'webhook-status-update' && e.newValue) {
        // Un autre onglet a mis à jour le statut
        const update = JSON.parse(e.newValue)
        if (update.timestamp > (lastUpdate?.getTime() || 0)) {
          setStatus(update.status)
          setLastUpdate(new Date(update.timestamp))
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [lastUpdate])

  // Diffuser les mises à jour vers les autres onglets
  useEffect(() => {
    if (status && lastUpdate) {
      try {
        localStorage.setItem('webhook-status-update', JSON.stringify({
          status,
          timestamp: lastUpdate.getTime()
        }))
      } catch {
        // Ignorer les erreurs de localStorage
      }
    }
  }, [status, lastUpdate])

  const value: WebhookStatusContextType = {
    status,
    isLoading,
    error,
    lastUpdate,
    refreshStatus,
    activateWebhooks,
    isActivating
  }

  return (
    <WebhookStatusContext.Provider value={value}>
      {children}
    </WebhookStatusContext.Provider>
  )
}

// Hook pour utiliser le contexte
export function useWebhookStatus() {
  const context = useContext(WebhookStatusContext)
  if (context === undefined) {
    throw new Error('useWebhookStatus doit être utilisé dans un WebhookStatusProvider')
  }
  return context
}

// Helpers pour un accès rapide aux propriétés communes
export function useWebhookHealth() {
  const { status, isLoading } = useWebhookStatus()
  
  return {
    isHealthy: status?.status === 'healthy',
    isActive: (status?.system.webhooks.activeSubscriptions || 0) > 0,
    subscriptionCount: status?.system.webhooks.activeSubscriptions || 0,
    isConfigured: status?.system.webhooks.configured || false,
    isLoading
  }
}