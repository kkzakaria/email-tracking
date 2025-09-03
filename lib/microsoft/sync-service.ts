import { createGraphClient } from './graph-helper'
import { createEmailTracking, getEmailTrackings, updateEmailTracking } from '@/lib/supabase/email-service'

export interface OutlookMessage {
  id: string
  internetMessageId: string
  conversationId: string
  subject: string
  sentDateTime: string
  toRecipients: Array<{
    emailAddress: {
      address: string
      name?: string
    }
  }>
  body: {
    contentType: string
    content: string
  }
}

/**
 * Vérifie si un email a reçu une réponse en comptant les messages dans la conversation
 */
async function hasEmailReceivedReply(graphClient: any, conversationId: string): Promise<boolean> {
  try {
    // Récupérer tous les messages de cette conversation
    const conversation = await graphClient
      .api(`/me/messages`)
      .filter(`conversationId eq '${conversationId}'`)
      .select('id,subject,from,sentDateTime')
      .get()

    // Si la conversation contient plus d'un message, il y a eu des réponses
    return conversation.value && conversation.value.length > 1
  } catch (error) {
    console.error('Erreur lors de la vérification des réponses:', error)
    // En cas d'erreur, on assume qu'il n'y a pas de réponse pour être sûr de tracker
    return false
  }
}

/**
 * Synchronise les emails envoyés depuis Outlook avec notre système de tracking
 * SEULEMENT les emails qui n'ont PAS reçu de réponse
 */
