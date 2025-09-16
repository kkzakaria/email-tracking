"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { EmailsTable } from "./emails-table"
import type { Database } from "@/types/database.types"

type TrackedEmail = Database["public"]["Tables"]["tracked_emails"]["Row"]
type EmailReminder = Database["public"]["Tables"]["email_reminders"]["Row"]

type TrackedEmailWithReminders = TrackedEmail & {
  reminders?: {
    total: number
    scheduled: number
    sent: number
    failed: number
    cancelled: number
  }
}

interface EmailsWithRemindersTableProps {
  data: TrackedEmail[]
  onRefresh?: () => void
  isLoading?: boolean
}

export function EmailsWithRemindersTable({
  data,
  onRefresh,
  isLoading = false
}: EmailsWithRemindersTableProps) {
  const [enrichedData, setEnrichedData] = useState<TrackedEmailWithReminders[]>([])
  const [isEnriching, setIsEnriching] = useState(false)
  const supabase = createClient()

  // Fonction pour enrichir les données avec les informations de relances
  const enrichWithReminders = async (emails: TrackedEmail[]) => {
    if (emails.length === 0) {
      setEnrichedData([])
      return
    }

    setIsEnriching(true)
    try {
      // Si trop d'emails, on affiche sans enrichissement pour éviter les erreurs
      if (emails.length > 100) {
        console.log('⚠️ Trop d\'emails pour enrichir avec les relances, affichage sans enrichissement')
        console.log('📊 Nombre d\'emails à afficher:', emails.length)
        console.log('🔍 Premier email:', emails[0]?.subject || 'aucun')
        setEnrichedData(emails.map(email => ({ ...email })))
        setIsEnriching(false)
        return
      }

      // Récupérer toutes les relances pour les emails
      const emailIds = emails.map(email => email.id)

      // Log pour debug
      console.log('📊 Tentative de récupération des relances pour', emailIds.length, 'emails')

      const { data: reminders, error } = await supabase
        .from('email_reminders')
        .select('tracked_email_id, status')
        .in('tracked_email_id', emailIds)

      if (error) {
        console.error('Erreur récupération relances:', error)
        // En cas d'erreur, on affiche les emails sans les stats de relances
        setEnrichedData(emails.map(email => ({ ...email })))
        return
      }

      // Grouper les relances par email
      const remindersByEmail = new Map<string, EmailReminder[]>()
      reminders?.forEach(reminder => {
        const emailId = reminder.tracked_email_id
        if (!remindersByEmail.has(emailId)) {
          remindersByEmail.set(emailId, [])
        }
        remindersByEmail.get(emailId)!.push(reminder)
      })

      // Enrichir les données
      const enriched: TrackedEmailWithReminders[] = emails.map(email => {
        const emailReminders = remindersByEmail.get(email.id) || []

        if (emailReminders.length === 0) {
          return { ...email }
        }

        const reminderStats = {
          total: emailReminders.length,
          scheduled: emailReminders.filter(r => r.status === 'SCHEDULED').length,
          sent: emailReminders.filter(r => r.status === 'SENT').length,
          failed: emailReminders.filter(r => r.status === 'FAILED').length,
          cancelled: emailReminders.filter(r => r.status === 'CANCELLED').length,
        }

        return {
          ...email,
          reminders: reminderStats
        }
      })

      setEnrichedData(enriched)
    } catch (error) {
      console.error('Erreur enrichissement données:', error)
      setEnrichedData(emails.map(email => ({ ...email })))
    } finally {
      setIsEnriching(false)
    }
  }

  // Enrichir les données quand elles changent
  useEffect(() => {
    console.log('🔄 EmailsWithRemindersTable: data changed, length:', data.length)
    enrichWithReminders(data)
  }, [data])

  // Log l'état enrichi
  useEffect(() => {
    console.log('📋 EmailsWithRemindersTable: enrichedData updated, length:', enrichedData.length)
  }, [enrichedData])

  return (
    <EmailsTable
      data={enrichedData}
      onRefresh={onRefresh}
      isLoading={isLoading || isEnriching}
    />
  )
}