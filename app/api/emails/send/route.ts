import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sendTrackedEmail, TrackedEmailOptions } from '@/lib/microsoft/email-service'
import { isMicrosoftConnected } from '@/lib/microsoft/graph-helper'
import { getEnhancedEmailService } from '@/lib/graph/enhanced-email-service'

interface SendEmailRequest {
  to: string
  subject: string
  htmlBody?: string
  textBody?: string
  expiresAt?: string
}

// POST /api/emails/send - Envoyer un email tracké
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification utilisateur
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour envoyer des emails' },
        { status: 401 }
      )
    }
    
    // Vérifier la connexion Microsoft
    const microsoftConnected = await isMicrosoftConnected()
    if (!microsoftConnected) {
      return NextResponse.json(
        { error: 'Vous devez connecter votre compte Microsoft pour envoyer des emails' },
        { status: 400 }
      )
    }
    
    // Parser et valider les données de la requête
    let requestData: SendEmailRequest
    try {
      requestData = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Format de données invalide' },
        { status: 400 }
      )
    }
    
    const { to, subject, htmlBody, textBody, expiresAt } = requestData
    
    // Validation des champs requis
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Les champs "to" et "subject" sont requis' },
        { status: 400 }
      )
    }
    
    if (!htmlBody && !textBody) {
      return NextResponse.json(
        { error: 'Le contenu HTML ou texte est requis' },
        { status: 400 }
      )
    }
    
    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Adresse email destinataire invalide' },
        { status: 400 }
      )
    }
    
    // Validation de la date d'expiration (optionnelle)
    let parsedExpiresAt: string | undefined
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      if (isNaN(expiryDate.getTime())) {
        return NextResponse.json(
          { error: 'Date d\'expiration invalide' },
          { status: 400 }
        )
      }
      
      if (expiryDate <= new Date()) {
        return NextResponse.json(
          { error: 'La date d\'expiration doit être dans le futur' },
          { status: 400 }
        )
      }
      
      parsedExpiresAt = expiryDate.toISOString()
    }
    
    // Préparer les options d'email
    const emailOptions: TrackedEmailOptions = {
      to: to.trim(),
      subject: subject.trim(),
      htmlBody,
      textBody,
      expiresAt: parsedExpiresAt
    }
    
    console.log('📧 Tentative d\'envoi d\'email tracké:', {
      to: emailOptions.to,
      subject: emailOptions.subject,
      hasHtml: !!htmlBody,
      hasText: !!textBody,
      userId: user.id
    })
    
    // 🔔 HOOK: Assurer qu'une subscription webhook existe avant l'envoi
    // Ceci active automatiquement le tracking en temps réel sans intervention utilisateur
    try {
      const { AutoWebhookService } = await import('@/lib/services/auto-webhook-service')
      const autoService = new AutoWebhookService()
      
      console.log('🔔 Vérification de la subscription webhook automatique...')
      const webhookResult = await autoService.ensureWebhookSubscription(user.id)
      
      if (webhookResult.success) {
        console.log(`✅ Webhook auto: ${webhookResult.action} - Subscription ${webhookResult.subscriptionId}`)
      } else {
        console.log(`⚠️ Webhook auto: ${webhookResult.action} - ${webhookResult.error || webhookResult.reason}`)
      }
    } catch (webhookError) {
      console.log('ℹ️ Auto-webhook non disponible, continuons avec l\'envoi:', webhookError)
      // L'échec de création de webhook ne doit pas empêcher l'envoi d'email
      // Le système fonctionnera en mode synchronisation manuelle
    }
    
    // Envoyer l'email tracké
    const result = await sendTrackedEmail(emailOptions)
    
    if (!result.success) {
      console.error('❌ Échec de l\'envoi d\'email:', result.error)
      return NextResponse.json(
        { error: result.error || 'Échec de l\'envoi d\'email' },
        { status: 500 }
      )
    }
    
    console.log('✅ Email tracké envoyé avec succès:', {
      trackingId: result.trackingId,
      messageId: result.messageId
    })
    
    // Réponse de succès
    return NextResponse.json({
      success: true,
      message: 'Email envoyé avec succès',
      trackingId: result.trackingId,
      messageId: result.messageId,
      tracking: {
        pixelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/emails/pixel/${result.trackingId}`,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('❌ Erreur serveur lors de l\'envoi d\'email:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur serveur interne',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}

// GET /api/emails/send - Obtenir les informations sur l'endpoint (utile pour debug)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const microsoftConnected = await isMicrosoftConnected()
    
    return NextResponse.json({
      endpoint: '/api/emails/send',
      method: 'POST',
      status: 'active',
      user: {
        id: user.id,
        email: user.email,
        microsoftConnected
      },
      config: {
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      },
      requiredFields: ['to', 'subject', 'htmlBody or textBody'],
      optionalFields: ['expiresAt']
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}