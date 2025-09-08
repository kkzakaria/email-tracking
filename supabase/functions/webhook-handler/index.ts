// ====================================================================================================
// SUPABASE EDGE FUNCTION: webhook-handler
// ====================================================================================================
// Description: Réceptionne et traite les webhooks Microsoft Graph
// URL: https://[project-id].supabase.co/functions/v1/webhook-handler
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse, corsHeaders } from '../_shared/cors.ts'

// Types Microsoft Graph
interface WebhookNotification {
  value: Array<{
    subscriptionId: string
    clientState: string
    changeType: string
    resource: string
    resourceData?: {
      id: string
      '@odata.type': string
      '@odata.etag': string
    }
    subscriptionExpirationDateTime: string
    tenantId?: string
  }>
  validationTokens?: string[]
}

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
  bodyPreview?: string
  isRead?: boolean
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE') || 'supabase-webhook-secret'
const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID')!
const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET')!
const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID')!

console.log('🔧 Webhook Handler initialized')

serve(async (req: Request) => {
  // Gérer la requête OPTIONS pour le preflight CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log(`📨 ${req.method} ${req.url}`)

    // ================================================================================================
    // VALIDATION TOKEN (Microsoft Graph validation)
    // ================================================================================================
    const url = new URL(req.url)
    const validationToken = url.searchParams.get('validationToken')
    
    if (validationToken) {
      console.log('🔐 Validation token reçu:', validationToken)
      return new Response(validationToken, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      })
    }

    // ================================================================================================
    // WEBHOOK NOTIFICATION PROCESSING
    // ================================================================================================
    if (req.method === 'POST') {
      const notification: WebhookNotification = await req.json()
      console.log('📬 Notification reçue:', {
        valueCount: notification.value?.length || 0,
        validationTokens: notification.validationTokens?.length || 0
      })

      // Traitement asynchrone pour répondre rapidement à Microsoft Graph
      processNotificationAsync(notification).catch((error: unknown) => {
        console.error('❌ Erreur traitement asynchrone:', error)
      })

      return createCorsResponse({ 
        status: 'accepted',
        message: 'Notification en cours de traitement',
        timestamp: new Date().toISOString()
      }, { status: 202 })
    }

    // ================================================================================================
    // HEALTH CHECK
    // ================================================================================================
    if (req.method === 'GET') {
      return createCorsResponse({
        status: 'healthy',
        service: 'webhook-handler',
        timestamp: new Date().toISOString(),
        version: '2.0.0-supabase'
      }, { status: 200 })
    }

    return createCorsResponse('Method not allowed', { status: 405 })

  } catch (error: unknown) {
    console.error('❌ Erreur dans webhook handler:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// TRAITEMENT ASYNCHRONE DES NOTIFICATIONS
// ====================================================================================================
async function processNotificationAsync(notification: WebhookNotification) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  let processed = 0
  let errors = 0

  console.log('⚙️ Début traitement asynchrone de', notification.value?.length || 0, 'notifications')

  for (const item of notification.value || []) {
    try {
      console.log('📋 Traitement notification:', {
        subscriptionId: item.subscriptionId,
        changeType: item.changeType,
        resource: item.resource
      })

      // ============================================================================================
      // VALIDATION CLIENT STATE
      // ============================================================================================
      if (item.clientState !== WEBHOOK_CLIENT_STATE) {
        console.error('⚠️ Client state invalide:', item.clientState)
        errors++
        continue
      }

      // ============================================================================================
      // LOG WEBHOOK EVENT
      // ============================================================================================
      const { error: logError } = await supabase
        .from('webhook_events')
        .insert({
          subscription_id: item.subscriptionId,
          change_type: item.changeType,
          resource_id: item.resourceData?.id,
          raw_notification: item,
          processed: false
        })

      if (logError) {
        console.error('❌ Erreur log webhook event:', logError)
      }

      // ============================================================================================
      // TRAITEMENT SELON TYPE DE CHANGEMENT
      // ============================================================================================
      if (item.changeType === 'created' && item.resourceData?.id) {
        await handleNewMessage(item.resourceData.id, item.subscriptionId)
        processed++
      } else {
        console.log('ℹ️ Type de changement ignoré:', item.changeType)
      }

    } catch (error: unknown) {
      console.error('❌ Erreur pour notification:', error)
      errors++
    }
  }

  console.log(`✅ Traitement terminé: ${processed} traités, ${errors} erreurs`)
}

// ====================================================================================================
// TRAITEMENT D'UN NOUVEAU MESSAGE
// ====================================================================================================
async function handleNewMessage(messageId: string, subscriptionId: string) {
  try {
    console.log('📧 Traitement nouveau message:', messageId)

    // ============================================================================================
    // RÉCUPÉRATION DU MESSAGE VIA MICROSOFT GRAPH
    // ============================================================================================
    const graphMessage = await fetchMessageFromGraph(messageId)
    if (!graphMessage) {
      console.error('❌ Message non trouvé dans Graph:', messageId)
      return
    }

    console.log('✅ Message récupéré:', {
      id: graphMessage.id,
      subject: graphMessage.subject?.substring(0, 50),
      conversationId: graphMessage.conversationId,
      from: graphMessage.from?.emailAddress?.address
    })

    // ============================================================================================
    // ENREGISTREMENT DU MESSAGE REÇU
    // ============================================================================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: messageData, error: messageError } = await supabase
      .rpc('log_received_message', {
        p_graph_message_id: graphMessage.id,
        p_internet_message_id: graphMessage.internetMessageId,
        p_conversation_id: graphMessage.conversationId,
        p_subject: graphMessage.subject,
        p_from_email: graphMessage.from?.emailAddress?.address,
        p_to_email: graphMessage.toRecipients?.[0]?.emailAddress?.address,
        p_body_preview: graphMessage.bodyPreview?.substring(0, 500),
        p_received_at: graphMessage.receivedDateTime ? new Date(graphMessage.receivedDateTime).toISOString() : null
      })

    if (messageError) {
      console.error('❌ Erreur enregistrement message:', messageError)
      return
    }

    console.log('✅ Message enregistré avec ID:', messageData)

    // ============================================================================================
    // MARQUER L'ÉVÉNEMENT WEBHOOK COMME TRAITÉ
    // ============================================================================================
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId)
      .eq('resource_id', messageId)

    console.log('✅ Événement webhook marqué comme traité')

    // Note: La détection des réponses se fait automatiquement via le trigger PostgreSQL
    // lors de l'insertion dans received_messages

  } catch (error: unknown) {
    console.error('❌ Erreur traitement nouveau message:', error)
    throw error
  }
}

