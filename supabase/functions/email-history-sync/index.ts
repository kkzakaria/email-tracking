// ====================================================================================================
// EMAIL HISTORY SYNC v2.0 - Version Application Permissions
// ====================================================================================================
// Edge Function pour synchroniser les emails via Microsoft Graph API avec token d'application centralisé
// Récupère les emails des 7 derniers jours et met à jour le tracking automatiquement
// Version: 2.0 - Architecture simplifiée sans tokens chiffrés utilisateur
// ====================================================================================================

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
// TYPES
// ====================================================================================================

interface GraphMessage {
  id: string
  internetMessageId?: string
  conversationId?: string
  subject?: string
  from?: {
    emailAddress?: {
      address?: string
      name?: string
    }
  }
  toRecipients?: Array<{
    emailAddress?: {
      address?: string
      name?: string
    }
  }>
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  isDraft?: boolean
  parentFolderId?: string
  hasAttachments?: boolean
}

interface SyncStats {
  totalMessages: number
  newTrackedEmails: number
  updatedEmails: number
  errors: number
  syncedPeriod: string
}

// ====================================================================================================
// SYNCHRONISATION PRINCIPALE
// ====================================================================================================

/**
 * Synchroniser les emails des 7 derniers jours
 */
async function syncEmailHistory(): Promise<SyncStats> {
  console.log('🔄 Début de la synchronisation historique des emails')

  const accessToken = await getApplicationToken()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Calculer la période de synchronisation (7 derniers jours)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
  const dateFilter = sevenDaysAgo.toISOString()

  console.log(`📅 Synchronisation depuis: ${sevenDaysAgo.toLocaleDateString('fr-FR')}`)

  const stats: SyncStats = {
    totalMessages: 0,
    newTrackedEmails: 0,
    updatedEmails: 0,
    errors: 0,
    syncedPeriod: `${sevenDaysAgo.toLocaleDateString('fr-FR')} - ${now.toLocaleDateString('fr-FR')}`
  }

  try {
    // Email de service principal
    const serviceEmail = 'service-exploitation@karta-transit.ci'

    // 1. Synchroniser les emails envoyés (SentItems)
    console.log('📤 Synchronisation des emails envoyés...')
    const sentStats = await syncSentEmails(accessToken, supabase, serviceEmail, dateFilter)
    stats.totalMessages += sentStats.totalMessages
    stats.newTrackedEmails += sentStats.newTrackedEmails
    stats.errors += sentStats.errors

    // 2. Synchroniser les emails reçus (Inbox)
    console.log('📬 Synchronisation des emails reçus...')
    const receivedStats = await syncReceivedEmails(accessToken, supabase, serviceEmail, dateFilter)
    stats.totalMessages += receivedStats.totalMessages
    stats.updatedEmails += receivedStats.updatedEmails
    stats.errors += receivedStats.errors

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
 * Synchroniser les emails envoyés
 */
async function syncSentEmails(
  accessToken: string,
  supabase: any,
  userEmail: string,
  dateFilter: string
): Promise<Partial<SyncStats>> {
  const stats = { totalMessages: 0, newTrackedEmails: 0, errors: 0 }

  try {
    // Récupérer les emails du dossier SentItems
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders/sentitems/messages?$filter=sentDateTime ge ${dateFilter}&$orderby=sentDateTime desc&$top=100`

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

    // Traiter chaque message envoyé
    for (const message of messages) {
      try {
        const recipientEmail = message.toRecipients?.[0]?.emailAddress?.address

        if (!recipientEmail || !message.subject || recipientEmail.includes('karta-transit.ci')) {
          // Skip les emails internes ou sans destinataire
          continue
        }

        // Vérifier si déjà tracké
        const { data: existing } = await supabase
          .from('tracked_emails')
          .select('id')
          .eq('graph_message_id', message.id)
          .single()

        if (existing) {
          continue // Déjà tracké
        }

        // Créer nouveau tracking
        const { error: insertError } = await supabase
          .from('tracked_emails')
          .insert({
            message_id: message.internetMessageId || message.id,
            subject: message.subject,
            recipient_email: recipientEmail,
            sender_email: userEmail,
            sent_at: message.sentDateTime || new Date().toISOString(),
            status: 'PENDING',
            user_id: null, // Plus de user_id avec l'architecture application
            graph_message_id: message.id,
            conversation_id: message.conversationId,
            last_checked: new Date().toISOString(),
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('❌ Erreur insertion email tracké:', insertError)
          stats.errors++
        } else {
          stats.newTrackedEmails++
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
 * Synchroniser les emails reçus
 */
async function syncReceivedEmails(
  accessToken: string,
  supabase: any,
  userEmail: string,
  dateFilter: string
): Promise<Partial<SyncStats>> {
  const stats = { totalMessages: 0, updatedEmails: 0, errors: 0 }

  try {
    // Récupérer les emails de la boîte de réception
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders/inbox/messages?$filter=receivedDateTime ge ${dateFilter}&$orderby=receivedDateTime desc&$top=100`

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

    // Traiter chaque message reçu
    for (const message of messages) {
      try {
        const senderEmail = message.from?.emailAddress?.address

        if (!senderEmail || !message.subject || senderEmail.includes('karta-transit.ci')) {
          // Skip les emails internes
          continue
        }

        // Rechercher des emails trackés correspondants par conversation ou sujet
        let matchingEmails = []

        if (message.conversationId) {
          const { data: emailsByConv } = await supabase
            .from('tracked_emails')
            .select('*')
            .eq('conversation_id', message.conversationId)
            .eq('status', 'PENDING')

          matchingEmails = emailsByConv || []
        }

        // Si pas trouvé par conversation, rechercher par sujet
        if (matchingEmails.length === 0 && message.subject) {
          const cleanSubject = message.subject
            .replace(/^(Re:|Fwd:|RE:|FWD:)\s*/i, '')
            .trim()

          if (cleanSubject) {
            const { data: emailsBySubject } = await supabase
              .from('tracked_emails')
              .select('*')
              .ilike('subject', `%${cleanSubject}%`)
              .eq('status', 'PENDING')
              .eq('recipient_email', senderEmail) // L'expéditeur du message reçu doit être le destinataire de l'email tracké

            matchingEmails = emailsBySubject || []
          }
        }

        if (matchingEmails.length === 0) {
          continue // Pas d'email tracké correspondant
        }

        // Marquer les emails trackés comme répondus
        for (const trackedEmail of matchingEmails) {
          await supabase
            .from('tracked_emails')
            .update({
              status: 'REPLIED',
              replied_at: message.receivedDateTime || new Date().toISOString(),
              last_checked: new Date().toISOString()
            })
            .eq('id', trackedEmail.id)

          // Enregistrer le message reçu
          await supabase
            .from('received_messages')
            .upsert({
              tracked_email_id: trackedEmail.id,
              graph_message_id: message.id,
              sender_email: senderEmail,
              subject: message.subject || 'Sans sujet',
              received_at: message.receivedDateTime || new Date().toISOString(),
              conversation_id: message.conversationId
            }, {
              onConflict: 'graph_message_id'
            })

          stats.updatedEmails++
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
    console.log('🚀 Email History Sync v2.0 - Début de la synchronisation')

    const stats = await syncEmailHistory()

    return new Response(JSON.stringify({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString(),
      version: '2.0',
      architecture: 'application-permissions'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('❌ Erreur Email History Sync:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
})

console.log('🚀 Email History Sync v2.0 ready - Application permissions architecture')