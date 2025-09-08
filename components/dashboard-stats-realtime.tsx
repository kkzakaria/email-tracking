'use client'

import { Activity, Mail, CheckCircle, XCircle, Clock, Wifi } from 'lucide-react'
import { Card } from '@/components/ui/card'
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
    <div className="space-y-2">
      {/* Indicateur temps réel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <Wifi className="w-3 h-3 text-green-600" />
          <span>Synchronisation temps réel</span>
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {/* Carte Total */}
        <Card className="flex-shrink-0 min-w-[140px] border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-2 py-1.5">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-base font-bold text-blue-900 dark:text-blue-100 leading-none">
                Total
              </p>
              <div className="flex items-center gap-1">
                <p className="text-base font-bold text-blue-600 dark:text-blue-400 leading-none">
                  {isLoading ? '...' : totalEmails}
                </p>
                {isLoading && (
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                )}
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-none">
                Emails trackés
              </p>
            </div>
          </div>
        </Card>

      {/* Cartes des statuts */}
      {statsConfig.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className={`flex-shrink-0 min-w-[140px] border-gray-200 ${stat.bgColor} px-2 py-1.5`}>
            <div className="flex items-center space-x-2">
              <div className={`p-1 bg-white/60 dark:bg-gray-800/60 rounded`}>
                <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-none">
                  {stat.title}
                </p>
                <div className="flex items-center gap-1">
                  <p className={`text-base font-bold ${stat.color} leading-none`}>
                    {isLoading ? '...' : stat.value}
                  </p>
                  {isLoading && (
                    <div className={`w-1.5 h-1.5 ${stat.color.replace('text-', 'bg-')} rounded-full animate-pulse`} />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate leading-none">
                  {stat.description}
                </p>
              </div>
            </div>
          </Card>
        )
      })}
      </div>
    </div>
  )
}