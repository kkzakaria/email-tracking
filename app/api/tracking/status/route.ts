import { NextRequest, NextResponse } from 'next/server'
import { adaptiveTracking } from '@/lib/services/adaptive-tracking'

/**
 * GET /api/tracking/status
 * Obtenir le statut du système de tracking
 */
export async function GET(request: NextRequest) {
  try {
    const status = adaptiveTracking.getStatus()
    
    return NextResponse.json({
      ...status,
      timestamp: new Date().toISOString(),
      recommendations: getRecommendations(status)
    })
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du statut:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tracking/status
 * Forcer une vérification de santé
 */
export async function POST(request: NextRequest) {
  try {
    const isHealthy = await adaptiveTracking.forceHealthCheck()
    const status = adaptiveTracking.getStatus()
    
    return NextResponse.json({
      message: 'Vérification forcée terminée',
      healthy: isHealthy,
      status,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification forcée:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}

function getRecommendations(status: any) {
  const recommendations = []
  
  if (!status.webhookHealthy && status.webhookEnabled) {
    recommendations.push({
      type: 'warning',
      message: 'Webhooks indisponibles - mode synchronisation actif',
      action: 'Vérifier WEBHOOK_ENDPOINT_URL et la connectivité'
    })
  }
  
  if (!status.webhookEnabled) {
    recommendations.push({
      type: 'info',
      message: 'Webhooks désactivés - utilisation de la synchronisation uniquement',
      action: 'Activer WEBHOOK_ENABLED=true pour le temps réel'
    })
  }
  
  if (status.mode === 'webhook' && status.syncInterval > 60) {
    recommendations.push({
      type: 'success',
      message: 'Mode webhook optimal - sync de backup quotidienne',
      action: 'Système configuré pour les meilleures performances'
    })
  }
  
  if (status.mode === 'sync' && status.syncInterval > 15) {
    recommendations.push({
      type: 'warning',
      message: 'Intervalle de synchronisation élevé',
      action: 'Réduire SYNC_INTERVAL_MINUTES pour une détection plus rapide'
    })
  }
  
  return recommendations
}