export async function syncOutlookSentEmails(options?: {
  includeRepliedEmails?: boolean
  days?: number
}): Promise<{
  success: boolean
  newTrackedEmails: number
  updatedTrackedEmails: number
  skippedRepliedEmails: number
  error?: string
}> {
  try {
    const { includeRepliedEmails = false, days = 7 } = options || {}
    
    console.log('🔄 Synchronisation des emails Outlook sans réponse...')
    console.log(`📅 Période: ${days} derniers jours | Inclure réponses: ${includeRepliedEmails}`)
    
    // Obtenir le client Microsoft Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      return {
        success: false,
        newTrackedEmails: 0,
        updatedTrackedEmails: 0,
        skippedRepliedEmails: 0,
        error: 'Client Microsoft Graph non disponible'
      }
    }

    // Obtenir les emails déjà trackés pour gérer les doublons et mises à jour
    const existingTracked = await getEmailTrackings()
    const trackedMessageIds = new Set(
      existingTracked.map(t => t.message_id).filter(Boolean)
    )
    
    // Créer une map pour accéder facilement aux emails trackés par message ID
    const trackedEmailsMap = new Map(
      existingTracked.map(email => [email.message_id, email])
    )

    // Récupérer les emails récents du dossier "Éléments envoyés"
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)

    console.log('📧 Récupération des emails envoyés...')
    const sentItems = await graphClient
      .api('/me/mailFolders/SentItems/messages')
      .filter(`sentDateTime ge ${daysAgo.toISOString()}`)
      .orderby('sentDateTime desc')
      .top(50)
      .select('id,internetMessageId,conversationId,subject,sentDateTime,toRecipients,body')
      .get()

    if (!sentItems.value || sentItems.value.length === 0) {
      console.log('✅ Aucun email trouvé dans les éléments envoyés')
      return {
        success: true,
        newTrackedEmails: 0,
        updatedTrackedEmails: 0,
        skippedRepliedEmails: 0
      }
    }

    console.log(`📊 ${sentItems.value.length} emails trouvés dans les éléments envoyés`)

    let newTrackedEmails = 0
    let updatedTrackedEmails = 0
    let skippedRepliedEmails = 0

    // Traiter chaque email envoyé
    for (const message of sentItems.value as OutlookMessage[]) {
      try {
        const messageId = message.internetMessageId || message.id
        
        // 🔄 VÉRIFIER SI EMAIL DÉJÀ TRACKÉ ET METTRE À JOUR SI NÉCESSAIRE
        if (trackedMessageIds.has(messageId)) {
          const trackedEmail = trackedEmailsMap.get(messageId)
          
          // Si l'email tracké est encore en PENDING, vérifier s'il a maintenant une réponse
          if (trackedEmail && trackedEmail.status === 'PENDING') {
            const hasReply = await hasEmailReceivedReply(graphClient, message.conversationId)
            
            if (hasReply) {
              console.log(`🔄 Mise à jour d'email tracké (a reçu une réponse): ${message.subject}`)
              
              // Mettre à jour le statut vers REPLIED
              await updateEmailTracking(trackedEmail.id, {
                status: 'REPLIED',
                reply_received_at: new Date().toISOString()
              })
              
              updatedTrackedEmails++
            }
          }
          
          continue // Email déjà tracké, passer au suivant
        }

        // Vérifier qu'il y a au moins un destinataire
        if (!message.toRecipients || message.toRecipients.length === 0) {
          continue
        }

        // 🎯 NOUVELLE LOGIQUE: Vérifier si l'email a reçu une réponse
        if (!includeRepliedEmails) {
          const hasReply = await hasEmailReceivedReply(graphClient, message.conversationId)
          if (hasReply) {
            console.log(`⏭️ Email ignoré (a reçu une réponse): ${message.subject}`)
            skippedRepliedEmails++
            continue
          }
        }

        const recipient = message.toRecipients[0].emailAddress.address

        // Créer un enregistrement de tracking pour cet email Outlook SANS RÉPONSE
        const trackingData = {
          recipient_email: recipient,
          subject: message.subject || 'Sans sujet',
          message_id: messageId,
          expires_at: undefined // Pas d'expiration pour les emails Outlook
        }

        console.log('📝 Création du tracking pour email sans réponse:', {
          subject: message.subject,
          recipient: recipient,
          messageId: messageId,
          conversationId: message.conversationId
        })

        const emailTracking = await createEmailTracking(trackingData)

        console.log(`✅ Email Outlook tracké: ${emailTracking.id}`)
        newTrackedEmails++

        // Limite de sécurité pour éviter de surcharger
        if (newTrackedEmails >= 20) {
          console.log('⚠️ Limite de 20 nouveaux trackings atteinte')
          break
        }

      } catch (error) {
        console.error(`❌ Erreur lors du tracking de l'email ${message.subject}:`, error)
        // Continuer avec les autres emails
      }
    }

    console.log(`✅ Synchronisation terminée:`)
    console.log(`  📧 ${newTrackedEmails} nouveaux emails sans réponse trackés`)
    console.log(`  🔄 ${updatedTrackedEmails} emails trackés mis à jour (ont reçu des réponses)`)
    console.log(`  ⏭️ ${skippedRepliedEmails} emails avec réponses ignorés`)

    return {
      success: true,
      newTrackedEmails,
      updatedTrackedEmails,
      skippedRepliedEmails
    }

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation Outlook:', error)
    return {
      success: false,
      newTrackedEmails: 0,
      updatedTrackedEmails: 0,
      skippedRepliedEmails: 0,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

/**
 * Fonction utilitaire pour détecter si un email contient du tracking
 */
export function hasTrackingElements(htmlContent: string): boolean {
  // Rechercher les éléments typiques de tracking
  const trackingIndicators = [
    '/api/emails/pixel/',     // Notre pixel de tracking
    '/api/emails/click/',     // Nos liens de tracking
    'width="1" height="1"',   // Pixels invisibles
    'display: none',          // Éléments cachés
  ]

  return trackingIndicators.some(indicator => 
    htmlContent.toLowerCase().includes(indicator.toLowerCase())
  )
}

/**
 * Obtient les emails Outlook récents avec plus de détails
 */
export async function getRecentOutlookEmails(days: number = 7): Promise<OutlookMessage[]> {
  try {
    const graphClient = await createGraphClient()
    if (!graphClient) {
      return []
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const response = await graphClient
      .api('/me/mailFolders/SentItems/messages')
      .filter(`sentDateTime ge ${startDate.toISOString()}`)
      .orderby('sentDateTime desc')
      .top(100)
      .select('id,internetMessageId,subject,sentDateTime,toRecipients,body,hasAttachments')
      .get()

    return response.value || []

  } catch (error) {
    console.error('Erreur lors de la récupération des emails Outlook:', error)
    return []
  }
}