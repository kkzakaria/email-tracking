'use client'

import { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TrackingStatus {
  mode: 'webhook' | 'sync'
  webhookEnabled: boolean
  webhookHealthy: boolean
  syncFallbackEnabled: boolean
  syncInterval: number
  lastCheck: string | null
  recommendations: Array<{
    type: 'success' | 'warning' | 'info' | 'error'
    message: string
    action: string
  }>
}

// Icône adaptative selon l'état du système
const SystemStatusIcon = ({ status, isLoading }: { status: TrackingStatus | null; isLoading: boolean }) => {
  if (isLoading) {
    return <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
  }

  if (!status) {
    return <AlertCircle className="w-5 h-5 text-red-600" />
  }

  if (status.mode === 'webhook') {
    return status.webhookHealthy ? (
      <Wifi className="w-5 h-5 text-green-600" />
    ) : (
      <WifiOff className="w-5 h-5 text-red-600" />
    )
  }
  
  return <Clock className="w-5 h-5 text-blue-600" />
}

export function SystemStatusButton() {
  const [status, setStatus] = useState<TrackingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadStatus()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/tracking/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement du statut:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const forceCheck = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/tracking/status', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setStatus(data.status)
      }
    } catch (error) {
      console.error('Erreur lors de la vérification:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getModeText = () => {
    if (!status) return 'Statut inconnu'
    
    if (status.mode === 'webhook' && status.webhookHealthy) {
      return 'Temps réel actif'
    }
    if (status.mode === 'webhook' && !status.webhookHealthy) {
      return 'Webhook indisponible'
    }
    return `Sync (${status.syncInterval}min)`
  }

  const getStatusColor = () => {
    if (isLoading) return 'border-gray-300'
    if (!status) return 'border-red-500 bg-red-50 dark:bg-red-950/20'
    
    if (status.mode === 'webhook' && status.webhookHealthy) {
      return 'border-green-500 bg-green-50 dark:bg-green-950/20'
    }
    if (status.mode === 'sync') {
      return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
    }
    return 'border-red-500 bg-red-50 dark:bg-red-950/20'
  }

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />
      default: return <Activity className="w-4 h-4 text-blue-600" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={`relative ${getStatusColor()}`}
        >
          <SystemStatusIcon status={status} isLoading={isLoading} />
          {status?.recommendations && status.recommendations.length > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">{status.recommendations.length}</span>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72">
        {isLoading ? (
          <DropdownMenuItem asChild>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement du statut...</span>
            </div>
          </DropdownMenuItem>
        ) : !status ? (
          <DropdownMenuItem asChild>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-red-800">Statut du système</span>
                <span className="text-xs text-red-600">Impossible de charger</span>
              </div>
            </div>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <SystemStatusIcon status={status} isLoading={false} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{getModeText()}</span>
                  <span className="text-xs text-gray-500">
                    {status.mode === 'webhook' ? 'Détection instantanée des réponses' : 'Vérification périodique'}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>

            {status.lastCheck && (
              <DropdownMenuItem asChild>
                <div className="px-2 py-1.5">
                  <span className="text-xs text-gray-500">
                    Dernière vérification : {new Date(status.lastCheck).toLocaleString('fr-FR', {
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

            <DropdownMenuItem onClick={forceCheck} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Vérification...' : 'Forcer la vérification'}
            </DropdownMenuItem>

            {status.recommendations && status.recommendations.length > 0 && (
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
                        {getRecommendationIcon(rec.type)}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {rec.message}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                            {rec.action}
                          </span>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}

                {status.recommendations.length > 3 && (
                  <DropdownMenuItem asChild>
                    <div className="px-2 py-1.5">
                      <span className="text-xs text-gray-500">
                        +{status.recommendations.length - 3} autres recommandations
                      </span>
                    </div>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}