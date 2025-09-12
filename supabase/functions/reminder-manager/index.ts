// ====================================================================================================
// SUPABASE EDGE FUNCTION: reminder-manager (MODE TEST)
// ====================================================================================================
// Description: Gère les relances automatiques d'emails avec mode test isolé et debugging
// URL: https://[project-id].supabase.co/functions/v1/reminder-manager
// Mode: Test isolé pour debugging sans impact sur production
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse } from '../_shared/cors.ts'

// Types Supabase
interface SupabaseUser {
  id: string
  email?: string
  [key: string]: unknown
}

interface TestEmailReminder {
  id: string
  tracked_email_id: string
  user_id: string
  reminder_count: number
  max_reminders: number
  next_reminder_due_at: string
  last_reminder_sent_at?: string
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'CANCELLED' | 'COMPLETED'
  template_content: string
  test_mode: boolean
  dry_run: boolean
  debug_logs: any[]
}

interface TrackedEmailForReminder {
  tracked_email_id: string
  message_id: string
  subject: string
  recipient_email: string
  sent_at: string
  days_elapsed: number
  current_reminder_count: number
  max_reminders: number
}

interface ReminderSettings {
  id: string
  user_id: string
  default_delay_hours: number
  reminder_interval_hours: number
  max_reminders_per_email: number
  work_hours_start: string
  work_hours_end: string
  work_days: string[]
  timezone: string
  reminder_enabled: boolean
  test_mode: boolean
  default_template: string
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

console.log('🧪 Reminder Manager TEST MODE initialized')

serve(async (req: Request) => {
  // Gérer la requête OPTIONS pour le preflight CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Vérifier l'authentification utilisateur
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

    const url = new URL(req.url)
    let action = url.searchParams.get('action') || 'status'
    let testEmailIds: string[] = []
    let dryRun = url.searchParams.get('dry_run') === 'true'
    
    // Si pas d'action dans l'URL, vérifier le body pour les appels via supabase.functions.invoke
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        action = body.action || action
        testEmailIds = body.test_email_ids || []
        dryRun = body.dry_run ?? dryRun
      } catch (error) {
        console.log(`📝 Pas de body JSON, utilisation des paramètres URL : ${error}`)
      }
    }
    
    console.log(`🧪 ${req.method} ${req.url}`)
    console.log('🎯 Action demandée:', action, 'pour user:', user.id, 'dry_run:', dryRun)

