'use client'

import { WebhookMonitor } from '@/components/dashboard/webhook-monitor'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function WebhooksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </Link>
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Webhooks Microsoft Graph</h1>
            <p className="text-gray-600 mt-2">
              Configurez et surveillez les notifications webhook pour la détection automatique des réponses
            </p>
          </div>
        </div>

        {/* Composant de monitoring */}
        <WebhookMonitor />

        {/* Documentation rapide */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Comment ça fonctionne</h3>
          
          <div className="space-y-4 text-sm">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">🔔 Notifications automatiques</h4>
                <p className="text-gray-600">
                  Les webhooks Microsoft Graph vous notifient instantanément quand vos emails reçoivent des réponses, 
                  éliminant le besoin de synchronisation manuelle.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">⚡ Mise à jour temps réel</h4>
                <p className="text-gray-600">
                  Le statut de vos emails trackés passe automatiquement de "En attente" à "Répondu" 
                  dès qu'une réponse est détectée.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">🔄 Renouvellement automatique</h4>
                <p className="text-gray-600">
                  Les subscriptions sont automatiquement renouvelées toutes les 6 heures pour maintenir 
                  la surveillance active (limite Microsoft Graph : ~3 jours max).
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">📊 Monitoring complet</h4>
                <p className="text-gray-600">
                  Surveillez l'état de toutes vos subscriptions, les événements reçus et 
                  les actions de traitement pour un debugging facile.
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-6">
              <h4 className="font-medium text-gray-900 mb-2">Configuration requise</h4>
              <ul className="text-gray-600 space-y-1 text-xs">
                <li>• Endpoint webhook accessible en HTTPS : <code className="bg-gray-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook</code></li>
                <li>• Permissions Microsoft Graph : Mail.Read, Mail.ReadWrite</li>
                <li>• Variables d'environnement : WEBHOOK_ENDPOINT_URL, WEBHOOK_CLIENT_STATE</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}