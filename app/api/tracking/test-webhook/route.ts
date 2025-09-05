import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface WebhookTestResult {
  endpoint: {
    accessible: boolean
    url: string
    statusCode?: number
    responseTime?: number
    error?: string
  }
  configuration: {
    valid: boolean
    issues: string[]
    warnings: string[]
  }
  connectivity: {
    supabase: boolean
    microsoft: boolean
    errors: string[]
  }
  subscription: {
    canCreate: boolean
    reason?: string
  }
}

/**
 * GET /api/tracking/test-webhook
 * Tester la configuration complète du système webhook
 */
export async function GET(request: NextRequest) {
  const testResult: WebhookTestResult = {
    endpoint: {
      accessible: false,
      url: ''
    },
    configuration: {
      valid: false,
      issues: [],
      warnings: []
    },
    connectivity: {
      supabase: false,
      microsoft: false,
      errors: []
    },
    subscription: {
      canCreate: false
    }
  }

  try {
    console.log('🧪 Début du test webhook complet...')

    // 1. TEST DE CONFIGURATION
    await testConfiguration(testResult)

    // 2. TEST DE CONNECTIVITÉ
    await testConnectivity(testResult)

    // 3. TEST DE L'ENDPOINT WEBHOOK
    if (testResult.configuration.valid) {
      await testWebhookEndpoint(testResult)
    }

    // 4. TEST DE CRÉATION DE SUBSCRIPTION
    if (testResult.configuration.valid && testResult.connectivity.microsoft) {
      await testSubscriptionCreation(testResult)
    }

    // Déterminer le statut global
    const isHealthy = testResult.endpoint.accessible && 
                     testResult.configuration.valid && 
                     testResult.connectivity.supabase && 
                     testResult.connectivity.microsoft &&
                     testResult.subscription.canCreate

    return NextResponse.json({
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      test: testResult,
      summary: generateSummary(testResult),
      recommendations: generateTestRecommendations(testResult)
    })

  } catch (error) {
    console.error('❌ Erreur lors du test webhook:', error)
    
    return NextResponse.json({
      healthy: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      test: testResult
    }, { status: 500 })
  }
}

/**
 * Tester la configuration des variables d'environnement
 */
async function testConfiguration(result: WebhookTestResult): Promise<void> {
  console.log('🔧 Test de configuration...')

  // Vérifier WEBHOOK_ENABLED
  if (process.env.WEBHOOK_ENABLED !== 'true') {
    result.configuration.issues.push('WEBHOOK_ENABLED n\'est pas défini à "true"')
  }

  // Vérifier WEBHOOK_ENDPOINT_URL
  const endpointUrl = process.env.WEBHOOK_ENDPOINT_URL
  if (!endpointUrl) {
    result.configuration.issues.push('WEBHOOK_ENDPOINT_URL n\'est pas défini')
  } else {
    result.endpoint.url = endpointUrl
    
    // Vérifier le format de l'URL
    try {
      new URL(endpointUrl)
      if (!endpointUrl.startsWith('https://')) {
        result.configuration.warnings.push('WEBHOOK_ENDPOINT_URL devrait utiliser HTTPS')
      }
    } catch {
      result.configuration.issues.push('WEBHOOK_ENDPOINT_URL n\'est pas une URL valide')
    }
  }

  // Vérifier WEBHOOK_CLIENT_STATE
  if (!process.env.WEBHOOK_CLIENT_STATE) {
    result.configuration.issues.push('WEBHOOK_CLIENT_STATE n\'est pas défini')
  } else if (process.env.WEBHOOK_CLIENT_STATE.length < 16) {
    result.configuration.warnings.push('WEBHOOK_CLIENT_STATE devrait être plus long pour la sécurité')
  }

  // Vérifier les variables Azure
  if (!process.env.AZURE_AD_CLIENT_ID) {
    result.configuration.issues.push('AZURE_AD_CLIENT_ID manquant')
  }
  if (!process.env.AZURE_AD_CLIENT_SECRET) {
    result.configuration.issues.push('AZURE_AD_CLIENT_SECRET manquant')
  }

  // Vérifier Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    result.configuration.issues.push('NEXT_PUBLIC_SUPABASE_URL manquant')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    result.configuration.issues.push('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant')
  }

  result.configuration.valid = result.configuration.issues.length === 0
  console.log(`🔧 Configuration: ${result.configuration.valid ? '✅' : '❌'} (${result.configuration.issues.length} problèmes)`)
}

