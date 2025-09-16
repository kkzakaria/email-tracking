// ====================================================================================================
// SUPABASE EDGE FUNCTION: webhook-handler (Version Application Permissions v2.0)
// ====================================================================================================
// Description: Réceptionne et traite les webhooks Microsoft Graph avec token d'application centralisé
// URL: https://[project-id].supabase.co/functions/v1/webhook-handler
// Version: 2.0 - Architecture simplifiée avec permissions application
// ====================================================================================================

import { serve } from "std/http/server.ts"
import { createClient } from '@supabase/supabase-js'
import { createCorsResponse } from '../_shared/cors.ts'
import { WebhookNotification, GraphMessage, SupabaseClientType, TrackedEmail } from '../_shared/types.ts'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE')!

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
// FONCTIONS PRINCIPALES
// ====================================================================================================

/**
 * Récupérer un message depuis Microsoft Graph
 */
async function getMessageFromGraph(messageId: string): Promise<GraphMessage | null> {
  try {
    const accessToken = await getApplicationToken()

    // Utiliser les permissions application pour accéder aux emails de tous les utilisateurs
    // On cherche d'abord dans la boîte principale de service
    const serviceEmail = 'service-exploitation@karta-transit.ci'

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${serviceEmail}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Erreur récupération message Graph:', response.status, response.statusText)
      return null
    }

    const message: GraphMessage = await response.json()
    console.log('✅ Message récupéré depuis Graph:', message.subject)

    return message

  } catch (error) {
    console.error('❌ Erreur getMessageFromGraph:', error)
    return null
  }
}

/**
 * Traiter une notification de changement de message
 */
async function processMessageNotification(messageId: string): Promise<void> {
  console.log(`📨 Traitement notification message: ${messageId}`)

  try {
    // Récupérer le message depuis Graph
    const graphMessage = await getMessageFromGraph(messageId)
    if (!graphMessage) {
      console.error('❌ Message non trouvé dans Graph:', messageId)
      return
    }

    // Créer client Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Déterminer si c'est un message reçu (réponse) ou envoyé
    const isSentMessage = await checkIfMessageInSentItems(messageId)

    if (isSentMessage) {
      console.log('📤 Message envoyé détecté, création d\'entrée de tracking')
      await handleSentMessage(supabase, graphMessage)
    } else {
      console.log('📬 Message reçu détecté, recherche d\'emails trackés correspondants')
      await handleReceivedMessage(supabase, graphMessage)
    }

  } catch (error) {
    console.error('❌ Erreur traitement notification:', error)
  }
}

/**
 * Vérifier si un message est dans les éléments envoyés
 */
async function checkIfMessageInSentItems(messageId: string): Promise<boolean> {
  try {
    const accessToken = await getApplicationToken()
    const serviceEmail = 'service-exploitation@karta-transit.ci'

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${serviceEmail}/mailFolders/sentitems/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    return response.ok

  } catch (error) {
    console.error('❌ Erreur vérification SentItems:', error)
    return false
  }
}

/**
 * Traiter un message envoyé (création de tracking)
 */
async function handleSentMessage(supabase: SupabaseClientType, message: GraphMessage): Promise<void> {
  try {
    console.log('📤 Création d\'une entrée de tracking pour message envoyé')

    const recipientEmail = message.toRecipients?.[0]?.emailAddress?.address
    if (!recipientEmail) {
      console.log('⚠️ Pas de destinataire trouvé, skip')
      return
    }

    // Créer ou mettre à jour l'entrée tracked_emails
    const { error: insertError } = await supabase
      .from('tracked_emails')
      .upsert({
        message_id: message.internetMessageId || message.id,
        subject: message.subject || 'Sans sujet',
        recipient_email: recipientEmail,
        sender_email: 'service-exploitation@karta-transit.ci',
        sent_at: message.sentDateTime || new Date().toISOString(),
        status: 'PENDING',
        user_id: null, // Plus de user_id avec l'architecture application
        graph_message_id: message.id,
        last_checked: new Date().toISOString()
      }, {
        onConflict: 'graph_message_id'
      })

    if (insertError) {
      console.error('❌ Erreur création tracking:', insertError)
    } else {
      console.log('✅ Email tracké créé avec succès')
    }

  } catch (error) {
    console.error('❌ Erreur handleSentMessage:', error)
  }
}

