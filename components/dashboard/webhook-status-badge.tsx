'use client'

import { useState, useEffect } from 'react'
import { Webhook, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WebhookSystemStatus {
  status: 'healthy' | 'warning' | 'error'
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
  }
  recommendations: string[]
  timestamp: string
}

export function WebhookStatusBadge() {
  const [status, setStatus] = useState<WebhookSystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)

  // Charger le statut initial et configurer le polling
  useEffect(() => {
    loadStatus()
    
    // Polling toutes les 60 secondes pour maintenir le statut à jour
    const interval = setInterval(loadStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/tracking/status')
      const data = await response.json()
      
      if (response.ok) {
        setStatus(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement du statut webhook:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Activer automatiquement les webhooks
  const activateWebhooks = async () => {
    setIsActivating(true)
    
    try {
      const response = await fetch('/api/tracking/status', {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (response.ok) {
        // Recharger le statut après activation
        await loadStatus()
        
        // Afficher un message de succès si des améliorations ont été apportées
        if (result.improvements && result.improvements.length > 0) {
          // On pourrait ajouter une notification toast ici
          console.log('✅ Améliorations automatiques:', result.improvements)
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'activation:', error)
    } finally {
      setIsActivating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-600">Vérification...</span>
      </div>
    )
  }

  if (!status) {
    return (
      <Badge variant="destructive" className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Statut indisponible
      </Badge>
    )
  }

  // Déterminer l'apparence selon le statut
  const getStatusConfig = () => {
    switch (status.status) {
      case 'healthy':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-600 bg-green-50 border-green-200',
          text: 'Webhook Actif',
          description: `${status.system.webhooks.activeSubscriptions} subscription(s) active(s)`
        }
      case 'warning':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          color: 'text-orange-600 bg-orange-50 border-orange-200',
          text: 'Configuration',
          description: status.recommendations[0] || 'Configuration à optimiser'
        }
      case 'error':
      default:
        return {
          variant: 'destructive' as const,
          icon: AlertCircle,
          color: 'text-red-600 bg-red-50 border-red-200',
          text: 'Webhook Inactif',
          description: status.recommendations[0] || 'Configuration requise'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={config.variant}
              className={`flex items-center gap-2 cursor-pointer ${config.color}`}
            >
              <Webhook className="w-3 h-3" />
              <Icon className="w-3 h-3" />
              {config.text}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-2">
              <div className="font-medium">{config.description}</div>
              
              {status.system.webhooks.enabled && (
                <div className="text-sm text-gray-600">
                  <div>Subscriptions: {status.system.webhooks.activeSubscriptions}</div>
                  {status.system.webhooks.subscriptionsExpiringSoon > 0 && (
                    <div className="text-orange-600">
                      {status.system.webhooks.subscriptionsExpiringSoon} à renouveler
                    </div>
                  )}
                  {status.system.webhooks.lastEventReceived && (
                    <div>
                      Dernier événement: {new Date(status.system.webhooks.lastEventReceived).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              
              {status.recommendations.slice(0, 2).map((rec, index) => (
                <div key={index} className="text-xs text-gray-500 border-t pt-1">
                  {rec}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Bouton d'activation automatique si le statut n'est pas optimal */}
        {status.status !== 'healthy' && status.system.microsoft.available && (
          <Button
            onClick={activateWebhooks}
            disabled={isActivating}
            size="sm"
            variant="outline"
            className="text-xs px-2 py-1 h-auto"
          >
            {isActivating ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                Activation...
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Activer
              </>
            )}
          </Button>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Version compacte pour les espaces restreints
 */
export function CompactWebhookStatus() {
  const [status, setStatus] = useState<'healthy' | 'warning' | 'error' | 'loading'>('loading')
  const [subscriptionCount, setSubscriptionCount] = useState(0)

  useEffect(() => {
    const loadCompactStatus = async () => {
      try {
        const response = await fetch('/api/tracking/status')
        const data = await response.json()
        
        if (response.ok) {
          setStatus(data.status)
          setSubscriptionCount(data.system.webhooks.activeSubscriptions || 0)
        }
      } catch (error) {
        setStatus('error')
      }
    }

    loadCompactStatus()
    const interval = setInterval(loadCompactStatus, 120000) // 2 minutes
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-orange-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <Webhook className="w-4 h-4 text-gray-500" />
            {subscriptionCount > 0 && (
              <span className="text-xs text-gray-500">{subscriptionCount}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div>
            Webhooks: {status === 'loading' ? 'Vérification...' : status}
            {subscriptionCount > 0 && ` (${subscriptionCount} actif${subscriptionCount > 1 ? 's' : ''})`}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}