// ====================================================================================================
// EMAIL HISTORY SYNC v3.2 - Architecture Trigger Éprouvée
// ====================================================================================================
// Edge Function pour synchroniser les emails via Microsoft Graph API
// Utilise les RPC log_sent_message et log_received_message avec triggers automatiques
// Version: 3.2 - Détection des réponses via triggers detect_sent_emails/detect_email_replies
// ====================================================================================================

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GraphMessage, SyncStats, SupabaseClientType } from '../_shared/types.ts'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

// ====================================================================================================
// SYNCHRONISATION PRINCIPALE
// ====================================================================================================

/**
 * Synchroniser les emails des 7 derniers jours avec la nouvelle architecture
 */
async function syncEmailHistory(days: number = 7): Promise<SyncStats> {
  console.log(`🔄 Début de la synchronisation historique des emails (${days} derniers jours)`)

  const accessToken = await getApplicationToken()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Calculer la période de synchronisation
  const now = new Date()
  const pastDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
  const dateFilter = pastDate.toISOString()

  console.log(`📅 Synchronisation depuis: ${pastDate.toLocaleDateString('fr-FR')}`)

  const stats: SyncStats = {
    totalMessages: 0,
    newTrackedEmails: 0,
    updatedEmails: 0,
    errors: 0,
    syncedPeriod: `${pastDate.toLocaleDateString('fr-FR')} - ${now.toLocaleDateString('fr-FR')}`
  }

  try {
    const serviceEmail = 'service-exploitation@karta-transit.ci'

    // 1. Synchroniser les emails envoyés (SentItems) - log_sent_message avec triggers
    console.log('📤 Synchronisation des emails envoyés...')
    const sentStats = await syncSentEmails(accessToken, supabase, serviceEmail, dateFilter)
    stats.totalMessages += sentStats.totalMessages || 0
    stats.newTrackedEmails += sentStats.newTrackedEmails || 0
    stats.errors += sentStats.errors || 0

    // 2. Synchroniser les emails reçus (Inbox) - log_received_message avec triggers
    console.log('📬 Synchronisation des emails reçus...')
    const receivedStats = await syncReceivedEmails(accessToken, supabase, serviceEmail, dateFilter)
    stats.totalMessages += receivedStats.totalMessages || 0
    stats.updatedEmails += receivedStats.updatedEmails || 0
    stats.errors += receivedStats.errors || 0

    console.log(`✅ Synchronisation terminée:`)
    console.log(`   - Messages traités: ${stats.totalMessages}`)
    console.log(`   - Nouveaux trackings: ${stats.newTrackedEmails}`)
    console.log(`   - Emails mis à jour: ${stats.updatedEmails}`)
    console.log(`   - Erreurs: ${stats.errors}`)

    return stats

  } catch (error) {
    console.error('❌ Erreur synchronisation:', error)
    stats.errors++
    return stats
  }
}

/**
 * Synchroniser les emails envoyés via log_sent_message (déclenche trigger detect_sent_emails)
 */
