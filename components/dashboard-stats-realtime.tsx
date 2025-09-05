'use client'

import { Activity, Mail, CheckCircle, XCircle, Clock, Wifi } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useEmailStats } from '@/hooks/use-email-tracking'

interface DashboardStatsRealtimeProps {
  initialStats?: Record<string, number>
  initialTotal?: number
}

/**
 * Composant temps réel pour les statistiques du dashboard
 * Utilise React Query et Supabase Realtime pour les mises à jour automatiques
 */
export function DashboardStatsRealtime({ 
  initialStats = { PENDING: 0, REPLIED: 0, STOPPED: 0, EXPIRED: 0 },
  initialTotal = 0
}: DashboardStatsRealtimeProps) {
  // Hook React Query avec temps réel
  const { data: emailStats = initialStats, isLoading } = useEmailStats(initialStats)
  
  const totalEmails = Object.values(emailStats).reduce((a, b) => a + b, 0)

  // Configuration des cartes de statistiques
  const statsConfig = [
    {
      title: "En attente",
      value: emailStats.PENDING,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      description: "Emails sans réponse"
    },
    {
      title: "Répondus",
      value: emailStats.REPLIED,
      icon: CheckCircle,
      color: "text-green-600", 
      bgColor: "bg-green-50 dark:bg-green-950/20",
      description: "Emails avec réponse"
    },
    {
      title: "Arrêtés",
      value: emailStats.STOPPED,
      icon: XCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20", 
      description: "Suivi interrompu"
    },
    {
      title: "Expirés",
      value: emailStats.EXPIRED,
      icon: Activity,
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-950/20",
      description: "Période de suivi écoulée"
    }
  ]

  return (
    <div className="space-y-3">
      {/* Indicateur temps réel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Wifi className="w-4 h-4 text-green-600" />
          <span>Synchronisation temps réel active</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Carte Total */}
        <Card className="border border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Total
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {isLoading ? '...' : totalEmails}
                  </p>
                  {isLoading && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Emails trackés
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Cartes des statuts */}
      {statsConfig.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className={`border-gray-200 ${stat.bgColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {stat.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={`text-xl font-bold ${stat.color}`}>
                      {isLoading ? '...' : stat.value}
                    </p>
                    {isLoading && (
                      <div className={`w-2 h-2 ${stat.color.replace('text-', 'bg-')} rounded-full animate-pulse`} />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {stat.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
      </div>
    </div>
  )
}