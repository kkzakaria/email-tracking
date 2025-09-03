import { createGraphClient } from './graph-helper'
import { createEmailTracking, EmailTrackingInsert } from '@/lib/supabase/email-service'

export interface TrackedEmailOptions {
  to: string
  subject: string
  htmlBody?: string
  textBody?: string
  // Optionnel: date d'expiration du tracking
  expiresAt?: string
}

export interface TrackedEmailResponse {
  success: boolean
  trackingId?: string
  messageId?: string
  error?: string
}

/**
 * Génère le pixel de tracking HTML à insérer dans l'email
 */
function generateTrackingPixel(trackingId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `<img src="${baseUrl}/api/emails/pixel/${trackingId}" width="1" height="1" alt="" style="display: none;" />`
}

/**
 * Traite les liens dans le contenu HTML pour ajouter le tracking
 */
function processLinksForTracking(htmlContent: string, trackingId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  // Regex pour trouver tous les liens <a href="...">
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href\s*=\s*["']([^"']+)["'][^>]*>/gi
  
  return htmlContent.replace(linkRegex, (match, originalUrl) => {
    // Éviter de tracker les liens internes de tracking
    if (originalUrl.includes('/api/emails/')) {
      return match
    }
    
    // Créer l'URL de tracking
    const encodedUrl = encodeURIComponent(originalUrl)
    const trackingUrl = `${baseUrl}/api/emails/click/${trackingId}?url=${encodedUrl}`
    
    // Remplacer l'URL originale par l'URL de tracking
    return match.replace(originalUrl, trackingUrl)
  })
}

/**
 * Envoie un email tracké via Microsoft Graph API
 */
export async function sendTrackedEmail(options: TrackedEmailOptions): Promise<TrackedEmailResponse> {
  try {
    const { to, subject, htmlBody, textBody, expiresAt } = options
    
    // Validation des paramètres
    if (!to || !subject) {
      return {
        success: false,
        error: 'Destinataire et sujet requis'
      }
    }
    
    if (!htmlBody && !textBody) {
      return {
        success: false,
        error: 'Contenu HTML ou texte requis'
      }
    }
    
    // Créer le client Microsoft Graph
    const graphClient = await createGraphClient()
    if (!graphClient) {
      return {
        success: false,
        error: 'Impossible de créer le client Microsoft Graph. Vérifiez votre connexion Microsoft.'
      }
    }
    
    // 1. CRÉER D'ABORD l'enregistrement de tracking pour avoir le vrai ID
    console.log('📝 Création de l\'enregistrement de tracking...')
    const trackingData: EmailTrackingInsert = {
      recipient_email: to,
      subject: subject,
      message_id: `temp-${crypto.randomUUID()}`, // ID temporaire, sera mis à jour
      expires_at: expiresAt
    }
    
    const emailTracking = await createEmailTracking(trackingData)
    const realTrackingId = emailTracking.id
    
    console.log('✅ Tracking ID créé:', realTrackingId)
    
    // 2. PRÉPARER le contenu avec le VRAI tracking ID
    let processedHtmlBody = htmlBody || ''
    const processedTextBody = textBody || ''
    
    if (htmlBody) {
      // Ajouter le tracking des liens avec le VRAI ID
      processedHtmlBody = processLinksForTracking(htmlBody, realTrackingId)
      
      // Ajouter le pixel de tracking avec le VRAI ID
      const trackingPixel = generateTrackingPixel(realTrackingId)
      
      // Insérer le pixel avant la fermeture du body ou à la fin
      if (processedHtmlBody.includes('</body>')) {
        processedHtmlBody = processedHtmlBody.replace('</body>', `${trackingPixel}</body>`)
      } else {
        processedHtmlBody += trackingPixel
      }
    }
    
    // 3. CONSTRUIRE le message avec le contenu tracké
    const message = {
      subject: subject,
      body: {
        contentType: htmlBody ? 'HTML' : 'Text',
        content: htmlBody ? processedHtmlBody : processedTextBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    }
    
    // 4. ENVOYER l'email via Microsoft Graph
    console.log('🚀 Envoi de l\'email via Microsoft Graph...')
    await graphClient
      .api('/me/sendMail')
      .post({
        message: message,
        saveToSentItems: true
      })
    
    console.log('✅ Email envoyé avec succès')
    
    // 5. OPTIONNEL: Récupérer le message ID réel depuis les messages envoyés
    // (pour une correspondance plus précise)
    try {
      const sentItems = await graphClient
        .api('/me/mailFolders/SentItems/messages')
        .filter(`subject eq '${subject.replace(/'/g, "''")}'`)
        .orderby('sentDateTime desc')
        .top(1)
        .get()
      
      if (sentItems.value && sentItems.value.length > 0) {
        const realMessageId = sentItems.value[0].internetMessageId || sentItems.value[0].id
        console.log('✅ Message ID récupéré:', realMessageId)
        
        // Mettre à jour le tracking record avec le vrai message ID
        const { updateEmailTracking } = await import('@/lib/supabase/email-service')
        await updateEmailTracking(realTrackingId, { message_id: realMessageId })
      }
    } catch (error) {
      console.log('⚠️ Impossible de récupérer le message ID réel:', error)
      // Ce n'est pas critique, on continue avec l'ID temporaire
    }
    
    return {
      success: true,
      trackingId: realTrackingId,
      messageId: emailTracking.message_id
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email tracké:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

/**
 * Obtient les statistiques d'un email tracké
 */
export async function getEmailTrackingStats(trackingId: string) {
  // Cette fonction sera étendue plus tard avec la table email_events
  // Pour l'instant, utilise les données de base de email_tracking
  return {
    trackingId,
    opened: false, // sera déterminé par le statut REPLIED
    clicks: 0,     // sera ajouté avec la table email_events
    lastActivity: null
  }
}