/**
 * Service de détection de réponses basé sur la base de données
 * Utilise les triggers et fonctions PostgreSQL pour une détection automatique
 */

import { createClient } from '@supabase/supabase-js'
import { createGraphClient } from '@/lib/microsoft/graph-helper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ReceivedMessage {
  message_id: string
  internet_message_id?: string
  conversation_id?: string
  subject?: string
  from_email?: string
  to_email?: string
  received_at?: string
  body_preview?: string
  is_read?: boolean
}

export interface DatabaseSyncResult {
  success: boolean
  processed_count: number
  replied_count: number
  errors: string[]
  messages_synced: number
}

/**
 * Synchronise les messages reçus depuis Microsoft Graph vers la base de données
 * La détection des réponses se fait automatiquement via les triggers DB
 */
export async function syncReceivedMessagesFromGraph(
  userId: string,
  hoursBack: number = 24
): Promise<DatabaseSyncResult> {
  const result: DatabaseSyncResult = {
    success: true,
    processed_count: 0,
    replied_count: 0,
    errors: [],
    messages_synced: 0
  }

  try {
    console.log(`📨 Synchronisation messages reçus depuis ${hoursBack}h pour user ${userId}`)

    // Créer le client Microsoft Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      throw new Error('Client Microsoft Graph non disponible')
    }

    // Récupérer les messages reçus récents
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
    
    const receivedMessages = await graphClient
      .api('/me/messages')
      .filter(`receivedDateTime gt ${since}`)
      .select('id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead')
      .orderby('receivedDateTime desc')
      .top(100) // Limiter pour éviter la surcharge
      .get()

    console.log(`📧 ${receivedMessages.value?.length || 0} messages reçus trouvés`)

    if (!receivedMessages.value?.length) {
      return result
    }

    // Préparer les données pour le batch sync
    const messages: ReceivedMessage[] = receivedMessages.value.map((msg: any) => ({
      message_id: msg.id,
      internet_message_id: msg.internetMessageId,
      conversation_id: msg.conversationId,
      subject: msg.subject,
      from_email: msg.from?.emailAddress?.address,
      to_email: msg.toRecipients?.[0]?.emailAddress?.address,
      received_at: msg.receivedDateTime,
      body_preview: msg.bodyPreview?.substring(0, 500), // Limiter la taille
      is_read: msg.isRead
    }))

    // Utiliser la fonction PostgreSQL pour sync en batch
    const { data: syncResult, error } = await supabase.rpc('batch_sync_received_messages', {
      p_user_id: userId,
      p_messages: JSON.stringify(messages)
    })

    if (error) {
      throw new Error(`Erreur lors du batch sync: ${error.message}`)
    }

    result.processed_count = syncResult[0]?.processed_count || 0
    result.replied_count = syncResult[0]?.replied_count || 0
    result.messages_synced = messages.length

    console.log(`✅ Sync terminée: ${result.messages_synced} messages, ${result.replied_count} réponses détectées`)

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error)
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue')
  }

  return result
}

/**
 * Synchronise un seul message reçu (utile pour les webhooks en temps réel)
 */
export async function syncSingleReceivedMessage(
  userId: string,
  messageData: ReceivedMessage
): Promise<{ success: boolean; replied_detected: boolean; error?: string }> {
  try {
    console.log(`📨 Sync message unique: ${messageData.message_id}`)

    // Compter les réponses avant
    const { count: beforeCount } = await supabase
      .from('email_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'REPLIED')

    // Synchroniser le message (trigger se déclenche automatiquement)
    const { data, error } = await supabase.rpc('sync_received_message', {
      p_user_id: userId,
      p_message_id: messageData.message_id,
      p_internet_message_id: messageData.internet_message_id,
      p_conversation_id: messageData.conversation_id,
      p_subject: messageData.subject,
      p_from_email: messageData.from_email,
      p_to_email: messageData.to_email,
      p_received_at: messageData.received_at,
      p_body_preview: messageData.body_preview,
      p_is_read: messageData.is_read
    })

    if (error) {
      throw new Error(`Erreur sync message: ${error.message}`)
    }

    // Compter les réponses après
    const { count: afterCount } = await supabase
      .from('email_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'REPLIED')

    const replyDetected = (afterCount || 0) > (beforeCount || 0)

    if (replyDetected) {
      console.log(`✅ Réponse détectée via trigger pour message ${messageData.message_id}`)
    }

    return {
      success: true,
      replied_detected: replyDetected
    }

  } catch (error) {
    console.error(`❌ Erreur sync message ${messageData.message_id}:`, error)
    return {
      success: false,
      replied_detected: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

/**
 * Obtient les statistiques de détection pour un utilisateur
 */
export async function getUserDetectionStats(userId: string) {
  try {
    const { data: stats, error } = await supabase
      .from('email_detection_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
      throw error
    }

    return stats || {
      user_id: userId,
      total_emails: 0,
      replied_emails: 0,
      pending_emails: 0,
      with_conversation_id: 0,
      detected_by_trigger: 0,
      avg_reply_time_hours: null
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats:', error)
    return null
  }
}

/**
 * Diagnostic complet pour un utilisateur
 */
export async function diagnoseUserTracking(userId: string) {
  try {
    const { data: diagnosis, error } = await supabase.rpc('diagnose_user_tracking', {
      p_user_id: userId
    })

    if (error) {
      throw error
    }

    return diagnosis || []

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error)
    return []
  }
}

/**
 * Nettoyage des anciens messages reçus (pour éviter l'accumulation)
 */
export async function cleanupOldReceivedMessages(daysToKeep: number = 30): Promise<{
  deleted: number
  errors: string[]
}> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()
    
    const { count, error } = await supabase
      .from('received_messages')
      .delete({ count: 'exact' })
      .lt('received_at', cutoffDate)

    if (error) {
      throw error
    }

    console.log(`🧹 Nettoyage: ${count || 0} anciens messages supprimés (>${daysToKeep} jours)`)

    return {
      deleted: count || 0,
      errors: []
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error)
    return {
      deleted: 0,
      errors: [error instanceof Error ? error.message : 'Erreur inconnue']
    }
  }
}

/**
 * Synchronisation complète pour un utilisateur (messages + diagnostic)
 */
export async function fullUserSync(userId: string): Promise<{
  messages_result: DatabaseSyncResult
  stats: any
  diagnosis: any[]
}> {
  console.log(`🔄 Synchronisation complète pour utilisateur ${userId}`)

  // 1. Synchroniser les messages reçus
  const messagesResult = await syncReceivedMessagesFromGraph(userId, 72) // 3 jours

  // 2. Obtenir les statistiques
  const stats = await getUserDetectionStats(userId)

  // 3. Diagnostic complet
  const diagnosis = await diagnoseUserTracking(userId)

  console.log(`✅ Sync complète terminée: ${messagesResult.replied_count} nouvelles réponses`)

  return {
    messages_result: messagesResult,
    stats,
    diagnosis
  }
}