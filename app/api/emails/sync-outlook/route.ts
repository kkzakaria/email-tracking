import { NextRequest, NextResponse } from 'next/server'
import { syncOutlookSentEmails, updateMissingMetadata, syncAndDetectReplies } from '@/lib/services/outlook-sync-service'
import { createClient } from '@/utils/supabase/server'

/**
 * POST /api/emails/sync-outlook
 * Synchronise les emails envoyés depuis Outlook avec notre tracking
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'sync'
    const hours = parseInt(searchParams.get('hours') || '24')

    let result

    switch (action) {
      case 'sync':
        console.log(`🔄 Synchronisation des ${hours} dernières heures...`)
        result = await syncOutlookSentEmails(hours)
        break

      case 'metadata':
        console.log('🔄 Mise à jour des métadonnées manquantes...')
        result = await updateMissingMetadata()
        break

      case 'full':
        console.log('🔄 Synchronisation complète avec détection de réponses...')
        result = await syncAndDetectReplies()
        break

      default:
        return NextResponse.json(
          { error: 'Action non supportée. Utilisez: sync, metadata, ou full' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      message: 'Synchronisation terminée',
      ...result
    })

  } catch (error) {
    console.error('❌ Erreur API sync-outlook:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la synchronisation',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/emails/sync-outlook
 * Informations sur la synchronisation Outlook
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Statistiques sur les emails trackés
    const { data: emailStats } = await supabase
      .from('email_tracking')
      .select('status, conversation_id, internet_message_id, reply_detection_method')
      .eq('user_id', user.id)

    const stats = {
      total: emailStats?.length || 0,
      withConversationId: emailStats?.filter(e => e.conversation_id).length || 0,
      withInternetMessageId: emailStats?.filter(e => e.internet_message_id).length || 0,
      byDetectionMethod: emailStats?.reduce((acc, email) => {
        const method = email.reply_detection_method || 'unknown'
        acc[method] = (acc[method] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      byStatus: emailStats?.reduce((acc, email) => {
        acc[email.status] = (acc[email.status] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}
    }

    return NextResponse.json({
      message: 'Statistiques de synchronisation Outlook',
      stats,
      actions: {
        sync: 'POST /api/emails/sync-outlook?action=sync&hours=24',
        metadata: 'POST /api/emails/sync-outlook?action=metadata',
        full: 'POST /api/emails/sync-outlook?action=full'
      }
    })

  } catch (error) {
    console.error('❌ Erreur API sync-outlook GET:', error)
    
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats' },
      { status: 500 }
    )
  }
}