// ====================================================================================================
// RÉCUPÉRATION D'UN MESSAGE VIA MICROSOFT GRAPH API
// ====================================================================================================
async function fetchMessageFromGraph(messageId: string): Promise<GraphMessage | null> {
  try {
    console.log('🔍 Récupération message Graph API:', messageId)

    // Obtenir le token d'accès
    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      throw new Error('Impossible d\'obtenir le token d\'accès')
    }

    // Récupérer le message
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual'
      }
    })

    if (!response.ok) {
      console.error('❌ Erreur Graph API:', response.status, await response.text())
      return null
    }

    const message: GraphMessage = await response.json()
    return message

  } catch (error: unknown) {
    console.error('❌ Erreur récupération message Graph:', error)
    return null
  }
}

// ====================================================================================================
// OBTENIR UN TOKEN D'ACCÈS MICROSOFT GRAPH
// ====================================================================================================
async function getGraphAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'client_id': AZURE_CLIENT_ID,
        'client_secret': AZURE_CLIENT_SECRET,
        'scope': 'https://graph.microsoft.com/.default',
        'grant_type': 'client_credentials'
      })
    })

    if (!response.ok) {
      console.error('❌ Erreur obtention token:', response.status, await response.text())
      return null
    }

    const tokenData = await response.json()
    return tokenData.access_token

  } catch (error: unknown) {
    console.error('❌ Erreur token d\'accès:', error)
    return null
  }
}

console.log('🚀 Webhook Handler v2.0 ready - Supabase Edge Function')