    // ================================================================================================
    // ACTIONS DISPONIBLES EN MODE TEST
    // ================================================================================================
    switch (action) {
      case 'check':
        return await handleCheckReminders(user, testEmailIds, dryRun)
      
      case 'send':
        return await handleSendReminders(user, testEmailIds, dryRun)
      
      case 'status':
        return await handleGetStatus(user)
      
      case 'configure':
        return await handleConfigureSettings(user, req)
      
      case 'test_working_hours':
        return await handleTestWorkingHours(user)
        
      case 'schedule_test':
        return await handleScheduleTestReminder(user, testEmailIds, dryRun)
      
      default:
        return createCorsResponse({
          error: 'Action non supportée',
          availableActions: ['check', 'send', 'status', 'configure', 'test_working_hours', 'schedule_test']
        }, { status: 400 })
    }

  } catch (error: unknown) {
    console.error('❌ Erreur dans reminder manager:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// VÉRIFIER ET PROGRAMMER LES RELANCES (MODE TEST)
// ====================================================================================================
async function handleCheckReminders(user: SupabaseUser, testEmailIds: string[], dryRun: boolean): Promise<Response> {
  try {
    console.log('🔍 Vérification des emails pour relances - Mode TEST')
    console.log('📧 Test Email IDs:', testEmailIds.length > 0 ? testEmailIds : 'TOUS les emails PENDING')
    console.log('🧪 Dry run:', dryRun)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer la configuration utilisateur
    const { data: settings } = await supabase
      .from('test_reminder_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!settings) {
      console.log('⚙️ Création des paramètres par défaut pour user:', user.id)
      const { data: newSettings, error } = await supabase
        .from('test_reminder_settings')
        .insert({ user_id: user.id })
        .select()
        .single()
        
      if (error || !newSettings) {
        throw new Error(`Erreur création paramètres: ${error?.message}`)
      }
    }

    // Récupérer les emails candidats pour relances
    const emailIdsParam = testEmailIds.length > 0 ? testEmailIds : null
    const { data: candidateEmails, error } = await supabase.rpc('get_test_emails_for_reminders', {
      p_user_id: user.id,
      p_test_email_ids: emailIdsParam
    })

    if (error) {
      throw new Error(`Erreur récupération emails candidats: ${error.message}`)
    }

    console.log(`📋 ${candidateEmails?.length || 0} emails candidats pour relances`)

    if (!candidateEmails || candidateEmails.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucun email candidat pour relances',
        candidates: 0,
        test_mode: true,
        dry_run: dryRun
      }, { status: 200 })
    }

    // Vérifier les heures de travail
    const isWorkingTime = await checkWorkingHours(user.id)
    console.log('⏰ Dans les heures de travail:', isWorkingTime)

    let scheduled = 0
    let skipped = 0
    const details: any[] = []

    // Traiter chaque email candidat
    for (const email of candidateEmails as TrackedEmailForReminder[]) {
      try {
        console.log(`📨 Traitement email: ${email.subject} -> ${email.recipient_email}`)
        console.log(`🔢 Relances actuelles: ${email.current_reminder_count}/${email.max_reminders}`)
        console.log(`📅 Envoyé il y a ${email.days_elapsed} jours`)

        // Programmer la relance
        const { data: reminderId, error: scheduleError } = await supabase.rpc('schedule_test_reminder', {
          p_user_id: user.id,
          p_tracked_email_id: email.tracked_email_id,
          p_dry_run: dryRun
        })

        if (scheduleError) {
          console.error(`❌ Erreur programmation relance pour ${email.message_id}:`, scheduleError)
          skipped++
          details.push({
            email_id: email.tracked_email_id,
            subject: email.subject,
            recipient: email.recipient_email,
            status: 'error',
            error: scheduleError.message
          })
          continue
        }

        console.log(`✅ Relance programmée pour ${email.subject} (ID: ${reminderId})`)
        scheduled++

        details.push({
          email_id: email.tracked_email_id,
          subject: email.subject,
          recipient: email.recipient_email,
          days_elapsed: email.days_elapsed,
          reminder_count: email.current_reminder_count,
          status: 'scheduled',
          reminder_id: reminderId,
          working_hours: isWorkingTime,
          dry_run: dryRun
        })

      } catch (error: unknown) {
        console.error(`❌ Erreur traitement email ${email.message_id}:`, error)
        skipped++
        details.push({
          email_id: email.tracked_email_id,
          subject: email.subject,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Vérification terminée',
      test_mode: true,
      candidates: candidateEmails.length,
      scheduled,
      skipped,
      working_hours: isWorkingTime,
      dry_run: dryRun,
      details
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur vérification relances:', error)
    return createCorsResponse({
      error: 'Erreur vérification relances',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// ENVOYER LES RELANCES DUES (MODE TEST)
// ====================================================================================================
async function handleSendReminders(user: SupabaseUser, testEmailIds: string[], dryRun: boolean): Promise<Response> {
  try {
    console.log('📤 Envoi des relances dues - Mode TEST')
    console.log('🧪 Dry run:', dryRun)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer les relances dues
    let query = supabase
      .from('test_email_reminders')
      .select(`
        *,
        tracked_emails!inner(message_id, subject, recipient_email, sender_email, sent_at)
      `)
      .eq('user_id', user.id)
      .eq('status', 'SCHEDULED')
      .lte('next_reminder_due_at', new Date().toISOString())

    // Filtrer par email IDs si spécifiés
    if (testEmailIds.length > 0) {
      query = query.in('tracked_email_id', testEmailIds)
    }

    const { data: reminders, error } = await query

    if (error) {
      throw new Error(`Erreur récupération relances dues: ${error.message}`)
    }

    console.log(`📋 ${reminders?.length || 0} relances dues à envoyer`)

    if (!reminders || reminders.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucune relance due à envoyer',
        sent: 0,
        test_mode: true,
        dry_run: dryRun
      }, { status: 200 })
    }

    // Vérifier les heures de travail
    const isWorkingTime = await checkWorkingHours(user.id)
    console.log('⏰ Dans les heures de travail:', isWorkingTime)

    if (!isWorkingTime && !dryRun) {
      console.log('⏸️ Hors heures de travail - relances reportées')
      return createCorsResponse({
        success: true,
        message: 'Hors heures de travail - relances reportées',
        sent: 0,
        postponed: reminders.length,
        working_hours: false,
        test_mode: true
      }, { status: 200 })
    }

    let sent = 0
    let failed = 0
    const details: any[] = []

    // Traiter chaque relance due
    for (const reminder of reminders as TestEmailReminder[]) {
      try {
        const trackedEmail = (reminder as any).tracked_emails
        console.log(`📧 Envoi relance pour: ${trackedEmail.subject} -> ${trackedEmail.recipient_email}`)

        if (dryRun) {
          // Mode simulation - ne pas envoyer réellement
          console.log('🧪 DRY RUN - Simulation d\'envoi sans envoi réel')
          
          // Mettre à jour les logs de debug
          const debugLog = {
            action: 'dry_run_send',
            timestamp: new Date().toISOString(),
            message_id: trackedEmail.message_id,
            template_preview: reminder.template_content.substring(0, 100) + '...',
            working_hours: isWorkingTime
          }

          await supabase
            .from('test_email_reminders')
            .update({
              debug_logs: [...reminder.debug_logs, debugLog],
              updated_at: new Date().toISOString()
            })
            .eq('id', reminder.id)

          sent++
          details.push({
            reminder_id: reminder.id,
            email_subject: trackedEmail.subject,
            recipient: trackedEmail.recipient_email,
            status: 'dry_run_success',
            message: 'Simulation réussie - pas d\'envoi réel'
          })

        } else {
          // Mode réel - récupérer le token Microsoft et envoyer
          const accessToken = await getUserMicrosoftToken(user.id)
          if (!accessToken) {
            throw new Error('Token Microsoft manquant - reconnexion requise')
          }

          // Compiler le template
          const compiledContent = compileReminderTemplate(
            reminder.template_content,
            trackedEmail,
            reminder.reminder_count + 1
          )

          // Envoyer la relance comme réponse au message original
          const success = await sendReminderReply(accessToken, trackedEmail.message_id, compiledContent)

          if (success) {
            // Mettre à jour le statut de la relance
            await supabase
              .from('test_email_reminders')
              .update({
                status: 'SENT',
                reminder_count: reminder.reminder_count + 1,
                last_reminder_sent_at: new Date().toISOString(),
                next_reminder_due_at: reminder.reminder_count + 1 < reminder.max_reminders
                  ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // +72h
                  : null,
                debug_logs: [...reminder.debug_logs, {
                  action: 'sent',
                  timestamp: new Date().toISOString(),
                  message_id: trackedEmail.message_id,
                  success: true
                }],
                updated_at: new Date().toISOString()
              })
              .eq('id', reminder.id)

            console.log(`✅ Relance envoyée avec succès pour ${trackedEmail.subject}`)
            sent++
            details.push({
              reminder_id: reminder.id,
              email_subject: trackedEmail.subject,
              recipient: trackedEmail.recipient_email,
              status: 'sent',
              reminder_count: reminder.reminder_count + 1
            })

          } else {
            throw new Error('Échec envoi via Microsoft Graph')
          }
        }

      } catch (error: unknown) {
        console.error(`❌ Erreur envoi relance ${reminder.id}:`, error)
        
        // Marquer comme échoué
        await supabase
          .from('test_email_reminders')
          .update({
            status: 'FAILED',
            debug_logs: [...reminder.debug_logs, {
              action: 'send_failed',
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }],
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id)

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
      test_mode: true,
      dry_run: dryRun,
      working_hours: isWorkingTime,
      total: reminders.length,
      sent,
      failed,
      details
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur envoi relances:', error)
    return createCorsResponse({
      error: 'Erreur envoi relances',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// OBTENIR LE STATUT DES RELANCES (MODE TEST)
// ====================================================================================================
async function handleGetStatus(user: SupabaseUser): Promise<Response> {
  try {
    console.log('📊 Récupération du statut des relances - Mode TEST')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Statistiques générales
    const { data: stats } = await supabase
      .from('test_reminder_stats')
      .select('*')
      .single()

    // Paramètres utilisateur
    const { data: settings } = await supabase
      .from('test_reminder_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Queue des relances
    const { data: queue } = await supabase
      .from('test_reminder_queue')
      .select('*')
      .limit(10)

    // Vérifier les heures de travail actuelles
    const workingHours = await checkWorkingHours(user.id)

    return createCorsResponse({
      test_mode: true,
      user_id: user.id,
      working_hours: workingHours,
      settings: settings || 'Non configuré',
      statistics: stats || {
        total_reminders: 0,
        scheduled: 0,
        sent: 0,
        failed: 0,
        dry_runs: 0
      },
      queue: queue || [],
      lastUpdate: new Date().toISOString()
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur statut relances:', error)
    return createCorsResponse({
      error: 'Erreur récupération statut',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// TESTER LES HEURES DE TRAVAIL
// ====================================================================================================
async function handleTestWorkingHours(user: SupabaseUser): Promise<Response> {
  try {
    console.log('⏰ Test des heures de travail - Mode TEST')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: result, error } = await supabase.rpc('is_test_working_hours', {
      p_user_id: user.id,
      p_check_time: new Date().toISOString()
    })

    if (error) {
      throw new Error(`Erreur test heures de travail: ${error.message}`)
    }

    // Récupérer les paramètres pour afficher le détail
    const { data: settings } = await supabase
      .from('test_reminder_settings')
      .select('work_hours_start, work_hours_end, work_days, timezone')
      .eq('user_id', user.id)
      .single()

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    return createCorsResponse({
      test_mode: true,
      working_hours: result,
      current_time: currentTime,
      current_day: currentDay,
      settings: settings || 'Paramètres par défaut',
      message: result ? 'Dans les heures de travail' : 'Hors heures de travail'
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur test heures de travail:', error)
    return createCorsResponse({
      error: 'Erreur test heures de travail',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// PROGRAMMER UNE RELANCE DE TEST
// ====================================================================================================
async function handleScheduleTestReminder(user: SupabaseUser, testEmailIds: string[], dryRun: boolean): Promise<Response> {
  try {
    console.log('📅 Programmation relance de test')
    console.log('📧 Email IDs:', testEmailIds)

    if (testEmailIds.length === 0) {
      return createCorsResponse({
        error: 'IDs d\'emails requis pour test',
        message: 'Spécifiez test_email_ids dans le body'
      }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const results: any[] = []

    for (const emailId of testEmailIds) {
      try {
        const { data: reminderId, error } = await supabase.rpc('schedule_test_reminder', {
          p_user_id: user.id,
          p_tracked_email_id: emailId,
          p_dry_run: dryRun
        })

        if (error) {
          throw new Error(error.message)
        }

        results.push({
          email_id: emailId,
          reminder_id: reminderId,
          status: 'scheduled',
          dry_run: dryRun
        })

      } catch (error: unknown) {
        results.push({
          email_id: emailId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Programmation terminée',
      test_mode: true,
      dry_run: dryRun,
      results
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur programmation test:', error)
    return createCorsResponse({
      error: 'Erreur programmation test',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// CONFIGURER LES PARAMÈTRES (MODE TEST)
// ====================================================================================================
async function handleConfigureSettings(user: SupabaseUser, req: Request): Promise<Response> {
  try {
    console.log('⚙️ Configuration des paramètres - Mode TEST')

    const body = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data, error } = await supabase
      .from('test_reminder_settings')
      .upsert({
        user_id: user.id,
        ...body,
        test_mode: true // Forcer le mode test
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur configuration: ${error.message}`)
    }

    return createCorsResponse({
      success: true,
      message: 'Configuration mise à jour',
      test_mode: true,
      settings: data
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur configuration:', error)
    return createCorsResponse({
      error: 'Erreur configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// UTILITAIRES
// ====================================================================================================

/**
 * Récupère l'utilisateur Supabase depuis le token d'autorisation
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
    
    const { data: result, error } = await supabase.rpc('is_test_working_hours', {
      p_user_id: userId,
      p_check_time: new Date().toISOString()
    })

    if (error) {
      console.error('❌ Erreur vérification heures de travail:', error)
      return false // Par défaut, considérer comme hors heures de travail
    }

    return result || false
  } catch (error) {
    console.error('❌ Erreur vérification heures de travail:', error)
    return false
  }
}

/**
 * Récupère le token Microsoft d'un utilisateur (version simplifiée pour test)
 */
async function getUserMicrosoftToken(userId: string): Promise<string | null> {
  try {
    // TODO: Implémenter la récupération et déchiffrement du token Microsoft
    // Pour l'instant, retourner null pour forcer le mode dry_run
    console.log('🔑 Token Microsoft non implémenté - utiliser dry_run=true')
    return null
  } catch (error) {
    console.error('❌ Erreur récupération token Microsoft:', error)
    return null
  }
}

/**
 * Compiler le template de relance avec les variables
 */
function compileReminderTemplate(template: string, email: any, reminderCount: number): string {
  const variables = {
    '{{recipient_name}}': email.recipient_email.split('@')[0], // Simple fallback
    '{{sender_name}}': email.sender_email?.split('@')[0] || 'Expéditeur',
    '{{original_subject}}': email.subject,
    '{{sent_date}}': new Date(email.sent_at).toLocaleDateString('fr-FR'),
    '{{days_elapsed}}': Math.floor((Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24)),
    '{{reminder_count}}': reminderCount
  }

  let compiled = template
  for (const [variable, value] of Object.entries(variables)) {
    compiled = compiled.replace(new RegExp(variable, 'g'), String(value))
  }

  return compiled
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

console.log('🚀 Reminder Manager TEST v1.0 ready - Mode isolation avec debugging complet')