import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createGraphClient } from '@/lib/microsoft/graph-helper'
import { detectRepliesByConversation } from '@/lib/services/reply-detection'

/**
 * GET /api/debug/email-issues
 * Diagnostique les problèmes liés au tracking des emails
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const report: any = {
      timestamp: new Date().toISOString(),
      user_id: user.id,
      issues: [],
      recommendations: [],
      data: {}
    }

    // 1. Vérifier la configuration
    report.data.config = {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      webhook_enabled: process.env.WEBHOOK_ENABLED === 'true',
      webhook_endpoint: !!process.env.WEBHOOK_ENDPOINT_URL,
      webhook_client_state: !!process.env.WEBHOOK_CLIENT_STATE
    }

    // 2. Vérifier Microsoft Graph
    try {
      const graphClient = await createGraphClient()
      report.data.microsoft = {
        client_available: !!graphClient,
        token_valid: false
      }

      if (graphClient) {
        const profile = await graphClient.api('/me').get()
        report.data.microsoft.token_valid = !!profile
        report.data.microsoft.user_email = profile.mail || profile.userPrincipalName
      }
    } catch (error) {
      report.issues.push('Microsoft Graph non disponible: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }

    // 3. Analyser les emails trackés
    const { data: emails } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    report.data.emails = {
      total: emails?.length || 0,
      with_conversation_id: emails?.filter(e => e.conversation_id).length || 0,
      with_internet_message_id: emails?.filter(e => e.internet_message_id).length || 0,
      pending: emails?.filter(e => e.status === 'PENDING').length || 0,
      replied: emails?.filter(e => e.status === 'REPLIED').length || 0
    }

    // 4. Identifier les problèmes
    if (report.data.emails.total > 0) {
      const missingConversationId = report.data.emails.total - report.data.emails.with_conversation_id
      const missingInternetId = report.data.emails.total - report.data.emails.with_internet_message_id

      if (missingConversationId > 0) {
        report.issues.push(`${missingConversationId} emails sans conversation_id`)
        report.recommendations.push('Exécuter la synchronisation Outlook pour récupérer les métadonnées manquantes')
      }

      if (missingInternetId > 0) {
        report.issues.push(`${missingInternetId} emails sans internet_message_id`)
      }
    }

    // 5. Tester la détection de réponses sur un échantillon
    const emailsWithConversationId = emails?.filter(e => e.conversation_id && e.status === 'PENDING').slice(0, 3)
    
    if (emailsWithConversationId && emailsWithConversationId.length > 0) {
      report.data.reply_detection_test = []

      for (const email of emailsWithConversationId) {
        try {
          const detectionResults = await detectRepliesByConversation(email.conversation_id!)
          report.data.reply_detection_test.push({
            email_id: email.id,
            subject: email.subject,
            conversation_id: email.conversation_id,
            detection_results: detectionResults.length,
            replies_found: detectionResults.filter(r => r.wasReply).length
          })
        } catch (error) {
          report.issues.push(`Erreur détection réponse pour ${email.subject}: ${error}`)
        }
      }
    }

    // 6. Vérifier les webhooks récents
    try {
      const { data: recentWebhooks } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      report.data.recent_webhooks = recentWebhooks?.length || 0
    } catch (error) {
      report.issues.push('Impossible de vérifier les webhooks récents')
    }

    // 7. Recommandations basées sur l'analyse
    if (!report.data.config.webhook_enabled) {
      report.recommendations.push('Activer les webhooks (WEBHOOK_ENABLED=true)')
    }

    if (!report.data.microsoft.client_available) {
      report.recommendations.push('Connecter votre compte Microsoft')
    }

    if (report.data.emails.pending > 0 && report.data.emails.with_conversation_id === 0) {
      report.recommendations.push('Synchroniser avec Outlook pour récupérer les conversation_id')
    }

    // 8. Actions suggérées
    report.suggested_actions = [
      'POST /api/emails/sync-outlook?action=full - Synchronisation complète',
      'POST /api/emails/sync-outlook?action=metadata - Mise à jour métadonnées',
      'GET /api/tracking/status - Vérifier statut système',
      'POST /api/tracking/status - Activer les webhooks automatiquement'
    ]

    return NextResponse.json(report)

  } catch (error) {
    console.error('❌ Erreur API debug-email-issues:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors du diagnostic',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}