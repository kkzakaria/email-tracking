// ====================================================================================================
// SUPABASE EDGE FUNCTION: email-sender (Phase 2)
// ====================================================================================================
// Description: Envoi d'emails via Microsoft Graph avec tracking automatique
// URL: https://[project-id].supabase.co/functions/v1/email-sender
// Version: 1.0 - Phase 2 interface reconstruction
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EmailRequest {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  bodyType?: 'text' | 'html'
  attachments?: Array<{
    name: string
    contentType: string
    contentBytes: string // Base64 encoded
  }>
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

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

/**
 * Envoyer un email via Microsoft Graph
 */
async function sendEmailViaGraph(emailRequest: EmailRequest): Promise<string> {
  const accessToken = await getApplicationToken()
  const serviceEmail = 'service-exploitation@karta-transit.ci'

  // Construire le message Microsoft Graph
  const graphMessage = {
    message: {
      subject: emailRequest.subject,
      body: {
        contentType: emailRequest.bodyType === 'html' ? 'HTML' : 'Text',
        content: emailRequest.body
      },
      toRecipients: emailRequest.to.map(email => ({
        emailAddress: { address: email }
      })),
      ccRecipients: emailRequest.cc?.map(email => ({
        emailAddress: { address: email }
      })) || [],
      bccRecipients: emailRequest.bcc?.map(email => ({
        emailAddress: { address: email }
      })) || [],
      attachments: emailRequest.attachments?.map(attachment => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.name,
        contentType: attachment.contentType,
        contentBytes: attachment.contentBytes
      })) || []
    },
    saveToSentItems: true
  }

  console.log('📤 Envoi email via Microsoft Graph:', {
    to: emailRequest.to,
    subject: emailRequest.subject,
    attachments: emailRequest.attachments?.length || 0
  })

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${serviceEmail}/sendMail`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphMessage)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur envoi email Graph:', response.status, errorText)
    throw new Error(`Erreur envoi email: ${response.status} - ${errorText}`)
  }

  // Microsoft Graph sendMail retourne 202 Accepted sans contenu pour un envoi réussi
  console.log('✅ Email envoyé avec succès via Microsoft Graph')

  // Retourner un ID temporaire (Microsoft Graph ne retourne pas l'ID immédiatement)
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Créer l'entrée de tracking pour l'email envoyé
 */
async function createTrackingEntry(emailRequest: EmailRequest, messageId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Créer une entrée pour chaque destinataire principal
  for (const recipient of emailRequest.to) {
    const { error } = await supabase
      .from('tracked_emails')
      .insert({
        message_id: messageId,
        subject: emailRequest.subject,
        recipient_email: recipient,
        sender_email: 'service-exploitation@karta-transit.ci',
        sent_at: new Date().toISOString(),
        status: 'PENDING',
        user_id: null, // Architecture application permissions
        last_checked: new Date().toISOString(),
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Erreur création tracking:', error)
    } else {
      console.log(`✅ Tracking créé pour: ${recipient}`)
    }
  }
}

// Fonction utilitaire pour les réponses
function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    }
  )
}

// ====================================================================================================
// HANDLER PRINCIPAL
// ====================================================================================================

serve(async (req: Request) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return jsonResponse({ success: true })
  }

  // Seules les requêtes POST sont acceptées
  if (req.method !== 'POST') {
    return jsonResponse(
      { success: false, error: 'Méthode non autorisée. Utilisez POST.' },
      405
    )
  }

  try {
    console.log('📧 Email Sender: Début de traitement de la requête')

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(
        { success: false, error: 'Token d\'authentification requis' },
        401
      )
    }

    // Parser la requête
    const emailRequest: EmailRequest = await req.json()

    // Validation basique
    if (!emailRequest.to || emailRequest.to.length === 0) {
      return jsonResponse(
        { success: false, error: 'Au moins un destinataire est requis' },
        400
      )
    }

    if (!emailRequest.subject || !emailRequest.body) {
      return jsonResponse(
        { success: false, error: 'Le sujet et le corps de l\'email sont requis' },
        400
      )
    }

    // Envoyer l'email via Microsoft Graph
    const messageId = await sendEmailViaGraph(emailRequest)

    // Créer les entrées de tracking
    await createTrackingEntry(emailRequest, messageId)

    return jsonResponse({
      success: true,
      data: {
        messageId,
        recipientCount: emailRequest.to.length,
        sentAt: new Date().toISOString()
      },
      message: 'Email envoyé avec succès et tracking activé'
    })

  } catch (error) {
    console.error('❌ Erreur Email Sender:', error)

    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne du serveur'
    }, 500)
  }
})

console.log('🚀 Email Sender ready - Phase 2 interface reconstruction')