'use server'

import { createGraphClient } from '@/lib/microsoft/graph-helper'
import { createClient } from '@/utils/supabase/server'
import { createEmailTracking, getEmailTrackings, updateEmailTracking } from '@/lib/supabase/email-service'

/**
 * Service pour synchroniser les emails envoyés depuis Outlook
 * avec notre système de tracking
 */

export interface OutlookSyncResult {
  success: boolean
  newEmailsTracked: number
  updatedEmails: number
  errors: string[]
}

/**
 * Synchronise les emails récents envoyés depuis Outlook
 * et les ajoute au tracking s'ils ne sont pas déjà présents
 */
export async function syncOutlookSentEmails(hoursBack: number = 24): Promise<OutlookSyncResult> {
  const result: OutlookSyncResult = {
    success: true,
    newEmailsTracked: 0,
    updatedEmails: 0,
    errors: []
  }

  try {
    console.log(`🔄 Synchronisation des emails envoyés depuis ${hoursBack}h...`)

    // 1. Créer le client Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      throw new Error('Client Microsoft Graph non disponible')
    }

    // 2. Récupérer les emails existants dans notre base
    const existingEmails = await getEmailTrackings()
    const existingMessageIds = new Set(existingEmails.map(e => e.message_id))
    const existingInternetIds = new Set(existingEmails.map(e => e.internet_message_id).filter(Boolean))

    // 3. Récupérer les emails récents depuis Outlook
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
    
    const sentEmails = await graphClient
      .api('/me/mailFolders/SentItems/messages')
      .filter(`sentDateTime gt ${since}`)
      .select('id,internetMessageId,conversationId,subject,toRecipients,sentDateTime,from')
      .orderby('sentDateTime desc')
      .top(50)
      .get()

    console.log(`📧 ${sentEmails.value?.length || 0} emails trouvés dans Outlook`)

    // 4. Traiter chaque email
    for (const email of sentEmails.value || []) {
      try {
        const internetMessageId = email.internetMessageId
        const messageId = email.id
        const conversationId = email.conversationId

        // Vérifier si cet email est déjà tracké
        const isAlreadyTracked = existingMessageIds.has(messageId) || 
                                (internetMessageId && existingInternetIds.has(internetMessageId))

        if (!isAlreadyTracked) {
          // Nouvel email à tracker
          const toRecipients = email.toRecipients || []
          if (toRecipients.length > 0) {
            const recipientEmail = toRecipients[0].emailAddress?.address

            if (recipientEmail) {
              console.log(`➕ Ajout de l'email: ${email.subject} → ${recipientEmail}`)

              await createEmailTracking({
                recipient_email: recipientEmail,
                subject: email.subject || 'Sans sujet',
                message_id: messageId,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
              })

              // Mettre à jour avec les métadonnées complètes
              const newTrackings = await getEmailTrackings()
              const newTracking = newTrackings.find(t => t.message_id === messageId)
              
              if (newTracking) {
                await updateEmailTracking(newTracking.id, {
                  conversation_id: conversationId,
                  internet_message_id: internetMessageId,
                  reply_detection_method: 'outlook_sync'
                })
              }

              result.newEmailsTracked++
            }
          }
        } else {
          // Email déjà tracké - mettre à jour les métadonnées si nécessaire
          const existingEmail = existingEmails.find(e => 
            e.message_id === messageId || 
            (internetMessageId && e.internet_message_id === internetMessageId)
          )

          if (existingEmail && (!existingEmail.conversation_id || !existingEmail.internet_message_id)) {
            console.log(`🔄 Mise à jour des métadonnées: ${existingEmail.subject}`)
            
            await updateEmailTracking(existingEmail.id, {
              conversation_id: conversationId,
              internet_message_id: internetMessageId,
              reply_detection_method: 'outlook_sync_update'
            })

            result.updatedEmails++
          }
        }

      } catch (emailError) {
        const errorMsg = `Erreur lors du traitement de l'email ${email.subject}: ${emailError}`
        console.error('❌', errorMsg)
        result.errors.push(errorMsg)
      }
    }

    console.log(`✅ Synchronisation terminée: ${result.newEmailsTracked} nouveaux, ${result.updatedEmails} mis à jour`)

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation Outlook:', error)
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue')
  }

  return result
}

