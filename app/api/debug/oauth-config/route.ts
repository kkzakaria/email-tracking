import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/debug/oauth-config
 * Diagnostic de la configuration OAuth Microsoft
 */
export async function GET(request: NextRequest) {
  try {
    // Déterminer l'URL de redirection selon l'environnement
    const getRedirectUrl = () => {
      // En production Vercel
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}/api/auth/microsoft/callback`
      }
      
      // URL configurée manuellement
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
      }
      
      // Fallback pour développement local
      return 'http://localhost:3000/api/auth/microsoft/callback'
    }

    const redirectUrl = getRedirectUrl()
    const currentUrl = request.nextUrl.origin

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        vercel_env: process.env.VERCEL_ENV,
        vercel_url: process.env.VERCEL_URL,
        current_origin: currentUrl
      },
      azure_config: {
        client_id: process.env.AZURE_AD_CLIENT_ID || 'NON_CONFIGURÉ',
        tenant_id: process.env.AZURE_AD_TENANT_ID || 'NON_CONFIGURÉ',
        client_secret_configured: !!process.env.AZURE_AD_CLIENT_SECRET,
        client_secret_length: process.env.AZURE_AD_CLIENT_SECRET?.length || 0
      },
      app_urls: {
        next_public_app_url: process.env.NEXT_PUBLIC_APP_URL || 'NON_CONFIGURÉ',
        calculated_redirect_url: redirectUrl,
        expected_redirect_url: `${currentUrl}/api/auth/microsoft/callback`
      },
      redirect_uri_analysis: {
        using_vercel_url: !!process.env.VERCEL_URL,
        using_app_url: !!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL,
        using_fallback: !process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_APP_URL,
        protocol: redirectUrl.startsWith('https://') ? 'HTTPS' : 'HTTP',
        is_production_ready: redirectUrl.startsWith('https://') && !redirectUrl.includes('localhost')
      },
      required_azure_redirects: [
        'https://email-tracking-zeta.vercel.app/api/auth/microsoft/callback',
        'http://localhost:3000/api/auth/microsoft/callback',
        redirectUrl !== 'https://email-tracking-zeta.vercel.app/api/auth/microsoft/callback' && 
        redirectUrl !== 'http://localhost:3000/api/auth/microsoft/callback' ? redirectUrl : null
      ].filter(Boolean),
      configuration_warnings: [],
      next_steps: []
    }

    // Analyse et warnings
    if (!process.env.AZURE_AD_CLIENT_ID) {
      diagnostics.configuration_warnings.push('AZURE_AD_CLIENT_ID manquant')
    }

    if (!process.env.AZURE_AD_CLIENT_SECRET) {
      diagnostics.configuration_warnings.push('AZURE_AD_CLIENT_SECRET manquant')
    }

    if (!process.env.AZURE_AD_TENANT_ID) {
      diagnostics.configuration_warnings.push('AZURE_AD_TENANT_ID manquant')
    }

    if (redirectUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      diagnostics.configuration_warnings.push('Utilise localhost en production')
    }

    if (!redirectUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
      diagnostics.configuration_warnings.push('Utilise HTTP en production (devrait être HTTPS)')
    }

    if (redirectUrl !== `${currentUrl}/api/auth/microsoft/callback`) {
      diagnostics.configuration_warnings.push(`URL de redirection calculée (${redirectUrl}) ne correspond pas à l'origine actuelle (${currentUrl})`)
    }

    // Étapes suivantes
    if (diagnostics.configuration_warnings.length > 0) {
      diagnostics.next_steps.push('Corriger les warnings de configuration')
    }

    diagnostics.next_steps.push(
      'Vérifier que les URI de redirection sont configurés dans Azure AD Portal',
      'Tester la connexion OAuth sur /login',
      'Vérifier les logs Azure AD en cas d\'erreur'
    )

    return NextResponse.json({
      status: diagnostics.configuration_warnings.length === 0 ? 'OK' : 'WARNINGS',
      ...diagnostics
    })

  } catch (error) {
    console.error('❌ Erreur diagnostic OAuth:', error)
    
    return NextResponse.json({
      status: 'ERROR',
      error: 'Erreur lors du diagnostic OAuth',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}