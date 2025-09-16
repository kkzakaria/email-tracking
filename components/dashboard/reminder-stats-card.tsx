"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  TrendingUp
} from "lucide-react"

interface ReminderStats {
  total: number
  scheduled: number
  sent: number
  cancelled: number
  failed: number
}

interface UpcomingReminder {
  id: string
  reminder_number: number
  scheduled_for: string
  subject: string
  recipient_email: string
  sender_name: string
  hours_until_due: number
}

export function ReminderStatsCard() {
  const [stats, setStats] = useState<ReminderStats>({
    total: 0,
    scheduled: 0,
    sent: 0,
    cancelled: 0,
    failed: 0
  })
  const [upcoming, setUpcoming] = useState<UpcomingReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const supabase = createClient()

  // Fonction pour charger les statistiques
  const loadStats = async () => {
    try {
      setIsLoading(true)

      // Récupérer les statistiques des relances
      const { data: reminderStats, error: statsError } = await supabase
        .from('email_reminders')
        .select('status')

      if (statsError) {
        console.error('Erreur récupération stats relances:', statsError)
        return
      }

      // Calculer les statistiques
      const total = reminderStats?.length || 0
      const scheduled = reminderStats?.filter(r => r.status === 'SCHEDULED').length || 0
      const sent = reminderStats?.filter(r => r.status === 'SENT').length || 0
      const cancelled = reminderStats?.filter(r => r.status === 'CANCELLED').length || 0
      const failed = reminderStats?.filter(r => r.status === 'FAILED').length || 0

      setStats({ total, scheduled, sent, cancelled, failed })

      // Récupérer les prochaines relances
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('upcoming_reminders')
        .select('*')
        .limit(5)

      if (upcomingError) {
        console.error('Erreur récupération relances à venir:', upcomingError)
        return
      }

      setUpcoming(upcomingData || [])
      setLastUpdate(new Date())

    } catch (error) {
      console.error('Erreur chargement stats relances:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Charger les stats au montage
  useEffect(() => {
    loadStats()

    // Actualiser toutes les 30 secondes
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fonction pour formater le délai
  const formatTimeUntilDue = (hours: number): string => {
    if (hours < 0) return 'En retard'
    if (hours < 1) return `${Math.round(hours * 60)} min`
    if (hours < 24) return `${Math.round(hours)} h`
    return `${Math.round(hours / 24)} j`
  }

  // Fonction pour obtenir la couleur du badge selon le délai
  const getTimeUntilBadgeVariant = (hours: number): "default" | "secondary" | "destructive" | "outline" => {
    if (hours < 0) return 'destructive'
    if (hours < 2) return 'default'
    if (hours < 24) return 'secondary'
    return 'outline'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Relances automatiques
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadStats}
          disabled={isLoading}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Statistiques principales */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total relances</span>
            <Badge variant="outline" className="font-mono">
              {stats.total}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Programmées
            </span>
            <Badge variant="secondary" className="font-mono">
              {stats.scheduled}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Envoyées
            </span>
            <Badge variant="default" className="font-mono">
              {stats.sent}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Annulées
            </span>
            <Badge variant="outline" className="font-mono">
              {stats.cancelled}
            </Badge>
          </div>

          {stats.failed > 0 && (
            <>
              <div className="flex items-center justify-between col-span-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Échouées
                </span>
                <Badge variant="destructive" className="font-mono">
                  {stats.failed}
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* Taux d'efficacité */}
        {stats.total > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Taux de réussite
              </span>
              <span className="font-medium">
                {Math.round((stats.sent / (stats.sent + stats.failed)) * 100) || 0}%
              </span>
            </div>
          </div>
        )}

        {/* Prochaines relances */}
        {upcoming.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Prochaines relances</span>
            </div>

            <div className="space-y-2">
              {upcoming.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between text-xs bg-muted/50 rounded-lg p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {reminder.subject}
                    </div>
                    <div className="text-muted-foreground truncate">
                      vers {reminder.recipient_email}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="outline" className="text-xs">
                      #{reminder.reminder_number}
                    </Badge>
                    <Badge
                      variant={getTimeUntilBadgeVariant(reminder.hours_until_due)}
                      className="text-xs"
                    >
                      {formatTimeUntilDue(reminder.hours_until_due)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pas de relances programmées */}
        {stats.scheduled === 0 && upcoming.length === 0 && !isLoading && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
            Aucune relance programmée
          </div>
        )}

        {/* Dernière mise à jour */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}