async function syncSentEmails(
  accessToken: string,
  supabase: SupabaseClientType,
  userEmail: string,
  dateFilter: string
): Promise<Partial<SyncStats>> {
  const stats = { totalMessages: 0, newTrackedEmails: 0, errors: 0 }

  try {
    // Récupérer les emails du dossier SentItems
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders/sentitems/messages?$filter=sentDateTime ge ${dateFilter}&$orderby=sentDateTime desc&$top=200`

    console.log(`📡 Appel API: ${url}`)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur récupération emails envoyés:', response.status, errorText)
      stats.errors++
      return stats
    }

    const data = await response.json()
    const messages: GraphMessage[] = data.value || []

    console.log(`📤 ${messages.length} email(s) envoyé(s) trouvé(s)`)
    stats.totalMessages = messages.length

    // Traiter chaque message envoyé via le trigger log_sent_message
    for (const message of messages) {
      try {
        const recipientEmail = message.toRecipients?.[0]?.emailAddress?.address

        if (!recipientEmail || !message.subject) {
          console.log(`⚠️ Email incomplet ignoré: ${message.id}`)
          continue
        }

        // Utiliser log_sent_message qui déclenche automatiquement le trigger detect_sent_emails
        const { data: messageId, error: insertError } = await supabase
          .rpc('log_sent_message', {
            p_graph_message_id: message.id,
            p_internet_message_id: message.internetMessageId || null,
            p_conversation_id: message.conversationId || null,
            p_subject: message.subject || null,
            p_from_email: message.from?.emailAddress?.address || userEmail,
            p_to_email: recipientEmail,
            p_body_preview: message.bodyPreview?.substring(0, 500) || null,
            p_sent_at: message.sentDateTime || null
          })

        if (insertError) {
          console.error('❌ Erreur log_sent_message:', insertError)
          stats.errors++
        } else {
          stats.newTrackedEmails++
          console.log(`✅ Email envoyé traité: ${message.subject}`)
        }

      } catch (error) {
        console.error('❌ Erreur traitement message envoyé:', error)
        stats.errors++
      }
    }

    return stats

  } catch (error) {
    console.error('❌ Erreur syncSentEmails:', error)
    stats.errors++
    return stats
  }
}

/**
 * Synchroniser les emails reçus via log_received_message (déclenche trigger detect_email_replies)
 */
async function syncReceivedEmails(
  accessToken: string,
  supabase: SupabaseClientType,
  userEmail: string,
  dateFilter: string
): Promise<Partial<SyncStats>> {
  const stats = { totalMessages: 0, updatedEmails: 0, errors: 0 }

  try {
    // Récupérer les emails de la boîte de réception
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/messages?$filter=receivedDateTime ge ${dateFilter}&$orderby=receivedDateTime desc&$top=200`

    console.log(`📡 Appel API: ${url}`)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur récupération emails reçus:', response.status, errorText)
      stats.errors++
      return stats
    }

    const data = await response.json()
    const messages: GraphMessage[] = data.value || []

    console.log(`📬 ${messages.length} email(s) reçu(s) trouvé(s)`)
    stats.totalMessages = messages.length

    // Traiter chaque message reçu via le trigger log_received_message
    for (const message of messages) {
      try {
        const senderEmail = message.from?.emailAddress?.address

        if (!senderEmail || !message.subject) {
          console.log(`⚠️ Email reçu incomplet ignoré: ${message.id}`)
          continue
        }

        // Skip les emails internes (envoyés par nous-mêmes)
        if (senderEmail.includes('karta-transit.ci')) {
          console.log(`⚠️ Email interne ignoré: ${senderEmail}`)
          continue
        }

        // Utiliser log_received_message qui déclenche automatiquement le trigger detect_email_replies
        const { data: messageId, error: insertError } = await supabase
          .rpc('log_received_message', {
            p_graph_message_id: message.id,
            p_internet_message_id: message.internetMessageId || null,
            p_conversation_id: message.conversationId || null,
            p_subject: message.subject || null,
            p_from_email: senderEmail,
            p_to_email: message.toRecipients?.[0]?.emailAddress?.address || userEmail,
            p_body_preview: message.bodyPreview?.substring(0, 500) || null,
            p_received_at: message.receivedDateTime || null
          })

        if (insertError) {
          console.error('❌ Erreur log_received_message:', insertError)
          stats.errors++
        } else {
          stats.updatedEmails++
          console.log(`✅ Email reçu traité: ${message.subject} de ${senderEmail}`)
        }

      } catch (error) {
        console.error('❌ Erreur traitement message reçu:', error)
        stats.errors++
      }
    }

    return stats

  } catch (error) {
    console.error('❌ Erreur syncReceivedEmails:', error)
    stats.errors++
    return stats
  }
}

// ====================================================================================================
// HANDLER PRINCIPAL
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  // Headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Email History Sync v3.2 - Architecture Trigger Éprouvée')

    // Paramètres optionnels
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '7')

    // Lancer la synchronisation
    const stats = await syncEmailHistory(days)

    // Réponse avec statistiques
    const response = {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
      version: '3.2',
      architecture: 'trigger-based'
    }

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erreur handler principal:', error)

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString(),
      version: '3.2'
    }

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

console.log('🚀 Email History Sync v3.2 ready - Architecture Trigger Éprouvée')