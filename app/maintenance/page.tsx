import { Wrench, Clock, ArrowRight } from "lucide-react"

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          
          {/* Icon & Animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-6 shadow-xl border border-blue-200 dark:border-blue-800 inline-block">
              <Wrench className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-bounce" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
              Maintenance en cours
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
              Nous améliorons l'application avec une nouvelle architecture plus performante
            </p>
          </div>

          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                Refonte Architecture en cours
              </span>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-gray-700 dark:text-gray-300">Migration vers Supabase Edge Functions</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-gray-700 dark:text-gray-300">Optimisation des webhooks Microsoft Graph</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" />
                <span className="text-gray-700 dark:text-gray-300">Interface temps réel simplifiée</span>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-blue-600 dark:text-blue-400 font-semibold mb-2">⚡ Performance</div>
              <div className="text-gray-600 dark:text-gray-400">Architecture serverless ultra-rapide</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-green-600 dark:text-green-400 font-semibold mb-2">🎯 Fiabilité</div>
              <div className="text-gray-600 dark:text-gray-400">Détection automatique 24/7</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-purple-600 dark:text-purple-400 font-semibold mb-2">📊 Temps Réel</div>
              <div className="text-gray-600 dark:text-gray-400">Mises à jour instantanées</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                Retour prévu sous 48h
              </span>
            </div>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              La nouvelle version sera plus rapide, plus fiable et plus simple à utiliser
            </p>
          </div>

          {/* Contact */}
          <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-6">
            <p>Questions ? Besoin d'aide urgente ?</p>
            <p className="font-medium">Contactez le support technique</p>
          </div>

        </div>
      </div>
    </div>
  )
}