/**
 * Tester la connectivité aux services externes
 */
async function testConnectivity(result: WebhookTestResult): Promise<void> {
  console.log('🌐 Test de connectivité...')

  // Test Supabase
  try {
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await serviceSupabase
      .from('webhook_subscriptions')
      .select('id')
      .limit(1)

    if (error && !error.message.includes('relation "webhook_subscriptions" does not exist')) {
      result.connectivity.errors.push(`Supabase: ${error.message}`)
    } else {
      result.connectivity.supabase = true
    }
  } catch (error) {
    result.connectivity.errors.push(`Supabase: ${error instanceof Error ? error.message : 'Erreur de connexion'}`)
  }

  // Test Microsoft Graph
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { createGraphClient } = await import('@/lib/microsoft/graph-helper')
      const graphClient = await createGraphClient()
      
      if (graphClient) {
        // Test simple pour vérifier la connectivité
        await graphClient.api('/me').get()
        result.connectivity.microsoft = true
      } else {
        result.connectivity.errors.push('Microsoft Graph: Client non disponible')
      }
    } else {
      result.connectivity.errors.push('Microsoft Graph: Utilisateur non connecté')
    }
  } catch (error) {
    result.connectivity.errors.push(`Microsoft Graph: ${error instanceof Error ? error.message : 'Erreur de connexion'}`)
  }

  console.log(`🌐 Connectivité: Supabase ${result.connectivity.supabase ? '✅' : '❌'}, Microsoft ${result.connectivity.microsoft ? '✅' : '❌'}`)
}

/**
 * Tester l'accessibilité de l'endpoint webhook
 */
async function testWebhookEndpoint(result: WebhookTestResult): Promise<void> {
  console.log('🔗 Test de l\'endpoint webhook...')

  if (!result.endpoint.url) {
    result.endpoint.error = 'URL d\'endpoint non configurée'
    return
  }

  try {
    const startTime = Date.now()
    
    // Test GET avec validation token simulé
    const testUrl = `${result.endpoint.url}?validationToken=test-token-${Date.now()}`
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const responseTime = Date.now() - startTime
    result.endpoint.responseTime = responseTime
    result.endpoint.statusCode = response.status

    if (response.ok) {
      const responseText = await response.text()
      
      // Vérifier si l'endpoint retourne bien le token de validation
      if (responseText.includes('test-token-')) {
        result.endpoint.accessible = true
        console.log('🔗 Endpoint: ✅ Accessible et fonctionnel')
      } else {
        result.endpoint.error = 'Endpoint ne retourne pas le token de validation correctement'
        console.log('🔗 Endpoint: ⚠️ Accessible mais comportement incorrect')
      }
    } else {
      result.endpoint.error = `HTTP ${response.status}: ${response.statusText}`
      console.log(`🔗 Endpoint: ❌ ${result.endpoint.error}`)
    }

  } catch (error) {
    result.endpoint.error = error instanceof Error ? error.message : 'Erreur de réseau'
    console.log(`🔗 Endpoint: ❌ ${result.endpoint.error}`)
  }
}

/**
 * Tester la capacité de création de subscription
 */
