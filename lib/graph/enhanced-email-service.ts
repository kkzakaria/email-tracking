/**
 * Service d'envoi d'emails amélioré avec récupération des métadonnées
 * pour améliorer la détection des réponses
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { Message } from "@microsoft/microsoft-graph-types";
import { createGraphClient } from "../microsoft/graph-helper";

export interface EnhancedEmailResult {
  success: boolean
  messageId?: string
  conversationId?: string
  internetMessageId?: string
  error?: string
}

export interface SendEmailParams {
  to: string[]
  subject: string
  body: string
  isHtml?: boolean
}

export class EnhancedEmailService {
  private client: Client | null = null

  async initialize(): Promise<boolean> {
    try {
      this.client = await createGraphClient()
      return this.client !== null
    } catch (error) {
      console.error("Failed to initialize Enhanced Email Service:", error)
      return false
    }
  }

  /**
   * Envoie un email et récupère les métadonnées nécessaires pour le tracking
   */
  async sendEmailWithMetadata(params: SendEmailParams, trackingId?: string): Promise<EnhancedEmailResult> {
    try {
      if (!this.client) {
        if (!(await this.initialize())) {
          return { success: false, error: "Client Microsoft Graph non disponible" }
        }
      }

      // Préparer le corps de l'email avec le tracking pixel si fourni
      let body = params.body
      if (params.isHtml && trackingId) {
        const pixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/pixel/${trackingId}`
        const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`
        
        if (body.includes("</body>")) {
          body = body.replace("</body>", `${trackingPixel}</body>`)
        } else {
          body = `${body}${trackingPixel}`
        }
      }

      const message: Message = {
        subject: params.subject,
        body: {
          contentType: params.isHtml ? "html" : "text",
          content: body,
        },
        toRecipients: params.to.map(email => ({
          emailAddress: { address: email }
        })),
      }

      console.log('📤 Envoi d\'email avec récupération des métadonnées...')

      // Méthode 1: Créer un brouillon puis l'envoyer (pour récupérer les métadonnées)
      try {
        // Créer le brouillon
        const draft = await this.client!
          .api("/me/messages")
          .post(message)

        console.log('📝 Brouillon créé:', {
          id: draft.id,
          conversationId: draft.conversationId,
          internetMessageId: draft.internetMessageId
        })

        // Envoyer le brouillon
        await this.client!
          .api(`/me/messages/${draft.id}/send`)
          .post()

        console.log('✅ Email envoyé avec métadonnées récupérées')

        return {
          success: true,
          messageId: draft.id,
          conversationId: draft.conversationId,
          internetMessageId: draft.internetMessageId
        }

      } catch (draftError) {
        console.warn('⚠️ Méthode brouillon échouée, utilisation de sendMail:', draftError)
        
        // Fallback: méthode directe (pas de métadonnées)
        await this.client!
          .api("/me/sendMail")
          .post({ message })

        console.log('✅ Email envoyé (méthode fallback, pas de métadonnées)')

        return {
          success: true,
          messageId: undefined,
          conversationId: undefined,
          internetMessageId: undefined
        }
      }

    } catch (error) {
      console.error("❌ Erreur lors de l'envoi d'email:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      }
    }
  }

  /**
   * Récupère les métadonnées d'un email envoyé récemment
   * Utilisé comme fallback si la méthode brouillon échoue
   */
  async findRecentSentEmail(subject: string, recipientEmail: string, sentAfter: Date): Promise<{
    messageId?: string
    conversationId?: string
    internetMessageId?: string
  } | null> {
    try {
      if (!this.client) return null

      console.log('🔍 Recherche d\'email récemment envoyé...')

      // Chercher dans les éléments envoyés
      const messages = await this.client
        .api("/me/mailFolders/SentItems/messages")
        .filter(`subject eq '${subject}' and sentDateTime ge ${sentAfter.toISOString()}`)
        .select("id,conversationId,internetMessageId,toRecipients,sentDateTime")
        .top(10)
        .get()

      // Trouver l'email correspondant au destinataire
      const matchingMessage = messages.value?.find((msg: any) => 
        msg.toRecipients?.some((recipient: any) => 
          recipient.emailAddress.address.toLowerCase() === recipientEmail.toLowerCase()
        )
      )

      if (matchingMessage) {
        console.log('✅ Email trouvé dans les éléments envoyés')
        return {
          messageId: matchingMessage.id,
          conversationId: matchingMessage.conversationId,
          internetMessageId: matchingMessage.internetMessageId
        }
      }

      return null

    } catch (error) {
      console.error('❌ Erreur lors de la recherche d\'email envoyé:', error)
      return null
    }
  }
}

// Instance singleton
let enhancedEmailService: EnhancedEmailService | null = null

/**
 * Obtenir l'instance du service d'email amélioré
 */
export async function getEnhancedEmailService(): Promise<EnhancedEmailService> {
  if (!enhancedEmailService) {
    enhancedEmailService = new EnhancedEmailService()
    await enhancedEmailService.initialize()
  }
  return enhancedEmailService
}