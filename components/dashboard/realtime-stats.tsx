"use client"

import { useRealtime } from "./realtime-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MailIcon, ClockIcon, CheckCircleIcon, TrendingUpIcon } from "lucide-react"
import { useMemo } from "react"

export function RealtimeStats() {
  const { emails } = useRealtime()

  // Calculer les statistiques depuis les emails en temps réel
  const stats = useMemo(() => {
    return {
      pending: emails.filter(e => e.status === 'PENDING').length,
      replied: emails.filter(e => e.status === 'REPLIED').length,
      failed: emails.filter(e => e.status === 'FAILED').length,
      expired: emails.filter(e => e.status === 'EXPIRED').length,
      total: emails.length
    }
  }, [emails])

  const replyRate = stats.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <MailIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">emails envoyés</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En attente</CardTitle>
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <p className="text-xs text-muted-foreground">en cours de suivi</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Répondus</CardTitle>
          <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
          <p className="text-xs text-muted-foreground">
            {replyRate}% de taux de réponse
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Échecs</CardTitle>
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.failed + stats.expired}</div>
          <p className="text-xs text-muted-foreground">erreurs + expirés</p>
        </CardContent>
      </Card>
    </div>
  )
}