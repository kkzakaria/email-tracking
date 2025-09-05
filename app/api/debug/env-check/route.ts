import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/debug/env-check
 * Vérifier les variables d'environnement critiques en production
 */
export async function GET(request: NextRequest) {
  try {
    // Variables d'environnement critiques pour les webhooks
    const envVars = {
      WEBHOOK_ENABLED: process.env.WEBHOOK_ENABLED,
      WEBHOOK_ENDPOINT_URL: process.env.WEBHOOK_ENDPOINT_URL,
      WEBHOOK_CLIENT_STATE: process.env.WEBHOOK_CLIENT_STATE ? 'Défini' : 'Manquant',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Défini' : 'Manquant',
      NODE_ENV: process.env.NODE_ENV
    }

    // Test de connectivité interne
    let selfConnectivityTest = null
    const webhookUrl = process.env.WEBHOOK_ENDPOINT_URL

    if (webhookUrl) {
      try {
        console.log('🔍 Test de connectivité interne vers:', webhookUrl)
        
        const response = await fetch(webhookUrl, {
          method: 'GET',
          timeout: 10000,
          headers: {
            'User-Agent': 'Internal-Health-Check'
          }
        } as any)

        selfConnectivityTest = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          url: webhookUrl
        }

        if (response.ok) {
          const responseText = await response.text()
          selfConnectivityTest.body = responseText.substring(0, 200) // Première partie seulement
        }

      } catch (error) {
        selfConnectivityTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          type: error?.constructor?.name || 'Error',
          url: webhookUrl
        }
      }
    }

    // Analyse des problèmes potentiels
    const issues = []

    if (!envVars.WEBHOOK_ENABLED) {
      issues.push('WEBHOOK_ENABLED non défini')
    } else if (envVars.WEBHOOK_ENABLED !== 'true') {
      issues.push(`WEBHOOK_ENABLED = "${envVars.WEBHOOK_ENABLED}" (devrait être "true")`)
    }

    if (!envVars.WEBHOOK_ENDPOINT_URL) {
      issues.push('WEBHOOK_ENDPOINT_URL non défini')
    }

    if (!envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY === 'Manquant') {
      issues.push('SUPABASE_SERVICE_ROLE_KEY non défini')
    }

    if (selfConnectivityTest && !selfConnectivityTest.success) {
      issues.push(`Auto-connectivité échoue: ${selfConnectivityTest.error || selfConnectivityTest.status}`)
    }

    return NextResponse.json({
      environment: envVars,
      selfConnectivityTest,
      issues,
      recommendations: issues.length > 0 ? [
        'Vérifiez les variables d\'environnement dans le dashboard Vercel',
        'Assurez-vous que WEBHOOK_ENDPOINT_URL pointe vers le bon domaine',
        'Vérifiez que SUPABASE_SERVICE_ROLE_KEY est correctement défini'
      ] : [
        'Configuration environnement semble correcte'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erreur dans le diagnostic environnement:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur interne',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}