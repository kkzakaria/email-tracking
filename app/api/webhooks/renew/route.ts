import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/microsoft/webhook-service'
import { headers } from 'next/headers'

/**
 * POST /api/webhooks/renew
 * Renouveler une subscription webhook spécifique ou toutes les subscriptions expirantes
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier le header d'autorisation pour les appels système
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    
    // On peut implémenter une clé API simple pour les cron jobs
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret'
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Tentative de renouvellement non autorisée')
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { subscriptionId } = body

    if (subscriptionId) {
      // Renouveler une subscription spécifique
      console.log('🔄 Renouvellement de la subscription:', subscriptionId)
      
      const result = await webhookService.renewSubscription(subscriptionId)
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Échec du renouvellement' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        message: 'Subscription renouvelée avec succès',
        newExpirationDateTime: result.newExpirationDateTime
      })
      
    } else {
      // Renouveler toutes les subscriptions expirantes
      console.log('🔄 Renouvellement automatique de toutes les subscriptions expirantes')
      
      const result = await webhookService.renewExpiringSubscriptions()
      
      return NextResponse.json({
        message: 'Renouvellement automatique terminé',
        renewed: result.renewed,
        failed: result.failed,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Erreur lors du renouvellement:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/renew
 * Obtenir le statut des subscriptions qui nécessitent un renouvellement
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier le header d'autorisation
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret'
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer les subscriptions qui expirent bientôt
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    
    const { data: expiringSubscriptions } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('status', 'active')
      .lt('expiration_datetime', sixHoursFromNow)
      .order('expiration_datetime', { ascending: true })

    return NextResponse.json({
      expiringCount: expiringSubscriptions?.length || 0,
      subscriptions: expiringSubscriptions || [],
      checkTime: new Date().toISOString(),
      renewalThreshold: '6 hours'
    })

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des expirations:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}