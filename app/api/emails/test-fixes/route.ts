import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncOutlookSentEmails, syncAndDetectReplies } from '@/lib/services/outlook-sync-service'
import { syncMissedReplies } from '@/lib/services/webhook-reply-handler'

/**
 * POST /api/emails/test-fixes
 * Endpoint pour tester les corrections des problèmes de tracking
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'all'

    const results = {
      timestamp: new Date().toISOString(),
      user_id: user.id,
      actions: [] as Array<{
        name: string
        success?: boolean
        new_emails?: number
        updated_emails?: number
        errors?: string[]
        processed?: number
        updated?: number
        data?: Record<string, unknown>
      }>
    }

    console.log(`🧪 Test des corrections - Action: ${action}`)

    // Test 1: Synchroniser les emails Outlook récents
    if (action === 'all' || action === 'outlook') {
      console.log('📧 Test 1: Synchronisation Outlook...')
      const outlookResult = await syncOutlookSentEmails(48) // 48h pour plus de coverage
      results.actions.push({
        name: 'outlook_sync',
        success: outlookResult.success,
        new_emails: outlookResult.newEmailsTracked,
        updated_emails: outlookResult.updatedEmails,
        errors: outlookResult.errors
      })
    }

    // Test 2: Synchronisation complète avec détection
    if (action === 'all' || action === 'complete') {
      console.log('🔄 Test 2: Synchronisation complète...')
      const completeResult = await syncAndDetectReplies()
      results.actions.push({
        name: 'complete_sync',
        success: completeResult.success,
        new_emails: completeResult.newEmailsTracked,
        updated_emails: completeResult.updatedEmails,
        errors: completeResult.errors
      })
    }

    // Test 3: Synchroniser les réponses manquées
    if (action === 'all' || action === 'replies') {
      console.log('💬 Test 3: Synchronisation des réponses...')
      const repliesResult = await syncMissedReplies(72) // 72h pour plus de coverage
      results.actions.push({
        name: 'missed_replies',
        processed: repliesResult.processed,
        updated: repliesResult.updated,
        errors: repliesResult.errors
      })
    }

    // Test 4: Vérifier l'état après corrections
    if (action === 'all' || action === 'verify') {
      console.log('🔍 Test 4: Vérification de l\'état...')
      
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('id, status, conversation_id, internet_message_id, reply_detection_method, subject, recipient_email, sent_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      const verification = {
        total_emails: emailStats?.length || 0,
        with_conversation_id: emailStats?.filter(e => e.conversation_id).length || 0,
        with_internet_message_id: emailStats?.filter(e => e.internet_message_id).length || 0,
        replied_emails: emailStats?.filter(e => e.status === 'REPLIED').length || 0,
        pending_emails: emailStats?.filter(e => e.status === 'PENDING').length || 0,
        by_detection_method: emailStats?.reduce((acc, email) => {
          const method = email.reply_detection_method || 'unknown'
          acc[method] = (acc[method] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {},
        sample_emails: emailStats?.slice(0, 5).map(email => ({
          id: email.id,
          subject: email.subject,
          recipient: email.recipient_email,
          status: email.status,
          has_conversation_id: !!email.conversation_id,
          has_internet_message_id: !!email.internet_message_id,
          detection_method: email.reply_detection_method,
          sent_at: email.sent_at
        })) || []
      }

      results.actions.push({
        name: 'verification',
        data: verification
      })
    }

    console.log('✅ Tests terminés:', results)

    return NextResponse.json({
      message: 'Tests des corrections terminés',
      ...results,
      recommendations: generateRecommendations(results)
    })

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
    
    return NextResponse.json({
      error: 'Erreur lors des tests',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * GET /api/emails/test-fixes
 * Informations sur les tests disponibles
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: 'API de test des corrections de tracking',
    actions: {
      all: 'POST /api/emails/test-fixes?action=all - Tous les tests',
      outlook: 'POST /api/emails/test-fixes?action=outlook - Sync Outlook seulement',
      complete: 'POST /api/emails/test-fixes?action=complete - Sync complète',
      replies: 'POST /api/emails/test-fixes?action=replies - Réponses manquées',
      verify: 'POST /api/emails/test-fixes?action=verify - Vérification état'
    },
    description: 'Teste les trois corrections principales: conversation_id, tracking Outlook, détection réponses'
  })
}

function generateRecommendations(results: { actions: Array<{ name: string; data?: any }> }): string[] {
  const recommendations = []

  // Analyser les résultats pour donner des recommandations
  const verification = results.actions.find((a) => a.name === 'verification')
  if (verification) {
    const data = verification.data

    if (data.total_emails === 0) {
      recommendations.push('Aucun email trouvé - envoyez quelques emails de test')
    }

    if (data.with_conversation_id < data.total_emails * 0.8) {
      recommendations.push('Beaucoup d\'emails sans conversation_id - relancez la synchronisation Outlook')
    }

    if (data.pending_emails > data.replied_emails && data.total_emails > 5) {
      recommendations.push('Beaucoup d\'emails en attente - vérifiez la détection de réponses')
    }

    if (!data.by_detection_method['sent_items_lookup'] && !data.by_detection_method['outlook_sync']) {
      recommendations.push('Aucune métadonnée via Outlook - vérifiez la connexion Microsoft Graph')
    }
  }

  const outlookSync = results.actions.find((a) => a.name === 'outlook_sync')
  if (outlookSync && outlookSync.errors?.length > 0) {
    recommendations.push('Erreurs lors de la sync Outlook - vérifiez les permissions Microsoft Graph')
  }

  if (recommendations.length === 0) {
    recommendations.push('Système fonctionnel - continuez à tester avec de vrais emails')
  }

  return recommendations
}