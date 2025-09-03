'use client'

import { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'

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

export function TrackingStatus() {
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

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement du statut...</span>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Impossible de charger le statut</span>
        </div>
      </div>
    )
  }

  const getModeIcon = () => {
    if (status.mode === 'webhook') {
      return status.webhookHealthy ? (
        <Wifi className="w-5 h-5 text-green-600" />
      ) : (
        <WifiOff className="w-5 h-5 text-red-600" />
      )
    }
    return <Clock className="w-5 h-5 text-blue-600" />
  }

  const getModeColor = () => {
    if (status.mode === 'webhook' && status.webhookHealthy) {
      return 'bg-green-50 border-green-200 text-green-800'
    }
    if (status.mode === 'sync') {
      return 'bg-blue-50 border-blue-200 text-blue-800'
    }
    return 'bg-red-50 border-red-200 text-red-800'
  }

  const getModeText = () => {
    if (status.mode === 'webhook' && status.webhookHealthy) {
      return 'Temps réel actif'
    }
    if (status.mode === 'webhook' && !status.webhookHealthy) {
      return 'Webhook indisponible'
    }
    return `Sync (${status.syncInterval}min)`
  }

  return (
    <div className="space-y-4">
      {/* Statut principal */}
      <div className={`border rounded-lg p-4 ${getModeColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getModeIcon()}
            <div>
              <div className="font-medium">{getModeText()}</div>
              <div className="text-xs opacity-75">
                {status.mode === 'webhook' ? 'Détection instantanée des réponses' : 'Vérification périodique'}
              </div>
            </div>
          </div>
          
          <button
            onClick={forceCheck}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white bg-opacity-50 rounded hover:bg-opacity-75 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Vérifier
          </button>
        </div>
      </div>

      {/* Recommandations */}
      {status.recommendations && status.recommendations.length > 0 && (
        <div className="space-y-2">
          {status.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`text-xs p-3 rounded border ${
                rec.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : rec.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  : rec.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {rec.type === 'success' && <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                {rec.type === 'warning' && <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                {rec.type === 'error' && <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                {rec.type === 'info' && <Activity className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                
                <div>
                  <div className="font-medium">{rec.message}</div>
                  <div className="mt-1 opacity-75">{rec.action}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Détails techniques */}
      {status.lastCheck && (
        <div className="text-xs text-gray-500 border-t pt-2">
          Dernière vérification : {new Date(status.lastCheck).toLocaleString()}
        </div>
      )}
    </div>
  )
}