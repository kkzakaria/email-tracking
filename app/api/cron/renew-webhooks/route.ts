import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/microsoft/webhook-service'

/**
 * POST /api/cron/renew-webhooks
 * Cron job pour renouveler automatiquement les webhooks qui expirent bientôt
 * 
 * Configuré via vercel.json pour s'exécuter toutes les 6 heures
 * Ou appelable manuellement via POST
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Début du renouvellement automatique des webhooks...')

    // Vérifier si c'est un appel de cron légitime
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'webhook-renewal-2024'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('❌ Tentative d\'accès non autorisée au cron webhook')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Obtenir les subscriptions qui expirent bientôt (dans les prochaines 6 heures)
    const hoursBeforeExpiry = parseInt(process.env.WEBHOOK_RENEW_BEFORE_HOURS || '6')
    const result = await webhookService.renewExpiringSubscriptions(hoursBeforeExpiry)

    console.log(`✅ Renouvellement terminé: ${result.renewed} renouvelées, ${result.errors} erreurs`)

    return NextResponse.json({
      success: true,
      renewed: result.renewed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    }, { status: 200 })

  } catch (error) {
    console.error('❌ Erreur lors du renouvellement des webhooks:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/renew-webhooks
 * Check status of webhook renewal cron job
 */
export async function GET() {
  const nextRenewal = new Date()
  nextRenewal.setHours(nextRenewal.getHours() + 6)

  return NextResponse.json({
    status: 'active',
    message: 'Webhook renewal cron job is configured',
    nextScheduled: nextRenewal.toISOString(),
    renewalThreshold: `${process.env.WEBHOOK_RENEW_BEFORE_HOURS || '6'} hours`,
    endpoint: '/api/cron/renew-webhooks'
  })
}