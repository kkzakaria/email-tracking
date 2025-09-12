'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/utils/supabase/client'

interface ReminderStats {
  total_reminders: number
  scheduled: number
  sent: number
  failed: number
  dry_runs: number
  test_mode_count: number
}

export function ReminderStats() {
  const [stats, setStats] = useState<ReminderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabase
        .from('test_reminder_stats')
        .select('*')
        .single()

      if (dbError) {
        // Si la vue n'existe pas encore ou est vide, utiliser des valeurs par défaut
        console.warn('Stats non disponibles:', dbError)
        setStats({
          total_reminders: 0,
          scheduled: 0,
          sent: 0,
          failed: 0,
          dry_runs: 0,
          test_mode_count: 0
        })
        return
      }

      setStats(data)
    } catch (err) {
      console.error('Erreur chargement stats:', err)
      setError('Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 text-sm">
        <p>{error}</p>
        <button 
          onClick={loadStats}
          className="mt-2 text-xs underline hover:no-underline"
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 text-sm">
        <p>Aucune statistique disponible</p>
      </div>
    )
  }

  const statItems = [
    {
      label: 'Total',
      value: stats.total_reminders,
      color: 'bg-gray-100 text-gray-800'
    },
    {
      label: 'Programmées',
      value: stats.scheduled,
      color: 'bg-blue-100 text-blue-800'
    },
    {
      label: 'Envoyées',
      value: stats.sent,
      color: 'bg-green-100 text-green-800'
    },
    {
      label: 'Échecs',
      value: stats.failed,
      color: 'bg-red-100 text-red-800'
    },
    {
      label: 'Simulations',
      value: stats.dry_runs,
      color: 'bg-yellow-100 text-yellow-800'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item) => (
          <div key={item.label} className="text-center">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.color}`}>
              {item.value}
            </div>
            <p className="text-xs text-gray-600 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Indicateurs de mode */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">Mode test:</span>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
            {stats.test_mode_count}/{stats.total_reminders}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">Taux de succès:</span>
          <span className="font-medium">
            {stats.total_reminders > 0 
              ? Math.round(((stats.sent + stats.dry_runs) / stats.total_reminders) * 100)
              : 0}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-3">
        <button 
          onClick={loadStats}
          className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          🔄 Actualiser les stats
        </button>
      </div>
    </div>
  )
}