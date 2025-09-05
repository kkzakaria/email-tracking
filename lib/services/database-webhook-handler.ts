/**
 * Handler webhook optimisé qui utilise la détection base de données
 * Plus simple et plus performant que la logique applicative
 */

import { createGraphClient } from '@/lib/microsoft/graph-helper'
import { syncSingleReceivedMessage, ReceivedMessage } from '@/lib/services/database-reply-detection'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface WebhookNotification {
  subscriptionId: string
  clientState: string
  changeType: string
  resource: string
  subscriptionExpirationDateTime: string
  resourceData?: {
    id: string
    odataType: string
    odataId: string
  }
}

export interface DatabaseWebhookResult {
  processed: boolean
  message_synced: boolean
  reply_detected: boolean
  user_id?: string
  conversation_id?: string
  error?: string
}

/**
 * Traite une notification webhook via l'approche base de données
 * Beaucoup plus simple : récupère le message et le sync en DB
 * Le trigger PostgreSQL gère automatiquement la détection
 */
export async function handleWebhookWithDatabase(
  notification: WebhookNotification,
  userId: string
): Promise<DatabaseWebhookResult> {
  
  const result: DatabaseWebhookResult = {
    processed: false,
    message_synced: false,
    reply_detected: false
  }

  try {
    console.log('📨 Traitement webhook via database approach:', notification.changeType)

    // On ne traite que les nouveaux messages
    if (notification.changeType !== 'created') {
      console.log('ℹ️ Notification ignorée (pas un nouveau message)')
      result.processed = true
      return result
    }

    // Créer le client Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      throw new Error('Client Microsoft Graph non disponible')
    }

    // Extraire l'ID du message depuis la notification
    const messageId = extractMessageId(notification.resource)
    if (!messageId) {
      throw new Error('Impossible d\'extraire l\'ID du message')
    }

    console.log('🔍 Récupération du message:', messageId)

    // Récupérer les détails du message depuis Graph API
    const message = await graphClient
      .api(`/me/messages/${messageId}`)
      .select('id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead')
      .get()

    if (!message) {
      throw new Error('Message non trouvé dans Microsoft Graph')
    }

    // Préparer les données pour la synchronisation
    const messageData: ReceivedMessage = {
      message_id: message.id,
      internet_message_id: message.internetMessageId,
      conversation_id: message.conversationId,
      subject: message.subject,
      from_email: message.from?.emailAddress?.address,
      to_email: message.toRecipients?.[0]?.emailAddress?.address,
      received_at: message.receivedDateTime,
      body_preview: message.bodyPreview?.substring(0, 500),
      is_read: message.isRead
    }

    console.log('📧 Message préparé:', {
      id: messageData.message_id,
      conversation: messageData.conversation_id,
      from: messageData.from_email,
      subject: messageData.subject?.substring(0, 50)
    })

    // Synchroniser le message (le trigger DB gère la détection automatiquement)
    const syncResult = await syncSingleReceivedMessage(userId, messageData)
    
    result.processed = true
    result.message_synced = syncResult.success
    result.reply_detected = syncResult.replied_detected
    result.user_id = userId
    result.conversation_id = messageData.conversation_id

    if (syncResult.replied_detected) {
      console.log('✅ Réponse détectée automatiquement par trigger DB')
    } else {
      console.log('ℹ️ Message synchronisé, pas de réponse détectée')
    }

    // Enregistrer l'événement webhook pour audit
    await supabase
      .from('webhook_events')
      .insert({
        subscription_id: notification.subscriptionId,
        change_type: notification.changeType,
        resource_data: notification.resourceData || {},
        conversation_id: messageData.conversation_id,
        message_id: messageId,
        user_id: userId,
        reply_detected: syncResult.replied_detected,
        processing_method: 'database_trigger',
        processed_at: new Date().toISOString()
      })

    return result

  } catch (error) {
    console.error('❌ Erreur dans le webhook database handler:', error)
    result.error = error instanceof Error ? error.message : 'Erreur inconnue'

    // Enregistrer l'erreur
    try {
      await supabase
        .from('webhook_events')
        .insert({
          subscription_id: notification.subscriptionId,
          change_type: notification.changeType,
          resource_data: notification.resourceData || {},
          user_id: userId,
          error_message: result.error,
          processing_method: 'database_trigger_failed',
          processed_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('❌ Impossible d\'enregistrer l\'erreur webhook:', logError)
    }

    return result
  }
}

/**
 * Traitement batch des notifications webhook
 */
export async function handleBatchWebhooksWithDatabase(
  notifications: WebhookNotification[],
  userId: string
): Promise<{
  processed: number
  synced: number
  replies_detected: number
  errors: number
}> {
  
  let processed = 0
  let synced = 0
  let repliesDetected = 0
  let errors = 0

  console.log(`📦 Traitement batch de ${notifications.length} notifications`)

  for (const notification of notifications) {
    try {
      const result = await handleWebhookWithDatabase(notification, userId)
      processed++
      
      if (result.message_synced) synced++
      if (result.reply_detected) repliesDetected++
      if (result.error) errors++

    } catch (error) {
      console.error(`❌ Erreur notification ${notification.subscriptionId}:`, error)
      errors++
    }
  }

  console.log(`✅ Batch terminé: ${processed} traités, ${synced} synced, ${repliesDetected} réponses, ${errors} erreurs`)

  return {
    processed,
    synced,
    replies_detected: repliesDetected,
    errors
  }
}

/**
 * Extrait l'ID du message depuis l'URL de ressource
 */
function extractMessageId(resourceUrl: string): string | null {
  try {
    // Format: /me/messages/{messageId} ou /Users/{userId}/Messages/{messageId}
    const matches = resourceUrl.match(/[mM]essages[/']([^/']+)/i)
    return matches ? matches[1] : null
  } catch (error) {
    console.error('❌ Erreur extraction ID message:', error)
    return null
  }
}

/**
 * Vérifie si l'utilisateur a des emails trackés avec conversation_id
 * Utile pour éviter de traiter des webhooks inutiles
 */
export async function hasTrackedConversations(userId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('email_tracking')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .not('conversation_id', 'is', null)

    return (count || 0) > 0
  } catch (error) {
    console.error('❌ Erreur vérification conversations:', error)
    return false
  }
}