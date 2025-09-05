/**
 * Service amélioré pour la détection des réponses aux emails trackés
 * Corrige les problèmes de matching par subject en utilisant conversation_id
 */

import { createClient } from '@supabase/supabase-js'
import { createGraphClient } from '@/lib/microsoft/graph-helper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ReplyDetectionResult {
  emailId: string
  wasReply: boolean
  detectionMethod: 'conversation_id' | 'subject_matching' | 'sync_check'
  replyTime?: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Détection améliorée des réponses via conversation_id
 */
export async function detectRepliesByConversation(
  conversationId: string,
  originalMessageId?: string
): Promise<ReplyDetectionResult[]> {
  const results: ReplyDetectionResult[] = []

  try {
    console.log('🔍 Détection de réponses pour conversation:', conversationId)

    // 1. Chercher les emails trackés avec cette conversation_id
    const { data: trackedEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('status', 'PENDING')

    if (error) {
      console.error('❌ Erreur lors de la recherche des emails trackés:', error)
      return results
    }

    if (!trackedEmails?.length) {
      console.log('ℹ️ Aucun email tracké trouvé pour cette conversation')
      return results
    }

    // 2. Utiliser Microsoft Graph pour vérifier les réponses
    const graphClient = await createGraphClient()
    if (!graphClient) {
      console.error('❌ Client Microsoft Graph non disponible')
      return results
    }

    // 3. Récupérer tous les messages de cette conversation
    const conversation = await graphClient
      .api('/me/messages')
      .filter(`conversationId eq '${conversationId}'`)
      .select('id,internetMessageId,from,to,sentDateTime,receivedDateTime,subject')
      .orderby('sentDateTime desc')
      .get()

    const messages = conversation.value || []
    console.log(`📧 ${messages.length} messages trouvés dans la conversation`)

    // 4. Analyser chaque email tracké
    for (const trackedEmail of trackedEmails) {
      const result: ReplyDetectionResult = {
        emailId: trackedEmail.id,
        wasReply: false,
        detectionMethod: 'conversation_id',
        confidence: 'high'
      }

      // Chercher l'email original
      const originalMessage = messages.find(msg => 
        msg.internetMessageId === trackedEmail.internet_message_id ||
        msg.id === originalMessageId
      )

      if (!originalMessage) {
        console.log(`⚠️ Email original non trouvé pour ${trackedEmail.id}`)
        result.confidence = 'low'
        results.push(result)
        continue
      }

      // Chercher des réponses après l'email original
      const repliesAfterOriginal = messages.filter(msg => {
        const msgTime = new Date(msg.sentDateTime || msg.receivedDateTime)
        const originalTime = new Date(originalMessage.sentDateTime)
        return msgTime > originalTime && msg.id !== originalMessage.id
      })

      if (repliesAfterOriginal.length > 0) {
        const firstReply = repliesAfterOriginal[repliesAfterOriginal.length - 1]
        
        console.log(`✅ Réponse détectée pour email ${trackedEmail.id}`)
        
        result.wasReply = true
        result.replyTime = firstReply.receivedDateTime || firstReply.sentDateTime

        // Mettre à jour le statut en base
        await supabase
          .from('email_tracking')
          .update({
            status: 'REPLIED',
            reply_received_at: result.replyTime,
            reply_detection_method: 'conversation_id'
          })
          .eq('id', trackedEmail.id)
      }

      results.push(result)
    }

    return results

  } catch (error) {
    console.error('❌ Erreur dans la détection des réponses:', error)
    return results
  }
}

/**
 * Détection de réponses par matching de subject (fallback)
 */
export async function detectRepliesBySubject(
  subject: string,
  sentAfter: string
): Promise<ReplyDetectionResult[]> {
  const results: ReplyDetectionResult[] = []

  try {
    // Nettoyer le subject pour le matching
    const cleanSubject = subject.replace(/^(RE:|Re:|FW:|Fw:)\s*/i, '').trim()

    // Chercher les emails trackés avec un subject similaire
    const { data: trackedEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('status', 'PENDING')
      .ilike('subject', `%${cleanSubject}%`)
      .gt('sent_at', sentAfter)

    if (error || !trackedEmails?.length) {
      return results
    }

    // Utiliser Microsoft Graph pour vérifier
    const graphClient = await createGraphClient()
    if (!graphClient) return results

    for (const trackedEmail of trackedEmails) {
      const result: ReplyDetectionResult = {
        emailId: trackedEmail.id,
        wasReply: false,
        detectionMethod: 'subject_matching',
        confidence: 'medium' // Moins fiable que conversation_id
      }

      // Chercher des messages avec le subject en mode réponse
      const messages = await graphClient
        .api('/me/messages')
        .filter(`startswith(subject, 'RE:') or startswith(subject, 'Re:')`)
        .filter(`contains(subject, '${cleanSubject}')`)
        .select('id,subject,sentDateTime,receivedDateTime')
        .get()

      const replies = messages.value?.filter((msg: any) => {
        const msgTime = new Date(msg.receivedDateTime || msg.sentDateTime)
        const sentTime = new Date(trackedEmail.sent_at)
        return msgTime > sentTime
      }) || []

      if (replies.length > 0) {
        result.wasReply = true
        result.replyTime = replies[0].receivedDateTime || replies[0].sentDateTime

        await supabase
          .from('email_tracking')
          .update({
            status: 'REPLIED',
            reply_received_at: result.replyTime,
            reply_detection_method: 'subject_matching'
          })
          .eq('id', trackedEmail.id)
      }

      results.push(result)
    }

    return results

  } catch (error) {
    console.error('❌ Erreur dans la détection par subject:', error)
    return results
  }
}

/**
 * Synchronisation complète pour détecter toutes les réponses manquées
 */
export async function syncAllPendingReplies(maxAge: number = 30): Promise<{
  processed: number
  updated: number
  errors: number
}> {
  let processed = 0
  let updated = 0
  let errors = 0

  try {
    console.log('🔄 Synchronisation complète des réponses...')

    // Récupérer tous les emails PENDING récents
    const { data: pendingEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('status', 'PENDING')
      .gte('sent_at', new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })

    if (error) {
      console.error('❌ Erreur lors de la récupération des emails pending:', error)
      return { processed, updated, errors: errors + 1 }
    }

    console.log(`📊 ${pendingEmails?.length || 0} emails à vérifier`)

    for (const email of pendingEmails || []) {
      processed++

      try {
        let results: ReplyDetectionResult[] = []

        // Méthode 1: Par conversation_id si disponible
        if (email.conversation_id) {
          results = await detectRepliesByConversation(email.conversation_id)
        }

        // Méthode 2: Par subject si pas de résultat
        if (results.length === 0 || !results.some(r => r.wasReply)) {
          const subjectResults = await detectRepliesBySubject(email.subject, email.sent_at)
          results.push(...subjectResults)
        }

        // Compter les updates
        if (results.some(r => r.wasReply)) {
          updated++
        }

        // Mettre à jour last_sync_check
        await supabase
          .from('email_tracking')
          .update({ last_sync_check: new Date().toISOString() })
          .eq('id', email.id)

      } catch (error) {
        console.error(`❌ Erreur pour email ${email.id}:`, error)
        errors++
      }
    }

    console.log(`✅ Sync terminée: ${processed} traités, ${updated} mis à jour, ${errors} erreurs`)
    return { processed, updated, errors }

  } catch (error) {
    console.error('❌ Erreur dans la synchronisation complète:', error)
    return { processed, updated, errors: errors + 1 }
  }
}