import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Wrench } from "lucide-react"

export default function ComposePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-16 px-4">
        
        {/* Page non disponible */}
        <div className="text-center space-y-8">
          
          {/* Icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-6 shadow-xl border border-amber-200 dark:border-amber-800 inline-block">
              <Wrench className="w-16 h-16 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Fonctionnalité temporairement désactivée
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              L'envoi d'emails est désactivé pendant la refonte de l'architecture. 
              Cette fonctionnalité sera réintégrée prochainement.
            </p>
          </div>

          {/* Informations */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5" />
                Nouvelle Architecture Supabase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-left">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300">Webhooks Microsoft Graph automatisés</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-gray-700 dark:text-gray-300">Détection des réponses en temps réel</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300">Interface d'envoi simplifiée (bientôt)</span>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Avantages de la nouvelle architecture :
                </p>
                <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                  <li>• Traitement serverless ultra-rapide</li>
                  <li>• Détection automatique sans polling</li>
                  <li>• Résilience et fiabilité améliorées</li>
                  <li>• Interface temps réel simplifiée</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Retour */}
          <div className="pt-8">
            <a 
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retour au tableau de bord
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}