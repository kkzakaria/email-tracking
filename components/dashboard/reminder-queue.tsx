'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ReminderQueueItem {
  id: string
  tracked_email_id: string
  subject: string
  recipient_email: string
  sent_at: string
  reminder_count: number
  max_reminders: number
  next_reminder_due_at: string
  status: string
  dry_run: boolean
  test_mode: boolean
  hours_until_due: number
}

export function ReminderQueue() {
  const [queue, setQueue] = useState<ReminderQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabase
        .from('test_reminder_queue')
        .select('*')
        .order('next_reminder_due_at', { ascending: true })
        .limit(20)

      if (dbError) {
        throw new Error(dbError.message)
      }

      setQueue(data || [])
    } catch (err) {
      console.error('Erreur chargement queue:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800'
      case 'SENT':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getUrgencyColor = (hoursUntilDue: number) => {
    if (hoursUntilDue < 0) return 'bg-red-100 text-red-800' // En retard
    if (hoursUntilDue < 2) return 'bg-orange-100 text-orange-800' // Urgent
    if (hoursUntilDue < 24) return 'bg-yellow-100 text-yellow-800' // Bientôt
    return 'bg-gray-100 text-gray-600' // Plus tard
  }

  const formatTimeUntilDue = (hoursUntilDue: number) => {
    if (hoursUntilDue < 0) {
      return `En retard de ${Math.abs(Math.round(hoursUntilDue))}h`
    }
    if (hoursUntilDue < 1) {
      return `Dans ${Math.round(hoursUntilDue * 60)} min`
    }
    if (hoursUntilDue < 24) {
      return `Dans ${Math.round(hoursUntilDue)}h`
    }
    return `Dans ${Math.round(hoursUntilDue / 24)} jour(s)`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 text-sm">
        <p>Erreur: {error}</p>
        <Button onClick={loadQueue} size="sm" variant="outline" className="mt-2">
          Réessayer
        </Button>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="text-sm">Aucune relance programmée</p>
        <Button onClick={loadQueue} size="sm" variant="outline" className="mt-2">
          🔄 Actualiser
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {queue.length} relance(s) en attente
        </p>
        <Button onClick={loadQueue} size="sm" variant="outline">
          🔄 Actualiser
        </Button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {queue.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.subject}
                </p>
                <p className="text-xs text-gray-500">
                  📧 {item.recipient_email}
                </p>
              </div>
              
              <div className="flex flex-col items-end space-y-1 ml-2">
                <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                  {item.status}
                </Badge>
                
                {item.test_mode && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800">
                    TEST
                  </Badge>
                )}
                
                {item.dry_run && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800">
                    DRY RUN
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-500">
              <div className="space-x-3">
                <span>
                  📊 {item.reminder_count}/{item.max_reminders} relances
                </span>
                <span>
                  📅 Envoyé {formatDistanceToNow(new Date(item.sent_at), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </span>
              </div>
            </div>

            <div className="mt-2 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                📅 {new Date(item.next_reminder_due_at).toLocaleString('fr-FR')}
              </span>
              
              <Badge className={`text-xs ${getUrgencyColor(item.hours_until_due)}`}>
                {formatTimeUntilDue(item.hours_until_due)}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="border-t pt-3">
        <p className="text-xs text-gray-500 mb-2">Légende des urgences:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-red-100 text-red-800">En retard</Badge>
          <Badge className="bg-orange-100 text-orange-800">Urgent (&lt;2h)</Badge>
          <Badge className="bg-yellow-100 text-yellow-800">Bientôt (&lt;24h)</Badge>
          <Badge className="bg-gray-100 text-gray-600">Plus tard</Badge>
        </div>
      </div>
    </div>
  )
}