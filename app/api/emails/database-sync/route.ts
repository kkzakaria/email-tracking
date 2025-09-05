import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { 
  syncReceivedMessagesFromGraph, 
  getUserDetectionStats, 
  diagnoseUserTracking, 
  fullUserSync 
} from '@/lib/services/database-reply-detection'

/**
 * POST /api/emails/database-sync
 * Synchronise les messages reçus et détecte les réponses via la base de données
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'sync'
    const hours = parseInt(searchParams.get('hours') || '24')

    console.log(`🔄 Database sync - Action: ${action} pour utilisateur ${user.id}`)

    let result: any = {}

    switch (action) {
      case 'sync':
        // Synchronisation des messages seulement
        console.log(`📨 Sync messages reçus (${hours}h)`)
        result = await syncReceivedMessagesFromGraph(user.id, hours)
        break

      case 'stats':
        // Statistiques seulement
        console.log('📊 Récupération statistiques')
        result.stats = await getUserDetectionStats(user.id)
        result.diagnosis = await diagnoseUserTracking(user.id)
        break

      case 'full':
        // Synchronisation complète
        console.log('🔄 Synchronisation complète (messages + stats)')
        result = await fullUserSync(user.id)
        break

      default:
        return NextResponse.json(
          { error: 'Action non supportée. Utilisez: sync, stats, ou full' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      message: `Database sync ${action} terminée`,
      user_id: user.id,
      timestamp: new Date().toISOString(),
      ...result
    })

  } catch (error) {
    console.error('❌ Erreur API database-sync:', error)
    
    return NextResponse.json({
      error: 'Erreur lors de la synchronisation database',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * GET /api/emails/database-sync
 * Informations sur la synchronisation base de données
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer les statistiques actuelles
    const stats = await getUserDetectionStats(user.id)
    const diagnosis = await diagnoseUserTracking(user.id)

    return NextResponse.json({
      message: 'Database Reply Detection System',
      user_id: user.id,
      current_stats: stats,
      diagnosis: diagnosis,
      actions: {
        sync_messages: 'POST /api/emails/database-sync?action=sync&hours=24',
        get_stats: 'POST /api/emails/database-sync?action=stats',
        full_sync: 'POST /api/emails/database-sync?action=full'
      },
      description: {
        approach: 'Détection automatique via triggers PostgreSQL',
        workflow: [
          '1. Messages reçus synchronisés depuis Microsoft Graph',
          '2. Insertion dans table received_messages',
          '3. Trigger detect_email_replies() se déclenche automatiquement', 
          '4. Mise à jour automatique du statut REPLIED dans email_tracking',
          '5. Aucune logique métier côté application'
        ],
        advantages: [
          'Performance optimale (triggers DB natifs)',
          'Cohérence transactionnelle garantie',
          'Pas de logique complexe côté application',
          'Détection en temps réel lors de l\'insertion',
          'Scalabilité native PostgreSQL'
        ]
      }
    })

  } catch (error) {
    console.error('❌ Erreur API database-sync GET:', error)
    
    return NextResponse.json({
      error: 'Erreur lors de la récupération des informations'
    }, { status: 500 })
  }
}