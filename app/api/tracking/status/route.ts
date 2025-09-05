import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

interface SystemStatus {
  webhooks: {
    enabled: boolean
    configured: boolean
    activeSubscriptions: number
    subscriptionsExpiringSoon: number
    lastEventReceived: string | null
    endpointUrl: string
  }
  database: {
    connected: boolean
    migrationStatus: 'up_to_date' | 'needs_update' | 'unknown'
  }
  microsoft: {
    available: boolean
    lastConnection: string | null
  }
  overall: 'healthy' | 'warning' | 'error'
}

/**
 * GET /api/tracking/status
 * Obtenir le statut global du système de tracking et webhooks
 */
export async function GET(request: NextRequest) {
  try {
    // Initialiser le statut par défaut
    const status: SystemStatus = {
      webhooks: {
        enabled: false,
        configured: false,
        activeSubscriptions: 0,
        subscriptionsExpiringSoon: 0,
        lastEventReceived: null,
        endpointUrl: ''
      },
      database: {
        connected: false,
        migrationStatus: 'unknown'
      },
      microsoft: {
        available: false,
        lastConnection: null
      },
      overall: 'error'
    }

    // 1. Vérifier la configuration des webhooks
    const webhookEnabled = process.env.WEBHOOK_ENABLED === 'true'
    const webhookEndpointUrl = process.env.WEBHOOK_ENDPOINT_URL || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`
    const webhookClientState = process.env.WEBHOOK_CLIENT_STATE
    
    status.webhooks.enabled = webhookEnabled
    status.webhooks.configured = !!(webhookEnabled && webhookEndpointUrl && webhookClientState)
    status.webhooks.endpointUrl = webhookEndpointUrl

    // 2. Vérifier la connexion à la base de données et récupérer les statistiques
    try {
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      status.database.connected = true

      // Vérifier si les tables webhook existent (indicateur de migration)
      const { data: tables, error: tablesError } = await serviceSupabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['webhook_subscriptions', 'webhook_events', 'email_tracking'])

      if (!tablesError && tables) {
        const tableNames = tables.map(t => t.table_name)
        const hasWebhookTables = tableNames.includes('webhook_subscriptions') && 
                               tableNames.includes('webhook_events')
        const hasConversationId = await checkConversationIdColumn(serviceSupabase)
        
        status.database.migrationStatus = hasWebhookTables && hasConversationId 
          ? 'up_to_date' 
          : 'needs_update'
      }

      // Récupérer les statistiques des subscriptions
      if (status.database.migrationStatus === 'up_to_date') {
        const { data: subscriptions } = await serviceSupabase
          .from('webhook_subscriptions')
          .select('status, expiration_datetime')
          .eq('status', 'active')

        if (subscriptions) {
          status.webhooks.activeSubscriptions = subscriptions.length

          // Compter les subscriptions qui expirent dans les 6 heures
          const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000)
          status.webhooks.subscriptionsExpiringSoon = subscriptions.filter(
            sub => new Date(sub.expiration_datetime) < sixHoursFromNow
          ).length
        }

        // Récupérer le dernier événement webhook
        const { data: lastEvent } = await serviceSupabase
          .from('webhook_events')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (lastEvent) {
          status.webhooks.lastEventReceived = lastEvent.created_at
        }
      }

    } catch (dbError) {
      console.error('❌ Erreur de connexion à la base de données:', dbError)
      status.database.connected = false
    }

    // 3. Vérifier la disponibilité de Microsoft Graph
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Vérifier s'il y a des tokens Microsoft valides
        const { createGraphClient } = await import('@/lib/microsoft/graph-helper')
        const graphClient = await createGraphClient()
        
        if (graphClient) {
          status.microsoft.available = true
          status.microsoft.lastConnection = new Date().toISOString()
        }
      }
    } catch (msError) {
      console.log('ℹ️ Microsoft Graph non disponible (normal si pas connecté):', msError)
      status.microsoft.available = false
    }

    // 4. Déterminer le statut global
    if (status.database.connected && status.webhooks.configured && status.database.migrationStatus === 'up_to_date') {
      if (status.webhooks.activeSubscriptions > 0 || status.microsoft.available) {
        status.overall = status.webhooks.subscriptionsExpiringSoon > 0 ? 'warning' : 'healthy'
      } else {
        status.overall = 'warning' // Configuré mais pas de subscriptions actives
      }
    } else {
      status.overall = 'error' // Configuration incomplète ou DB problème
    }

    return NextResponse.json({
      status: status.overall,
      timestamp: new Date().toISOString(),
      system: status,
      recommendations: generateRecommendations(status)
    })

  } catch (error) {
    console.error('❌ Erreur lors de la vérification du statut:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      system: null
    }, { status: 500 })
  }
}

/**
 * Vérifier si la colonne conversation_id existe dans email_tracking
 */
async function checkConversationIdColumn(supabase: ReturnType<typeof createServiceClient>): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'email_tracking')
      .eq('column_name', 'conversation_id')

    return !error && data && data.length > 0
  } catch {
    return false
  }
}

/**
 * Générer des recommandations basées sur le statut du système
 */
function generateRecommendations(status: SystemStatus): string[] {
  const recommendations: string[] = []

  if (!status.webhooks.enabled) {
    recommendations.push('Définir WEBHOOK_ENABLED=true dans les variables d\'environnement')
  }

  if (!status.webhooks.configured) {
    recommendations.push('Configurer WEBHOOK_ENDPOINT_URL et WEBHOOK_CLIENT_STATE')
  }

  if (status.database.migrationStatus === 'needs_update') {
    recommendations.push('Appliquer la migration 006 pour le support de conversation_id')
  }

  if (!status.database.connected) {
    recommendations.push('Vérifier la connexion à Supabase et les clés d\'API')
  }

  if (status.webhooks.activeSubscriptions === 0 && status.webhooks.configured) {
    recommendations.push('Créer une subscription webhook pour commencer le tracking automatique')
  }

  if (status.webhooks.subscriptionsExpiringSoon > 0) {
    recommendations.push(`${status.webhooks.subscriptionsExpiringSoon} subscription(s) à renouveler bientôt`)
  }

  if (!status.microsoft.available) {
    recommendations.push('Connecter un compte Microsoft pour utiliser les webhooks')
  }

  if (recommendations.length === 0) {
    recommendations.push('Système opérationnel - aucune action requise')
  }

  return recommendations
}

/**
 * POST /api/tracking/status
 * Forcer une mise à jour/validation du statut système
 */
export async function POST(request: NextRequest) {
  try {
    // Récupérer le statut actuel
    const getResponse = await GET(request)
    const statusData = await getResponse.json()

    // Si le système n'est pas optimal, essayer d'améliorer automatiquement
    if (statusData.status !== 'healthy') {
      const improvements: string[] = []

      // Essayer de créer une subscription automatiquement si possible
      try {
        const { AutoWebhookService } = await import('@/lib/services/auto-webhook-service')
        const autoService = new AutoWebhookService()
        
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user && statusData.system?.webhooks?.configured) {
          const result = await autoService.ensureWebhookSubscription(user.id)
          if (result.success) {
            improvements.push('Subscription webhook créée automatiquement')
          }
        }
      } catch (error) {
        console.log('ℹ️ Auto-amélioration non disponible:', error)
      }

      return NextResponse.json({
        message: 'Tentative d\'amélioration du statut système',
        improvements,
        newStatus: statusData
      })
    }

    return NextResponse.json({
      message: 'Système déjà optimal',
      status: statusData
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Erreur lors de la mise à jour du statut',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}