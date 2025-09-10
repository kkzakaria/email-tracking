import Link from 'next/link'
import { ArrowLeft, Activity, Server, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function WebhooksPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </Link>
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Webhooks Microsoft Graph</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Monitoring des webhooks automatisés pour la détection temps réel des réponses
            </p>
          </div>
        </div>

        {/* Statut du système */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhooks Actifs</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Actif</div>
              <p className="text-xs text-muted-foreground">
                Edge Functions déployées
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Détection Réponses</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Temps Réel</div>
              <p className="text-xs text-muted-foreground">
                Via triggers PostgreSQL
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">Auto-Renew</div>
              <p className="text-xs text-muted-foreground">
                Gestion automatique
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Architecture Supabase */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Nouvelle Architecture Supabase
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Actif
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">🚀 Edge Functions Automatisées</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">webhook-handler : Réception des notifications Graph</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">subscription-manager : Gestion des subscriptions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-gray-700 dark:text-gray-300">Traitement serverless ultra-rapide</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">🔄 Triggers PostgreSQL</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">Détection automatique via conversation_id</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">Mise à jour statut instantanée</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-gray-700 dark:text-gray-300">Zéro latence, zéro polling</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                ⚡ Avantages de l'architecture Supabase :
              </p>
              <div className="grid md:grid-cols-2 gap-3 text-blue-700 dark:text-blue-300 text-sm">
                <div>• Webhooks traités en &lt;200ms</div>
                <div>• Subscriptions auto-renouvelées</div>
                <div>• Détection instantanée des réponses</div>
                <div>• Résilience et haute disponibilité</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation technique */}
        <Card>
          <CardHeader>
            <CardTitle>Architecture Technique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">📡 Réception Webhooks</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div>• URL : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">supabase.co/functions/v1/webhook-handler</code></div>
                  <div>• Validation automatique des tokens Microsoft</div>
                  <div>• Traitement asynchrone pour performance</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">🔄 Gestion Subscriptions</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div>• URL : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">supabase.co/functions/v1/subscription-manager</code></div>
                  <div>• Renouvellement automatique toutes les 6h</div>
                  <div>• Actions : create, renew, status, cleanup</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">🗄️ Base de Données</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div>• Table : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">tracked_emails</code> - Emails suivis</div>
                  <div>• Table : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">received_messages</code> - Messages reçus</div>
                  <div>• Vue : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">email_stats</code> - Statistiques temps réel</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">⚡ Triggers PostgreSQL</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div>• Fonction : <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">detect_email_replies()</code></div>
                  <div>• Trigger sur insertion dans received_messages</div>
                  <div>• Détection via conversation_id + timestamps</div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">🔧 Configuration</h4>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs space-y-1 font-mono">
                <div>SUPABASE_URL = Projet Supabase configuré</div>
                <div>AZURE_CLIENT_ID = Application Microsoft Graph</div>
                <div>WEBHOOK_CLIENT_STATE = Clé de sécurité webhooks</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}