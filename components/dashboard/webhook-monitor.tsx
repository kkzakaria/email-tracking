'use client'

import { useState, useEffect } from 'react'
import { Webhook, RefreshCw, CheckCircle, AlertCircle, Clock, Activity, Plus, Trash2 } from 'lucide-react'

interface WebhookSubscription {
  id: string
  subscription_id: string
  resource: string
  change_types: string[]
  status: string
  expiration_datetime: string
  last_renewed_at: string | null
  renewal_count: number
  created_at: string
  graphStatus?: string
  graphExpiration?: string
}

interface WebhookStats {
  activeSubscriptions: number
  totalEvents: number
  processedEvents: number
  failedEvents: number
  lastEventTime: string | null
}

export function WebhookMonitor() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([])
  const [stats, setStats] = useState<WebhookStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Charger les subscriptions et statistiques
  useEffect(() => {
    loadData()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      // Charger les subscriptions
      const response = await fetch('/api/webhooks/subscribe')
      const data = await response.json()
      
      if (response.ok) {
        setSubscriptions(data.subscriptions || [])
      }

      // Charger les statistiques (à implémenter)
      // const statsResponse = await fetch('/api/webhooks/stats')
      // const statsData = await statsResponse.json()
      // setStats(statsData)

    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Créer une nouvelle subscription
  const createSubscription = async () => {
    setIsCreating(true)
    setMessage(null)

    try {
      const response = await fetch('/api/webhooks/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType: 'messages',
          changeTypes: ['created', 'updated'],
          expirationHours: 71
        })
      })

      const result = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Subscription créée avec succès (ID: ${result.subscriptionId})`
        })
        await loadData() // Recharger les données
      } else {
        throw new Error(result.error || 'Erreur lors de la création')
      }

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Supprimer une subscription
  const deleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette subscription ?')) return

    try {
      const response = await fetch('/api/webhooks/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId })
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Subscription supprimée avec succès'
        })
        await loadData()
      } else {
        const result = await response.json()
        throw new Error(result.error || 'Erreur lors de la suppression')
      }

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }

  // Renouveler une subscription
  const renewSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch('/api/webhooks/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'default-cron-secret'}`
        },
        body: JSON.stringify({ subscriptionId })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({
          type: 'success',
          text: `Subscription renouvelée jusqu'au ${new Date(result.newExpirationDateTime).toLocaleString()}`
        })
        await loadData()
      } else {
        throw new Error('Erreur lors du renouvellement')
      }

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }

  // Calculer le temps restant avant expiration
  const getTimeRemaining = (expirationDate: string) => {
    const now = new Date()
    const expiration = new Date(expirationDate)
    const diff = expiration.getTime() - now.getTime()
    
    if (diff < 0) return 'Expiré'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}j ${hours % 24}h`
    }
    
    return `${hours}h ${minutes}m`
  }

  // Obtenir la couleur du statut
  const getStatusColor = (status: string, expirationDate: string) => {
    if (status !== 'active') return 'text-red-600 bg-red-50'
    
    const hoursRemaining = (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60)
    
    if (hoursRemaining < 6) return 'text-orange-600 bg-orange-50'
    if (hoursRemaining < 24) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Chargement des webhooks...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Webhook className="w-6 h-6" />
              Monitoring des Webhooks
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Gérez les subscriptions webhook pour la détection automatique des réponses
            </p>
          </div>
          
          <button
            onClick={createSubscription}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Nouvelle Subscription
          </button>
        </div>

        {/* Message d'état */}
        {message && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Statistiques rapides */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Actives</span>
            </div>
            <div className="text-2xl font-bold">
              {subscriptions.filter(s => s.status === 'active').length}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">À renouveler</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {subscriptions.filter(s => {
                const hours = (new Date(s.expiration_datetime).getTime() - Date.now()) / (1000 * 60 * 60)
                return hours < 6 && hours > 0
              }).length}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Expirées</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {subscriptions.filter(s => new Date(s.expiration_datetime) < new Date()).length}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Renouvellements</span>
            </div>
            <div className="text-2xl font-bold">
              {subscriptions.reduce((sum, s) => sum + s.renewal_count, 0)}
            </div>
          </div>
        </div>

        {/* Liste des subscriptions */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Resource</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Types</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Statut</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Expiration</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Renouvellements</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Aucune subscription active. Créez-en une pour commencer le tracking automatique.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {sub.resource}
                      </code>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {sub.change_types.map(type => (
                          <span key={type} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(sub.status, sub.expiration_datetime)}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm">
                        <div className="font-medium">{getTimeRemaining(sub.expiration_datetime)}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(sub.expiration_datetime).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm">
                        <div className="font-medium">{sub.renewal_count} fois</div>
                        {sub.last_renewed_at && (
                          <div className="text-xs text-gray-500">
                            Dernier: {new Date(sub.last_renewed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => renewSubscription(sub.subscription_id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Renouveler"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSubscription(sub.subscription_id)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Note d'information */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note :</strong> Les subscriptions webhook expirent automatiquement après ~3 jours (limite Microsoft Graph). 
            Un renouvellement automatique est configuré pour s'exécuter toutes les 6 heures.
          </p>
        </div>
      </div>
    </div>
  )
}