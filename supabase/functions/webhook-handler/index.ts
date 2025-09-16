// ====================================================================================================
// SUPABASE EDGE FUNCTION: webhook-handler (Version Application Permissions v3.0)
// ====================================================================================================
// Description: Réceptionne et traite les webhooks Microsoft Graph avec flux direct simplifié
// URL: https://[project-id].supabase.co/functions/v1/webhook-handler
// Version: 3.0 - Architecture ultra-simplifiée: webhook → tracked_emails (une seule table)
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
 * Récupérer un message depuis Microsoft Graph (avec support multi-utilisateurs)
 */
async function getMessageFromGraph(messageId: string, resourcePath?: string): Promise<GraphMessage | null> {
  try {
    const accessToken = await getApplicationToken()

    // Si nous avons un resourcePath du webhook, l'utiliser directement
    let apiUrl: string
    if (resourcePath) {
      // Extraire l'userId depuis le resource path: "Users/[userId]/Messages/[messageId]"
      const userIdMatch = resourcePath.match(/Users\/([^\/]+)\/Messages/)
      if (userIdMatch) {
        const userId = userIdMatch[1]
        apiUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages/${messageId}`
        console.log(`📧 Récupération message depuis userId: ${userId}`)
      } else {
        // Fallback vers l'email de service
        apiUrl = `https://graph.microsoft.com/v1.0/users/service-exploitation@karta-transit.ci/messages/${messageId}`
        console.log('📧 Fallback vers email de service')
      }
    } else {
      // Essayer d'abord avec l'email de service (rétrocompatibilité)
      apiUrl = `https://graph.microsoft.com/v1.0/users/service-exploitation@karta-transit.ci/messages/${messageId}`
      console.log('📧 Utilisation email de service par défaut')
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ Erreur récupération message Graph:', response.status, response.statusText)

      // Si échec avec l'userId, essayer avec l'email de service (fallback)
      if (resourcePath && !apiUrl.includes('service-exploitation')) {
        console.log('🔄 Tentative fallback avec email de service...')
        return await getMessageFromGraph(messageId) // Récursion sans resourcePath
      }

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
async function processMessageNotification(messageId: string, resourcePath?: string): Promise<void> {
  console.log(`📨 Traitement notification message: ${messageId}`)
  if (resourcePath) {
    console.log(`🔗 Resource path: ${resourcePath}`)
  }

  try {
    // Récupérer le message depuis Graph avec le resourcePath si disponible
    const graphMessage = await getMessageFromGraph(messageId, resourcePath)
    if (!graphMessage) {
      console.error('❌ Message non trouvé dans Graph:', messageId)
      return
    }

    // Créer client Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Déterminer le type de message basé sur le resourcePath et l'expéditeur
    const isSentMessage = resourcePath?.includes('sentitems') ||
                         (graphMessage.from?.emailAddress?.address === 'service-exploitation@karta-transit.ci')

    // Vérifier si c'est une réponse à un email que nous avons envoyé
    const isReplyToOurEmail = !isSentMessage &&
                             graphMessage.from?.emailAddress?.address !== 'service-exploitation@karta-transit.ci' &&
                             graphMessage.conversationId

    if (isSentMessage) {
      console.log('📤 Message envoyé détecté, création d\'entrée de tracking')
      await handleSentMessage(supabase, graphMessage)
    } else if (isReplyToOurEmail) {
      console.log('📬 Réponse reçue détectée, mise à jour du statut de l\'email original')
      await handleReceivedMessage(supabase, graphMessage)
    } else {
      console.log('📬 Message reçu non lié au tracking')
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
 * Traiter un message envoyé (utilise l'ancienne logique avec auto-tracking)
 */
async function handleSentMessage(supabase: SupabaseClientType, message: GraphMessage): Promise<void> {
  try {
    console.log('📤 Enregistrement message envoyé dans sent_messages (auto-tracking)')

    const recipientEmail = message.toRecipients?.[0]?.emailAddress?.address
    if (!recipientEmail) {
      console.log('⚠️ Pas de destinataire trouvé, skip')
      return
    }

    // Utiliser la fonction log_sent_message qui déclenche automatiquement le trigger
    const { data: messageId, error: insertError } = await supabase
      .rpc('log_sent_message', {
        p_graph_message_id: message.id,
        p_internet_message_id: message.internetMessageId,
        p_conversation_id: message.conversationId,
        p_subject: message.subject || 'Sans sujet',
        p_from_email: message.from?.emailAddress?.address || 'service-exploitation@karta-transit.ci',
        p_to_email: recipientEmail,
        p_body_preview: message.bodyPreview?.substring(0, 500),
        p_sent_at: message.sentDateTime ? new Date(message.sentDateTime).toISOString() : null
      })

    if (insertError) {
      console.error('❌ Erreur enregistrement message envoyé:', insertError)
    } else {
      console.log('✅ Message envoyé enregistré avec ID:', messageId, '(auto-tracking activé)')
    }

  } catch (error) {
    console.error('❌ Erreur handleSentMessage:', error)
  }
}

/**
 * Traiter un message reçu (utilise l'ancienne logique avec auto-détection)
 */
async function handleReceivedMessage(supabase: SupabaseClientType, message: GraphMessage): Promise<void> {
  try {
    console.log('📬 Enregistrement message reçu dans received_messages (auto-détection)')

    // Enregistrer le message reçu qui déclenche automatiquement la détection des réponses
    const { data: messageId, error: insertError } = await supabase
      .rpc('log_received_message', {
        p_graph_message_id: message.id,
        p_internet_message_id: message.internetMessageId,
        p_conversation_id: message.conversationId,
        p_subject: message.subject || 'Sans sujet',
        p_from_email: message.from?.emailAddress?.address,
        p_to_email: message.toRecipients?.[0]?.emailAddress?.address,
        p_body_preview: message.bodyPreview?.substring(0, 500),
        p_received_at: message.receivedDateTime ? new Date(message.receivedDateTime).toISOString() : null
      })

    if (insertError) {
      console.error('❌ Erreur enregistrement message reçu:', insertError)
    } else {
      console.log('✅ Message reçu enregistré avec ID:', messageId, '(auto-détection des réponses activée)')
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
      const body = await req.json()
      console.log('📨 Données reçues:', JSON.stringify(body, null, 2))

      // Gestion des validationTokens (validation Microsoft Graph)
      if (body.validationTokens) {
        console.log('✅ Validation de subscription webhook via POST')
        return createCorsResponse({ validationTokens: body.validationTokens })
      }

      // Traitement des notifications webhook normales
      const notification: WebhookNotification = body
      if (!notification.value || !Array.isArray(notification.value)) {
        console.error('❌ Format de notification invalide - propriété value manquante ou invalide')
        return createCorsResponse({ error: 'Invalid notification format' }, { status: 400 })
      }

      // Vérifier clientState
      for (const change of notification.value) {
        if (change.clientState !== WEBHOOK_CLIENT_STATE) {
          console.error('❌ ClientState invalide')
          return createCorsResponse({ error: 'Invalid clientState' }, { status: 400 })
        }

        // Traiter selon le type de changement
        if (change.changeType === 'created' && change.resourceData?.id) {
          await processMessageNotification(change.resourceData.id, change.resource)
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