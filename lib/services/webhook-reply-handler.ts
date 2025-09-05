/**
 * Service pour gérer les webhooks de Microsoft Graph et détecter les réponses
 */

import { createClient } from '@supabase/supabase-js'
import { createGraphClient } from '@/lib/microsoft/graph-helper'
import { detectRepliesByConversation } from './reply-detection'

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

export interface ReplyHandlerResult {
  processed: boolean
  emailsUpdated: number
  conversationId?: string
  replyDetected: boolean
  error?: string
}

/**
 * Traite une notification webhook de Microsoft Graph pour détecter les réponses
 */
export async function handleWebhookNotification(
  notification: WebhookNotification
): Promise<ReplyHandlerResult> {
  const result: ReplyHandlerResult = {
    processed: false,
    emailsUpdated: 0,
    replyDetected: false
  }

  try {
    console.log('📨 Traitement notification webhook:', notification.changeType)

    // Vérifier que c'est une notification de nouveau message
    if (notification.changeType !== 'created') {
      console.log('ℹ️ Notification ignorée (pas un nouveau message)')
      return result
    }

    // Créer le client Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      throw new Error('Client Microsoft Graph non disponible')
    }

    // Récupérer les détails du message depuis Graph API
    const messageId = extractMessageId(notification.resource)
    if (!messageId) {
      throw new Error('Impossible d\'extraire l\'ID du message depuis la notification')
    }

    console.log('🔍 Récupération du message:', messageId)

    const message = await graphClient
      .api(`/me/messages/${messageId}`)
      .select('id,conversationId,subject,from,to,sentDateTime,receivedDateTime,isRead')
      .get()

    if (!message.conversationId) {
      console.log('⚠️ Message sans conversation_id, ignoré')
      return result
    }

    console.log('📧 Message reçu dans conversation:', message.conversationId)
    result.conversationId = message.conversationId

    // Chercher les emails trackés dans cette conversation
    const { data: trackedEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('conversation_id', message.conversationId)
      .eq('status', 'PENDING')

    if (error) {
      throw new Error(`Erreur lors de la recherche des emails trackés: ${error.message}`)
    }

    if (!trackedEmails?.length) {
      console.log('ℹ️ Aucun email tracké trouvé pour cette conversation')
      return { ...result, processed: true }
    }

    console.log(`🎯 ${trackedEmails.length} emails trackés trouvés dans cette conversation`)

    // Utiliser notre service de détection de réponses
    const detectionResults = await detectRepliesByConversation(message.conversationId)
    const repliesFound = detectionResults.filter(r => r.wasReply)

    if (repliesFound.length > 0) {
      console.log(`✅ ${repliesFound.length} réponses détectées via webhook`)
      result.emailsUpdated = repliesFound.length
      result.replyDetected = true

      // Enregistrer l'événement de webhook
      await supabase
        .from('webhook_events')
        .insert({
          subscription_id: notification.subscriptionId,
          change_type: notification.changeType,
          resource_data: notification.resourceData || {},
          conversation_id: message.conversationId,
          message_id: messageId,
          emails_updated: repliesFound.length,
          processed_at: new Date().toISOString()
        })
    }

    result.processed = true
    return result

  } catch (error) {
    console.error('❌ Erreur lors du traitement de la notification webhook:', error)
    result.error = error instanceof Error ? error.message : 'Erreur inconnue'

    // Enregistrer l'erreur en base
    try {
      await supabase
        .from('webhook_events')
        .insert({
          subscription_id: notification.subscriptionId,
          change_type: notification.changeType,
          resource_data: notification.resourceData || {},
          error_message: result.error,
          processed_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('❌ Impossible d\'enregistrer l\'erreur webhook:', logError)
    }

    return result
  }
}

/**
 * Extrait l'ID du message depuis l'URL de ressource
 */
function extractMessageId(resourceUrl: string): string | null {
  try {
    // Format attendu: /me/messages/{messageId} ou /Users/{userId}/Messages/{messageId}
    const matches = resourceUrl.match(/[mM]essages[/']([^/']+)/i)
    return matches ? matches[1] : null
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction de l\'ID du message:', error)
    return null
  }
}

/**
 * Synchronise périodiquement les réponses manquées par les webhooks
 */
export async function syncMissedReplies(maxAgeHours: number = 24): Promise<{
  processed: number
  updated: number
  errors: number
}> {
  let processed = 0
  let updated = 0
  let errors = 0

  try {
    console.log('🔄 Synchronisation des réponses manquées...')

    // Récupérer les emails en attente avec conversation_id
    const { data: pendingEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('status', 'PENDING')
      .not('conversation_id', 'is', null)
      .gte('sent_at', new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })

    if (error) {
      console.error('❌ Erreur lors de la récupération des emails en attente:', error)
      return { processed, updated, errors: errors + 1 }
    }

    console.log(`📊 ${pendingEmails?.length || 0} emails en attente à vérifier`)

    for (const email of pendingEmails || []) {
      processed++

      try {
        if (email.conversation_id) {
          const results = await detectRepliesByConversation(email.conversation_id)
          const replies = results.filter(r => r.wasReply)

          if (replies.length > 0) {
            updated++
            console.log(`✅ Réponse détectée pour: ${email.subject}`)
          }
        }
      } catch (error) {
        console.error(`❌ Erreur pour email ${email.id}:`, error)
        errors++
      }
    }

    console.log(`✅ Sync terminée: ${processed} traités, ${updated} mis à jour, ${errors} erreurs`)
    return { processed, updated, errors }

  } catch (error) {
    console.error('❌ Erreur dans la synchronisation des réponses manquées:', error)
    return { processed, updated, errors: errors + 1 }
  }
}