async function testSubscriptionCreation(result: WebhookTestResult): Promise<void> {
  console.log('📝 Test de création de subscription...')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      result.subscription.reason = 'Utilisateur non authentifié'
      return
    }

    // Vérifier si l'utilisateur peut créer des subscriptions
    const { AutoWebhookService } = await import('@/lib/services/auto-webhook-service')
    const autoService = new AutoWebhookService()
    
    const needsIntervention = await autoService.needsAutomaticIntervention(user.id)
    
    if (needsIntervention.needed || needsIntervention.reason === 'Subscription active et valide') {
      result.subscription.canCreate = true
      result.subscription.reason = needsIntervention.reason
      console.log('📝 Subscription: ✅ Peut créer/gérer des subscriptions')
    } else {
      result.subscription.canCreate = false
      result.subscription.reason = needsIntervention.reason
      console.log(`📝 Subscription: ❌ ${needsIntervention.reason}`)
    }

  } catch (error) {
    result.subscription.canCreate = false
    result.subscription.reason = error instanceof Error ? error.message : 'Erreur lors du test'
    console.log(`📝 Subscription: ❌ ${result.subscription.reason}`)
  }
}

/**
 * Générer un résumé des tests
 */
function generateSummary(result: WebhookTestResult): string {
  const passed = [
    result.configuration.valid && 'Configuration',
    result.connectivity.supabase && 'Supabase',
    result.connectivity.microsoft && 'Microsoft',
    result.endpoint.accessible && 'Endpoint',
    result.subscription.canCreate && 'Subscription'
  ].filter(Boolean)

  const total = 5
  return `${passed.length}/${total} tests réussis`
}

/**
 * Générer des recommandations basées sur les tests
 */
function generateTestRecommendations(result: WebhookTestResult): string[] {
  const recommendations: string[] = []

  // Configuration
  result.configuration.issues.forEach(issue => {
    recommendations.push(`Configuration: ${issue}`)
  })

  result.configuration.warnings.forEach(warning => {
    recommendations.push(`Avertissement: ${warning}`)
  })

  // Connectivité
  result.connectivity.errors.forEach(error => {
    recommendations.push(`Connectivité: ${error}`)
  })

  // Endpoint
  if (!result.endpoint.accessible && result.endpoint.error) {
    recommendations.push(`Endpoint: ${result.endpoint.error}`)
  }

  // Performance
  if (result.endpoint.responseTime && result.endpoint.responseTime > 5000) {
    recommendations.push('Performance: Temps de réponse de l\'endpoint élevé (>5s)')
  }

  // Subscription
  if (!result.subscription.canCreate && result.subscription.reason) {
    recommendations.push(`Subscription: ${result.subscription.reason}`)
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Tous les tests sont réussis - système opérationnel')
  }

  return recommendations
}

/**
 * POST /api/tracking/test-webhook
 * Exécuter un test avec tentative de réparation automatique
 */
export async function POST(request: NextRequest) {
  try {
    // Exécuter d'abord le test standard
    const testResponse = await GET(request)
    const testData = await testResponse.json()

    // Si des problèmes sont détectés, essayer des réparations automatiques
    if (!testData.healthy) {
      const repairs: string[] = []

      // Essayer de créer une subscription automatiquement si possible
      if (testData.test.connectivity.microsoft && testData.test.configuration.valid) {
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            const { AutoWebhookService } = await import('@/lib/services/auto-webhook-service')
            const autoService = new AutoWebhookService()
            
            const result = await autoService.ensureWebhookSubscription(user.id)
            if (result.success) {
              repairs.push(`Subscription ${result.action}: ${result.subscriptionId}`)
            }
          }
        } catch (repairError) {
          console.log('Réparation automatique échouée:', repairError)
        }
      }

      return NextResponse.json({
        ...testData,
        repairAttempted: true,
        repairs,
        message: repairs.length > 0 ? 'Réparations automatiques effectuées' : 'Aucune réparation automatique possible'
      })
    }

    return NextResponse.json({
      ...testData,
      message: 'Système fonctionnel - aucune réparation nécessaire'
    })

  } catch (error) {
    return NextResponse.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Erreur lors du test avec réparation',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}