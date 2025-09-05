'use client'

import React from 'react'
import { Activity, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWebhookStatus, useWebhookHealth } from '@/contexts/webhook-status-context'

// Types pour les variantes
type WebhookStatusVariant = 'button' | 'badge' | 'compact'

interface WebhookStatusProps {
  variant?: WebhookStatusVariant
  className?: string
}

/**
 * Composant unifié pour afficher le statut des webhooks
 * 
 * Variantes disponibles:
 * - 'button': Bouton avec dropdown détaillé (pour la navigation)
 * - 'badge': Badge avec tooltip (pour le dashboard)
 * - 'compact': Indicateur minimaliste (pour les espaces restreints)
 */
export function WebhookStatus({ variant = 'badge', className = '' }: WebhookStatusProps) {
  const { 
    status, 
    isLoading, 
    error, 
    lastUpdate, 
    refreshStatus, 
    activateWebhooks,
    isActivating 
  } = useWebhookStatus()
  
  const { isHealthy, isActive, subscriptionCount, isConfigured } = useWebhookHealth()
  
  // Notification visuelle pendant l'activation automatique
  const [showActivationNotice, setShowActivationNotice] = React.useState(false)
  
  React.useEffect(() => {
    if (isActivating) {
      setShowActivationNotice(true)
      // Masquer après 5 secondes
      const timer = setTimeout(() => setShowActivationNotice(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isActivating])

  // Fonction helper pour obtenir l'icône appropriée
  const getStatusIcon = (size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5'
    
    if (isLoading && !status) {
      return <RefreshCw className={`${sizeClass} animate-spin text-gray-600`} />
    }

    if (!status || error) {
      return <AlertCircle className={`${sizeClass} text-red-600`} />
    }

    if (isConfigured && isActive) {
      return <Wifi className={`${sizeClass} text-green-600`} />
    }
    
    if (isConfigured && !isActive) {
      return <WifiOff className={`${sizeClass} text-orange-600`} />
    }
    
    return <Clock className={`${sizeClass} text-blue-600`} />
  }

  // Fonction helper pour obtenir le texte de statut
  const getStatusText = () => {
    if (!status) return 'Statut inconnu'
    
    if (isConfigured && isActive) {
      return 'Temps réel actif'
    }
    if (isConfigured && !isActive) {
      return 'Webhook configuré'
    }
    if (!isConfigured) {
      return 'Mode sync'
    }
    return 'Statut inconnu'
  }

  // Fonction helper pour obtenir la couleur de statut
  const getStatusColor = () => {
    if (isLoading && !status) return 'border-gray-300'
    if (!status || error) return 'border-red-500 bg-red-50 dark:bg-red-950/20'
    
    if (status.status === 'healthy') {
      return 'border-green-500 bg-green-50 dark:bg-green-950/20'
    }
    if (status.status === 'warning') {
      return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
    }
    return 'border-red-500 bg-red-50 dark:bg-red-950/20'
  }

  // Fonction helper pour obtenir la configuration du badge
  const getBadgeConfig = () => {
    if (isHealthy && isActive) {
      return {
        variant: 'default' as const,
        color: 'text-green-600 bg-green-50 border-green-200',
        text: 'Webhook Actif',
        description: `${subscriptionCount} subscription(s) active(s)`
      }
    }
    
    if (isConfigured) {
      return {
        variant: 'secondary' as const,
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        text: 'Configuration',
        description: status?.recommendations[0] || 'Configuration à optimiser'
      }
    }
    
    return {
      variant: 'destructive' as const,
      color: 'text-red-600 bg-red-50 border-red-200',
      text: 'Webhook Inactif',
      description: status?.recommendations[0] || 'Configuration requise'
    }
  }

  // Rendu selon la variante
  switch (variant) {
    case 'button':
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className={`relative ${getStatusColor()} ${className}`}
            >
              {getStatusIcon()}
              {/* Badge de notifications */}
              {status?.recommendations && status.recommendations.length > 0 && !showActivationNotice && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">{status.recommendations.length}</span>
                </div>
              )}
              {/* Badge d'activation automatique */}
              {showActivationNotice && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-2 h-2 text-white animate-spin" />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-72">
            {/* Message de souscription automatique */}
            {showActivationNotice && (
              <DropdownMenuItem asChild>
                <div className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border-l-2 border-green-500">
                  <RefreshCw className="w-4 h-4 animate-spin text-green-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-green-800">Activation automatique</span>
                    <span className="text-xs text-green-600">
                      Configuration des webhooks temps réel...
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            )}
            
            {/* Contenu du statut */}
            <DropdownMenuItem asChild>
              <div className="flex items-center gap-2 px-2 py-1.5">
                {getStatusIcon()}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{getStatusText()}</span>
                  <span className="text-xs text-gray-500">
                    {subscriptionCount > 0 
                      ? `${subscriptionCount} subscription(s) active(s)` 
                      : isConfigured 
                        ? 'Aucune subscription active'
                        : 'Vérification périodique'}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>

            {lastUpdate && (
              <DropdownMenuItem asChild>
                <div className="px-2 py-1.5">
                  <span className="text-xs text-gray-500">
                    Mise à jour : {lastUpdate.toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Actions */}
            <DropdownMenuItem onClick={refreshStatus} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Actualisation...' : 'Actualiser'}
            </DropdownMenuItem>

            {/* Bouton d'activation si nécessaire */}
            {status && status.status !== 'healthy' && status.system.microsoft.available && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={activateWebhooks} disabled={isActivating}>
                  <CheckCircle className={`w-4 h-4 mr-2 ${isActivating ? 'animate-spin' : ''}`} />
                  {isActivating ? 'Activation...' : 'Activer les webhooks'}
                </DropdownMenuItem>
              </>
            )}

            {/* Recommandations */}
            {status?.recommendations && status.recommendations.length > 0 && (
              <>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem asChild>
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Recommandations ({status.recommendations.length})
                    </span>
                  </div>
                </DropdownMenuItem>

                {status.recommendations.slice(0, 3).map((rec, index) => (
                  <DropdownMenuItem key={index} asChild>
                    <div className="px-2 py-1.5">
                      <div className="flex items-start gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {rec}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )

    case 'badge':
      const badgeConfig = getBadgeConfig()
      return (
        <TooltipProvider>
          <div className={`flex items-center gap-2 ${className}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={badgeConfig.variant}
                  className={`flex items-center gap-2 cursor-pointer ${badgeConfig.color}`}
                >
                  <Webhook className="w-3 h-3" />
                  {getStatusIcon('sm')}
                  {badgeConfig.text}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-2">
                  <div className="font-medium">{badgeConfig.description}</div>
                  
                  {status?.system.webhooks.enabled && (
                    <div className="text-sm text-gray-600">
                      <div>Subscriptions: {subscriptionCount}</div>
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
                  
                  {status?.recommendations.slice(0, 2).map((rec, index) => (
                    <div key={index} className="text-xs text-gray-500 border-t pt-1">
                      {rec}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Bouton d'activation si nécessaire */}
            {status && !isHealthy && status.system.microsoft.available && (
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

    case 'compact':
      const statusColor = !status ? 'bg-gray-500' 
        : isHealthy && isActive ? 'bg-green-500'
        : status.status === 'warning' ? 'bg-orange-500'
        : 'bg-red-500'

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-2 ${className}`}>
                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                <Webhook className="w-4 h-4 text-gray-500" />
                {subscriptionCount > 0 && (
                  <span className="text-xs text-gray-500">{subscriptionCount}</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div>
                {getStatusText()}
                {subscriptionCount > 0 && ` (${subscriptionCount} actif${subscriptionCount > 1 ? 's' : ''})`}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

    default:
      return null
  }
}