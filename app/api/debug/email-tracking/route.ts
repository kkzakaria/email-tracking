import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * GET /api/debug/email-tracking
 * Debug endpoint pour diagnostiquer les problèmes de détection des réponses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // 1. Structure de la table email_tracking
    const { data: columns } = await supabase
      .rpc('get_table_structure', { table_name: 'email_tracking' })
      .select('*')

    // 2. Derniers emails trackés
    const { data: recentEmails } = await supabase
      .from('email_tracking')
      .select('id, recipient_email, subject, status, conversation_id, internet_message_id, sent_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // 3. Vérifier les souscriptions webhook
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: webhookSubs } = await serviceSupabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    // 4. Derniers événements webhook
    const { data: recentWebhookEvents } = await serviceSupabase
      .from('webhook_events')
      .select('id, event_type, change_type, resource_data, processed, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // 5. Logs de traitement
    const { data: processingLogs } = await serviceSupabase
      .from('webhook_processing_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    // 6. Analyser le problème
    const analysis = analyzeIssues(recentEmails, webhookSubs, recentWebhookEvents, processingLogs)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      tableStructure: columns || 'Impossible de vérifier la structure',
      recentEmails: recentEmails || [],
      webhookSubscriptions: webhookSubs || [],
      recentWebhookEvents: recentWebhookEvents || [],
      processingLogs: processingLogs || [],
      analysis,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erreur dans le debug:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur interne',
        details: 'Vérifiez les logs Vercel pour plus de détails'
      },
      { status: 500 }
    )
  }
}

function analyzeIssues(emails: any[], subscriptions: any[], events: any[], logs: any[]) {
  const issues = []
  const recommendations = []

  // Analyse 1: Emails sans conversation_id
  const emailsWithoutConversationId = emails?.filter(e => !e.conversation_id) || []
  if (emailsWithoutConversationId.length > 0) {
    issues.push({
      type: 'critical',
      message: `${emailsWithoutConversationId.length} emails sans conversation_id`,
      details: 'Les webhooks ne peuvent pas faire le matching'
    })
    recommendations.push('Appliquer la migration 006 et modifier l\'envoi d\'emails')
  }

  // Analyse 2: Pas de souscriptions webhook
  if (!subscriptions?.length) {
    issues.push({
      type: 'critical',
      message: 'Aucune subscription webhook active',
      details: 'Le système ne peut pas recevoir de notifications temps réel'
    })
    recommendations.push('Créer une subscription webhook depuis l\'interface')
  }

  // Analyse 3: Pas d'événements webhook récents
  if (!events?.length) {
    issues.push({
      type: 'warning',
      message: 'Aucun événement webhook reçu récemment',
      details: 'Microsoft Graph n\'envoie pas de notifications'
    })
    recommendations.push('Vérifier la connectivité et l\'endpoint webhook')
  }

  // Analyse 4: Emails PENDING anciens
  const oldPendingEmails = emails?.filter(e => {
    const sentDate = new Date(e.sent_at || e.created_at)
    const now = new Date()
    const daysDiff = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
    return e.status === 'PENDING' && daysDiff > 1
  }) || []

  if (oldPendingEmails.length > 0) {
    issues.push({
      type: 'info',
      message: `${oldPendingEmails.length} emails en attente depuis plus d'1 jour`,
      details: 'Possibles réponses non détectées'
    })
    recommendations.push('Lancer une synchronisation manuelle')
  }

  return {
    issues,
    recommendations,
    summary: {
      totalEmails: emails?.length || 0,
      pendingEmails: emails?.filter(e => e.status === 'PENDING').length || 0,
      activeSubscriptions: subscriptions?.length || 0,
      recentEvents: events?.length || 0
    }
  }
}