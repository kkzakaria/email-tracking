import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncAllPendingReplies } from '@/lib/services/reply-detection'

/**
 * POST /api/emails/sync-replies
 * Synchronisation manuelle améliorée pour détecter les réponses manquées
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    console.log('🔄 Synchronisation manuelle des réponses demandée par:', user.email)

    // Lire les paramètres optionnels
    const body = await request.json().catch(() => ({}))
    const maxAge = body.maxAge || 30 // Jours

    // Lancer la synchronisation améliorée
    const startTime = Date.now()
    const result = await syncAllPendingReplies(maxAge)
    const duration = Date.now() - startTime

    console.log(`✅ Synchronisation terminée en ${duration}ms:`, result)

    return NextResponse.json({
      success: true,
      summary: {
        processed: result.processed,
        updated: result.updated,
        errors: result.errors,
        durationMs: duration
      },
      message: `${result.updated} emails mis à jour sur ${result.processed} vérifiés`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des réponses:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/emails/sync-replies
 * Statut du service de synchronisation des réponses
 */
export async function GET() {
  return NextResponse.json({
    service: 'Reply Detection Sync',
    status: 'active',
    features: [
      'Détection par conversation_id (haute précision)',
      'Fallback par subject matching (précision moyenne)',
      'Synchronisation complète des emails PENDING',
      'Logging détaillé des actions'
    ],
    endpoints: {
      sync: 'POST /api/emails/sync-replies',
      status: 'GET /api/emails/sync-replies'
    },
    defaultMaxAge: '30 jours'
  })
}