/**
 * Traiter un message reçu (potentielle réponse)
 */
async function handleReceivedMessage(supabase: SupabaseClientType, message: GraphMessage): Promise<void> {
  try {
    console.log('📬 Recherche d\'emails trackés correspondant au message reçu')

    // Rechercher par conversation ID ou sujet
    let trackedEmails: TrackedEmail[] = []

    if (message.conversationId) {
      // Rechercher par conversation d'abord
      const { data: emailsByConv } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', message.conversationId)
        .eq('status', 'PENDING')

      trackedEmails = emailsByConv || []
    }

    // Si pas trouvé par conversation, rechercher par sujet (Re:, Fwd:)
    if (trackedEmails.length === 0 && message.subject) {
      const cleanSubject = message.subject
        .replace(/^(Re:|Fwd:|RE:|FWD:)\s*/i, '')
        .trim()

      if (cleanSubject) {
        const { data: emailsBySubject } = await supabase
          .from('tracked_emails')
          .select('*')
          .ilike('subject', `%${cleanSubject}%`)
          .eq('status', 'PENDING')

        trackedEmails = emailsBySubject || []
      }
    }

    if (trackedEmails.length === 0) {
      console.log('📭 Aucun email tracké correspondant trouvé')
      return
    }

    console.log(`📧 ${trackedEmails.length} email(s) tracké(s) correspondant(s) trouvé(s)`)

    // Mettre à jour le statut des emails trackés
    for (const email of trackedEmails) {
      await supabase
        .from('tracked_emails')
        .update({
          status: 'REPLIED',
          replied_at: message.receivedDateTime || new Date().toISOString(),
          last_checked: new Date().toISOString()
        })
        .eq('id', email.id)

      // Enregistrer le message reçu
      await supabase
        .from('received_messages')
        .insert({
          tracked_email_id: email.id,
          graph_message_id: message.id,
          sender_email: message.from?.emailAddress?.address || 'Inconnu',
          subject: message.subject || 'Sans sujet',
          received_at: message.receivedDateTime || new Date().toISOString(),
          conversation_id: message.conversationId
        })

      console.log(`✅ Email ${email.id} marqué comme répondu`)
    }

  } catch (error) {
    console.error('❌ Erreur handleReceivedMessage:', error)
  }
}

// ====================================================================================================
// HANDLER PRINCIPAL
// ====================================================================================================

serve(async (req: Request): Promise<Response> => {
  // Gestion CORS
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
    console.log(`📥 Webhook reçu: ${req.method} ${req.url}`)

    // Validation GET pour les subscriptions
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const validationToken = url.searchParams.get('validationToken')

      if (validationToken) {
        console.log('✅ Validation de subscription webhook')
        return new Response(validationToken, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
    }

    // Traitement des notifications POST
    if (req.method === 'POST') {
      const notification: WebhookNotification = await req.json()
      console.log('📨 Notification reçue:', JSON.stringify(notification, null, 2))

      // Vérifier clientState
      for (const change of notification.value) {
        if (change.clientState !== WEBHOOK_CLIENT_STATE) {
          console.error('❌ ClientState invalide')
          return createCorsResponse({ error: 'Invalid clientState' }, { status: 400 })
        }

        // Traiter selon le type de changement
        if (change.changeType === 'created' && change.resourceData?.id) {
          await processMessageNotification(change.resourceData.id)
        }
      }

      // Logger l'événement
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await supabase
        .from('webhook_events')
        .insert({
          subscription_id: notification.value[0]?.subscriptionId || 'unknown',
          change_type: notification.value[0]?.changeType || 'unknown',
          processed: true,
          processed_at: new Date().toISOString(),
          raw_notification: notification
        })

      return createCorsResponse({ success: true, processed: notification.value.length })
    }

    return createCorsResponse({ error: 'Method not allowed' }, { status: 405 })

  } catch (error) {
    console.error('❌ Erreur webhook handler:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

console.log('🚀 Webhook Handler v2.0 ready - Application permissions architecture')