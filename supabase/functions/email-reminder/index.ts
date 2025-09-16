// ====================================================================================================
// SUPABASE EDGE FUNCTION: email-reminder (Version Application Permissions)
// ====================================================================================================
// Description: Gère les relances automatiques d'emails avec token d'application centralisé
// URL: https://[project-id].supabase.co/functions/v1/email-reminder
// Actions: schedule, send, status, test, process-pending
// ====================================================================================================

/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createCorsResponse } from '../_shared/cors.ts'

// Types Supabase
interface SupabaseUser {
  id: string
  email?: string
  [key: string]: unknown
}

interface ReminderConfig {
  enabled: boolean
  delays: Array<{
    value: number
    unit: 'hours' | 'days' | 'weeks'
    label: string
  }>
  templates: {
    [key: string]: string
  }
  work_hours: {
    start: string
    end: string
  }
  work_days: string[]
  max_reminders: number
}

interface EmailReminder {
  id: string
  tracked_email_id: string
  user_id: string | null
  reminder_number: number
  scheduled_for: string
  sent_at?: string
  compiled_message?: string
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED'
  created_at: string
  updated_at: string
}

interface TrackedEmail {
  id: string
  message_id: string
  subject: string
  recipient_email: string
  sender_email: string
  sent_at: string
  status: string
  user_id: string | null
  last_checked: string
  created_at: string
}

/**
 * Obtenir un token d'application via app-token-manager
 */
async function getApplicationToken(): Promise<string> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  if (!baseUrl) {
    throw new Error('SUPABASE_URL non configurée')
  }

  const tokenManagerUrl = `${baseUrl}/functions/v1/app-token-manager?action=get-token`

  const response = await fetch(tokenManagerUrl, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Erreur obtention token application:', error)
    throw new Error('Impossible d\'obtenir le token d\'application')
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Erreur token manager')
  }

  console.log('✅ Token d\'application obtenu via app-token-manager')
  return data.data.access_token
}

/**
 * Envoyer un email via Microsoft Graph
 */
async function sendEmailViaGraph(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  console.log(`📧 Envoi email: ${fromEmail} → ${toEmail}`)

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject: subject,
          body: {
            contentType: 'Text',
            content: body
          },
          toRecipients: [{
            emailAddress: {
              address: toEmail
            }
          }]
        },
        saveToSentItems: true
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Erreur envoi email Graph:', response.status, error)
    throw new Error(`Erreur envoi email: ${response.status} - ${error}`)
  }

  console.log('✅ Email envoyé avec succès via Microsoft Graph')
}

/**
 * Traiter toutes les relances en attente
 */
async function processPendingReminders(supabase: any): Promise<{processed: number, sent: number, failed: number}> {
  console.log('🔄 Traitement des relances en attente...')

  // Récupérer les relances à envoyer
  const { data: reminders, error } = await supabase
    .from('email_reminders')
    .select(`
      *,
      tracked_emails!inner(
        subject,
        recipient_email,
        sent_at
      )
    `)
    .eq('status', 'SCHEDULED')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50) // Limite de sécurité

  if (error) {
    console.error('❌ Erreur récupération relances:', error)
    throw new Error('Impossible de récupérer les relances')
  }

  if (!reminders || reminders.length === 0) {
    console.log('📭 Aucune relance à traiter')
    return { processed: 0, sent: 0, failed: 0 }
  }

  console.log(`📬 ${reminders.length} relance(s) à traiter`)

  // Obtenir le token d'application
  const accessToken = await getApplicationToken()

  const fromEmail = 'service-exploitation@karta-transit.ci'
  let sentCount = 0
  let failedCount = 0

  // Traiter chaque relance
  for (const reminder of reminders) {
    console.log(`\n📨 Traitement relance #${reminder.reminder_number} pour email ${reminder.tracked_email_id}`)

    try {
      const email = reminder.tracked_emails

      // Préparer le message de relance
      const subject = `Re: ${email.subject}`
      const body = reminder.compiled_message || `
Bonjour,

Je me permets de revenir vers vous concernant mon email du ${new Date(email.sent_at).toLocaleDateString('fr-FR')} au sujet de "${email.subject}".

N'ayant pas encore reçu de réponse, je me demandais si vous aviez eu l'occasion de le consulter.

Cordialement,
Service Exploitation Karta
      `.trim()

      // Envoyer l'email
      await sendEmailViaGraph(accessToken, fromEmail, email.recipient_email, subject, body)

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('email_reminders')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id)

      if (updateError) {
        console.error('⚠️ Erreur mise à jour statut:', updateError)
      } else {
        console.log('✅ Relance marquée comme envoyée')
        sentCount++
      }

    } catch (error) {
      console.error(`❌ Erreur envoi relance:`, error instanceof Error ? error.message : error)

      // Marquer comme échouée
      await supabase
        .from('email_reminders')
        .update({
          status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id)

      failedCount++
    }
  }

  const processed = reminders.length
  console.log(`\n📊 Traitement terminé: ${processed} relances traitées, ${sentCount} envoyées, ${failedCount} échouées`)

  return { processed, sent: sentCount, failed: failedCount }
}


// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

console.log('🔄 Email Reminder Function initialized')

serve(async (req: Request): Promise<Response> => {
  // Gérer CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
      }
    })
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return createCorsResponse({
        error: 'Authorization header manquant',
        message: 'Token Supabase requis'
      }, { status: 401 })
    }

    // Récupérer l'utilisateur Supabase
    const user = await getSupabaseUser(authHeader)
    if (!user) {
      return createCorsResponse({
        error: 'Utilisateur non authentifié',
        message: 'Token Supabase invalide'
      }, { status: 401 })
    }

    // Parser l'action demandée
    const url = new URL(req.url)
    let action = url.searchParams.get('action') || 'status'
    let targetEmailIds: string[] = []

    // Support du body pour les appels via supabase.functions.invoke
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        action = body.action || action
        targetEmailIds = body.target_email_ids || []
      } catch (_error) {
        console.log('📝 Pas de body JSON, utilisation des paramètres URL')
      }
    }

    console.log(`🎯 Action: ${action} pour utilisateur: ${user.id}`)

    // Router vers la bonne action
    switch (action) {
      case 'schedule':
        return await handleScheduleReminders(user, targetEmailIds)

      case 'send':
        return await handleSendReminders(user, targetEmailIds)

      case 'status':
        return await handleGetStatus(user)

      case 'test':
        return await handleTestReminder(user, targetEmailIds)

      case 'process-pending':
        return await handleProcessPending()

      default:
        return createCorsResponse({
          error: 'Action non supportée',
          available_actions: ['schedule', 'send', 'status', 'test', 'process-pending'],
          message: `Action '${action}' non reconnue`
        }, { status: 400 })
    }

  } catch (error: unknown) {
    console.error('❌ Erreur dans email-reminder:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// ACTION: Schedule - Programmer les relances pour les emails PENDING
// ====================================================================================================
async function handleScheduleReminders(user: SupabaseUser, targetEmailIds: string[]): Promise<Response> {
  try {
    console.log('📅 Programmation des relances')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer la config utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('reminder_config')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile?.reminder_config) {
      return createCorsResponse({
        error: 'Configuration relances non trouvée',
        message: 'Veuillez configurer vos paramètres de relances'
      }, { status: 400 })
    }

    const config = profile.reminder_config as ReminderConfig

    if (!config.enabled) {
      return createCorsResponse({
        success: true,
        message: 'Relances désactivées',
        scheduled: 0
      })
    }

    // Récupérer les emails candidats
    let query = supabase
      .from('tracked_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')

    // Filtrer par IDs spécifiques si fournis (pour les tests)
    if (targetEmailIds.length > 0) {
      query = query.in('id', targetEmailIds)
    }

    const { data: emails, error: emailsError } = await query

    if (emailsError) {
      throw new Error(`Erreur récupération emails: ${emailsError.message}`)
    }

    if (!emails || emails.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucun email candidat pour relances',
        scheduled: 0
      })
    }

    let scheduled = 0
    const details: Array<{
      email_id: string;
      subject: string;
      recipient?: string;
      existing_reminders?: number;
      new_reminders?: number;
      error?: string;
    }> = []

    // Pour chaque email, programmer les relances manquantes
    for (const email of emails as TrackedEmail[]) {
      try {
        // Vérifier les relances déjà existantes
        const { data: existingReminders } = await supabase
          .from('email_reminders')
          .select('reminder_number')
          .eq('tracked_email_id', email.id)
          .order('reminder_number')

        const existingNumbers = (existingReminders || []).map(r => r.reminder_number)
        const maxExisting = Math.max(0, ...existingNumbers)

        // Programmer les relances manquantes jusqu'au maximum configuré
        for (let reminderNum = maxExisting + 1; reminderNum <= config.max_reminders; reminderNum++) {
          // Calculer la date programmée
          const { data: scheduledDate, error: dateError } = await supabase
            .rpc('calculate_next_reminder_date', {
              p_user_id: user.id,
              p_reminder_number: reminderNum,
              p_base_date: email.sent_at
            })

          if (dateError) {
            console.error(`Erreur calcul date pour relance ${reminderNum}:`, dateError)
            continue
          }

          // Créer la relance
          const { error: insertError } = await supabase
            .from('email_reminders')
            .insert({
              tracked_email_id: email.id,
              user_id: user.id,
              reminder_number: reminderNum,
              scheduled_for: scheduledDate,
              status: 'SCHEDULED'
            })

          if (insertError) {
            console.error(`Erreur création relance ${reminderNum}:`, insertError)
            continue
          }

          scheduled++
          console.log(`✅ Relance ${reminderNum} programmée pour ${email.subject} à ${scheduledDate}`)
        }

        details.push({
          email_id: email.id,
          subject: email.subject,
          recipient: email.recipient_email,
          existing_reminders: existingNumbers.length,
          new_reminders: Math.max(0, config.max_reminders - maxExisting)
        })

      } catch (error) {
        console.error(`Erreur traitement email ${email.id}:`, error)
        details.push({
          email_id: email.id,
          subject: email.subject,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Programmation terminée',
      emails_processed: emails.length,
      reminders_scheduled: scheduled,
      details
    })

  } catch (error: unknown) {
    console.error('❌ Erreur programmation relances:', error)
    return createCorsResponse({
      error: 'Erreur programmation relances',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// ACTION: Send - Envoyer les relances dues
// ====================================================================================================
async function handleSendReminders(user: SupabaseUser, targetEmailIds: string[]): Promise<Response> {
  try {
    console.log('📤 Envoi des relances dues')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer les relances dues
    let query = supabase
      .from('email_reminders')
      .select(`
        *,
        tracked_emails!inner(message_id, subject, recipient_email, sender_email, sent_at, status)
      `)
      .eq('user_id', user.id)
      .eq('status', 'SCHEDULED')
      .lte('scheduled_for', new Date().toISOString())

    // Filtrer par emails spécifiques si fournis
    if (targetEmailIds.length > 0) {
      query = query.in('tracked_email_id', targetEmailIds)
    }

    const { data: reminders, error: remindersError } = await query

    if (remindersError) {
      throw new Error(`Erreur récupération relances: ${remindersError.message}`)
    }

    if (!reminders || reminders.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucune relance due à envoyer',
        sent: 0
      })
    }

    // Vérifier les heures de travail
    const isWorkingTime = await checkWorkingHours(user.id)
    if (!isWorkingTime) {
      return createCorsResponse({
        success: true,
        message: 'Hors heures de travail - relances reportées',
        sent: 0,
        postponed: reminders.length,
        working_hours: false
      })
    }

    let sent = 0
    let failed = 0
    const details: Array<{
      reminder_id: string;
      email_id?: string;
      email_subject?: string;
      recipient?: string;
      reminder_number?: number;
      status: 'sent' | 'failed';
      error?: string;
    }> = []

    // Traiter chaque relance due
    for (const reminder of reminders as (EmailReminder & { tracked_emails: TrackedEmail })[]) {
      try {
        const trackedEmail = reminder.tracked_emails

        // Vérifier que l'email est toujours PENDING (pas de réponse entre temps)
        if (trackedEmail.status !== 'PENDING') {
          console.log(`Email ${trackedEmail.subject} n'est plus PENDING, annulation de la relance`)

          await supabase
            .from('email_reminders')
            .update({ status: 'CANCELLED' })
            .eq('id', reminder.id)

          continue
        }

        console.log(`📧 Envoi relance ${reminder.reminder_number} pour: ${trackedEmail.subject}`)

        // Récupérer le token d'application Microsoft
        const accessToken = await getApplicationToken()
        if (!accessToken) {
          throw new Error('Token d\'application Microsoft indisponible')
        }

        // Compiler le template de la relance
        const { data: compiledMessage, error: templateError } = await supabase
          .rpc('compile_reminder_template', {
            p_user_id: user.id,
            p_reminder_number: reminder.reminder_number,
            p_tracked_email_id: reminder.tracked_email_id
          })

        if (templateError || !compiledMessage) {
          throw new Error(`Erreur compilation template: ${templateError?.message}`)
        }

        // Envoyer la relance comme réponse au message original
        const success = await sendReminderReply(accessToken, trackedEmail.message_id, compiledMessage)

        if (success) {
          // Marquer la relance comme envoyée
          await supabase
            .from('email_reminders')
            .update({
              status: 'SENT',
              sent_at: new Date().toISOString(),
              compiled_message: compiledMessage
            })
            .eq('id', reminder.id)

          // Programmer la prochaine relance si nécessaire
          if (reminder.reminder_number < await getMaxReminders(user.id)) {
            await scheduleNextReminder(user.id, reminder.tracked_email_id, reminder.reminder_number + 1)
          }

          // Log de succès
          await logWebhookEvent(supabase, 'reminder_sent', {
            reminder_id: reminder.id,
            email_subject: trackedEmail.subject,
            recipient: trackedEmail.recipient_email,
            reminder_number: reminder.reminder_number,
            success: true
          })

          console.log(`✅ Relance ${reminder.reminder_number} envoyée pour ${trackedEmail.subject}`)
          sent++

          details.push({
            reminder_id: reminder.id,
            email_subject: trackedEmail.subject,
            recipient: trackedEmail.recipient_email,
            reminder_number: reminder.reminder_number,
            status: 'sent'
          })

        } else {
          throw new Error('Échec envoi via Microsoft Graph')
        }

      } catch (error: unknown) {
        console.error(`❌ Erreur envoi relance ${reminder.id}:`, error)

        // Marquer comme échoué
        await supabase
          .from('email_reminders')
          .update({
            status: 'FAILED'
          })
          .eq('id', reminder.id)

        // Log d'erreur
        await logWebhookEvent(supabase, 'reminder_failed', {
          reminder_id: reminder.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        failed++
        details.push({
          reminder_id: reminder.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Envoi terminé',
      working_hours: isWorkingTime,
      total_due: reminders.length,
      sent,
      failed,
      details
    })

  } catch (error: unknown) {
    console.error('❌ Erreur envoi relances:', error)
    return createCorsResponse({
      error: 'Erreur envoi relances',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// ACTION: Status - Obtenir le statut des relances
// ====================================================================================================
async function handleGetStatus(user: SupabaseUser): Promise<Response> {
  try {
    console.log('📊 Récupération du statut des relances')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Statistiques générales
    const { data: stats } = await supabase
      .from('email_reminders')
      .select('status')
      .eq('user_id', user.id)

    const remindersStats = {
      total: stats?.length || 0,
      scheduled: stats?.filter(s => s.status === 'SCHEDULED').length || 0,
      sent: stats?.filter(s => s.status === 'SENT').length || 0,
      cancelled: stats?.filter(s => s.status === 'CANCELLED').length || 0,
      failed: stats?.filter(s => s.status === 'FAILED').length || 0
    }

    // Configuration utilisateur
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('reminder_config')
      .eq('auth_user_id', user.id)
      .single()

    // Prochaines relances dues
    const { data: upcoming } = await supabase
      .from('upcoming_reminders')
      .select('*')
      .limit(10)

    // Vérifier les heures de travail actuelles
    const workingHours = await checkWorkingHours(user.id)

    return createCorsResponse({
      user_id: user.id,
      working_hours: workingHours,
      configuration: profile?.reminder_config || null,
      statistics: remindersStats,
      upcoming_reminders: upcoming || [],
      last_update: new Date().toISOString()
    })

  } catch (error: unknown) {
    console.error('❌ Erreur statut relances:', error)
    return createCorsResponse({
      error: 'Erreur récupération statut',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// ACTION: Test - Tester une relance sur un email spécifique
// ====================================================================================================
async function handleTestReminder(user: SupabaseUser, targetEmailIds: string[]): Promise<Response> {
  try {
    console.log('🧪 Test de relance')

    if (targetEmailIds.length === 0) {
      return createCorsResponse({
        error: 'Email ID requis pour test',
        message: 'Spécifiez target_email_ids dans le body'
      }, { status: 400 })
    }

    // Pour les tests, on programme et envoie immédiatement
    const scheduleResult = await handleScheduleReminders(user, targetEmailIds)
    if (!scheduleResult.ok) return scheduleResult

    const sendResult = await handleSendReminders(user, targetEmailIds)
    return sendResult

  } catch (error: unknown) {
    console.error('❌ Erreur test relance:', error)
    return createCorsResponse({
      error: 'Erreur test relance',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// FONCTIONS UTILITAIRES
// ====================================================================================================

/**
 * Récupère l'utilisateur Supabase depuis le token
 */
async function getSupabaseUser(authHeader: string): Promise<SupabaseUser | null> {
  try {
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('❌ Utilisateur Supabase non valide:', error)
      return null
    }

    return user as unknown as SupabaseUser
  } catch (error) {
    console.error('❌ Erreur vérification utilisateur:', error)
    return null
  }
}

/**
 * Vérifier si nous sommes dans les heures de travail
 */
async function checkWorkingHours(userId: string): Promise<boolean> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('reminder_config')
      .eq('auth_user_id', userId)
      .single()

    if (!profile?.reminder_config) return true // Par défaut, toujours OK

    const config = profile.reminder_config as ReminderConfig
    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentHour = now.getHours()

    const workStartHour = parseInt(config.work_hours.start.split(':')[0])
    const workEndHour = parseInt(config.work_hours.end.split(':')[0])

    const isWorkDay = config.work_days.includes(currentDay)
    const isWorkHour = currentHour >= workStartHour && currentHour <= workEndHour

    return isWorkDay && isWorkHour
  } catch (error) {
    console.error('❌ Erreur vérification heures de travail:', error)
    return false
  }
}


/**
 * Envoyer une relance comme réponse au message original
 */
async function sendReminderReply(accessToken: string, messageId: string, content: string): Promise<boolean> {
  try {
    console.log(`📧 Envoi relance pour message: ${messageId}`)

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comment: content
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur envoi relance Graph:', response.status, errorText)
      return false
    }

    console.log('✅ Relance envoyée avec succès via Microsoft Graph')
    return true

  } catch (error: unknown) {
    console.error('❌ Erreur envoi relance:', error)
    return false
  }
}

/**
 * Programmer la prochaine relance
 */
async function scheduleNextReminder(userId: string, trackedEmailId: string, reminderNumber: number): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: scheduledDate, error: dateError } = await supabase
      .rpc('calculate_next_reminder_date', {
        p_user_id: userId,
        p_reminder_number: reminderNumber,
        p_base_date: new Date().toISOString()
      })

    if (dateError) {
      console.error('Erreur calcul prochaine date:', dateError)
      return
    }

    await supabase
      .from('email_reminders')
      .insert({
        tracked_email_id: trackedEmailId,
        user_id: userId,
        reminder_number: reminderNumber,
        scheduled_for: scheduledDate,
        status: 'SCHEDULED'
      })

    console.log(`✅ Prochaine relance ${reminderNumber} programmée pour ${scheduledDate}`)
  } catch (error) {
    console.error('Erreur programmation prochaine relance:', error)
  }
}

/**
 * Récupérer le nombre maximum de relances pour un utilisateur
 */
async function getMaxReminders(userId: string): Promise<number> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('reminder_config')
      .eq('auth_user_id', userId)
      .single()

    return (profile?.reminder_config as ReminderConfig)?.max_reminders || 3
  } catch (error) {
    console.error('Erreur récupération max reminders:', error)
    return 3
  }
}

/**
 * Logger un événement dans webhook_events
 */
async function logWebhookEvent(supabase: any, changeType: string, data: unknown): Promise<void> {
  try {
    await supabase
      .from('webhook_events')
      .insert({
        subscription_id: 'email-reminder',
        change_type: changeType,
        processed: true,
        processed_at: new Date().toISOString(),
        raw_notification: data
      })
  } catch (error) {
    console.error('Erreur log webhook event:', error)
  }
}

/**
 * Handler pour traiter toutes les relances en attente (sans authentification utilisateur)
 */
async function handleProcessPending(): Promise<Response> {
  try {
    console.log('🔄 handleProcessPending: traitement des relances en attente')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const results = await processPendingReminders(supabase)

    return createCorsResponse({
      success: true,
      message: 'Traitement des relances terminé',
      data: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erreur handleProcessPending:', error)
    return createCorsResponse({
      success: false,
      error: 'Erreur traitement des relances',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

console.log('🚀 Email Reminder Function v2.0 ready - Application permissions')