/**
 * Met à jour les métadonnées manquantes pour les emails existants
 */
export async function updateMissingMetadata(): Promise<OutlookSyncResult> {
  const result: OutlookSyncResult = {
    success: true,
    newEmailsTracked: 0,
    updatedEmails: 0,
    errors: []
  }

  try {
    console.log('🔄 Mise à jour des métadonnées manquantes...')

    const graphClient = await createGraphClient()
    if (!graphClient) {
      throw new Error('Client Microsoft Graph non disponible')
    }

    const existingEmails = await getEmailTrackings()
    const emailsNeedingUpdate = existingEmails.filter(email => 
      !email.conversation_id || !email.internet_message_id
    )

    console.log(`📧 ${emailsNeedingUpdate.length} emails nécessitent une mise à jour`)

    for (const email of emailsNeedingUpdate) {
      try {
        // Chercher cet email dans Outlook par sujet et destinataire
        const searchQuery = `subject:"${email.subject.replace(/"/g, '""')}" AND to:${email.recipient_email}`
        
        const searchResults = await graphClient
          .api('/me/messages')
          .search(searchQuery)
          .select('id,internetMessageId,conversationId,subject,toRecipients,sentDateTime')
          .top(5)
          .get()

        const matchingEmail = searchResults.value?.find((outlookEmail: any) => 
          outlookEmail.subject === email.subject &&
          outlookEmail.toRecipients?.some((recipient: any) => 
            recipient.emailAddress?.address === email.recipient_email
          )
        )

        if (matchingEmail) {
          console.log(`🔄 Mise à jour: ${email.subject}`)
          
          await updateEmailTracking(email.id, {
            conversation_id: matchingEmail.conversationId,
            internet_message_id: matchingEmail.internetMessageId,
            reply_detection_method: 'metadata_update'
          })

          result.updatedEmails++
        }

      } catch (emailError) {
        const errorMsg = `Erreur mise à jour ${email.subject}: ${emailError}`
        console.error('❌', errorMsg)
        result.errors.push(errorMsg)
      }
    }

    console.log(`✅ Mise à jour terminée: ${result.updatedEmails} emails mis à jour`)

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des métadonnées:', error)
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue')
  }

  return result
}

/**
 * Synchronise et détecte les réponses pour tous les emails en attente
 */
export async function syncAndDetectReplies(): Promise<OutlookSyncResult> {
  const result: OutlookSyncResult = {
    success: true,
    newEmailsTracked: 0,
    updatedEmails: 0,
    errors: []
  }

  try {
    console.log('🔄 Synchronisation et détection des réponses...')

    // 1. D'abord synchroniser les nouveaux emails
    const syncResult = await syncOutlookSentEmails(24)
    result.newEmailsTracked = syncResult.newEmailsTracked
    result.errors.push(...syncResult.errors)

    // 2. Ensuite détecter les réponses
    const { detectRepliesByConversation } = await import('@/lib/services/reply-detection')
    const supabase = createClient()
    
    const { data: pendingEmails } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('status', 'PENDING')
      .not('conversation_id', 'is', null)
      .limit(20)

    console.log(`🎯 ${pendingEmails?.length || 0} emails en attente avec conversation_id`)

    for (const email of pendingEmails || []) {
      try {
        if (email.conversation_id) {
          const detectionResults = await detectRepliesByConversation(email.conversation_id)
          const replies = detectionResults.filter(r => r.wasReply)
          
          if (replies.length > 0) {
            result.updatedEmails++
          }
        }
      } catch (error) {
        console.error(`❌ Erreur détection pour ${email.id}:`, error)
        result.errors.push(`Erreur détection ${email.subject}: ${error}`)
      }
    }

    console.log(`✅ Synchronisation complète: ${result.newEmailsTracked} nouveaux, ${result.updatedEmails} mis à jour`)

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation complète:', error)
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue')
  }

  return result
}