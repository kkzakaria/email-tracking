// ====================================================================================================
// SUPABASE EDGE FUNCTION: app-token-manager
// ====================================================================================================
// Description: Gestionnaire centralisé des tokens d'application Microsoft Graph
// URL: https://[project-id].supabase.co/functions/v1/app-token-manager
// Actions: get-token, refresh-token, validate-token
// ====================================================================================================

import { serve } from "std/http/server.ts"
import { createCorsResponse, handleCors } from '../_shared/cors.ts'
import { AppTokenData, CachedToken } from '../_shared/types.ts'

// Configuration Azure AD
const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID')
const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET')
const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID')

// Cache en mémoire du token (persiste pendant la durée de vie de la fonction)
let tokenCache: CachedToken | null = null

/**
 * Obtenir un token d'application Microsoft Graph
 */
async function getApplicationToken(): Promise<AppTokenData> {
  console.log('🔑 Demande de token d\'application Microsoft Graph...')

  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    throw new Error('Variables d\'environnement Azure manquantes')
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Erreur obtention token application:', response.status, error)
    throw new Error(`Erreur token application: ${response.status}`)
  }

  const data = await response.json()

  const tokenData: AppTokenData = {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    expires_at: Date.now() + (data.expires_in * 1000) - 60000, // -1min de sécurité
    scope: data.scope || 'https://graph.microsoft.com/.default'
  }

  console.log('✅ Token d\'application obtenu, expire dans', data.expires_in, 'secondes')

  return tokenData
}

/**
 * Obtenir un token valide (avec cache)
 */
async function getValidToken(): Promise<string> {
  const now = Date.now()

  // Vérifier le cache
  if (tokenCache && tokenCache.expires_at > now) {
    const remainingTime = Math.round((tokenCache.expires_at - now) / 1000)
    console.log('📋 Token en cache utilisé, expire dans', remainingTime, 'secondes')
    return tokenCache.access_token
  }

  // Obtenir un nouveau token
  console.log('🔄 Token expiré ou absent, obtention d\'un nouveau token...')
  const tokenData = await getApplicationToken()

  // Mettre en cache
  tokenCache = {
    ...tokenData,
    cached_at: now
  }

  return tokenData.access_token
}

/**
 * Valider un token existant
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Invalider le cache (forcer le renouvellement)
 */
function invalidateCache(): void {
  console.log('🗑️ Cache de token invalidé')
  tokenCache = null
}

serve(async (req: Request): Promise<Response> => {
  // Gestion CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'get-token'

    switch (action) {
      case 'get-token': {
        const token = await getValidToken()
        return createCorsResponse({
          success: true,
          data: {
            access_token: token,
            token_type: 'Bearer',
            cached: tokenCache ? true : false,
            expires_at: tokenCache?.expires_at || null
          }
        })
      }

      case 'validate-token': {
        const { token } = await req.json()
        if (!token) {
          return createCorsResponse({
            success: false,
            error: 'Token requis'
          }, { status: 400 })
        }

        const isValid = await validateToken(token)
        return createCorsResponse({
          success: true,
          data: { valid: isValid }
        })
      }

      case 'refresh-token': {
        invalidateCache()
        const token = await getValidToken()
        return createCorsResponse({
          success: true,
          data: {
            access_token: token,
            token_type: 'Bearer',
            refreshed: true,
            expires_at: tokenCache?.expires_at || null
          }
        })
      }

      case 'status': {
        const now = Date.now()
        return createCorsResponse({
          success: true,
          data: {
            cached: tokenCache ? true : false,
            expires_at: tokenCache?.expires_at || null,
            expires_in_seconds: tokenCache ? Math.max(0, Math.round((tokenCache.expires_at - now) / 1000)) : 0,
            valid: tokenCache && tokenCache.expires_at > now
          }
        })
      }

      default:
        return createCorsResponse({
          success: false,
          error: `Action non supportée: ${action}`
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Erreur app-token-manager:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
})

/*
Usage:
- GET /app-token-manager?action=get-token      : Obtenir un token valide
- POST /app-token-manager?action=validate-token : Valider un token existant
- GET /app-token-manager?action=refresh-token   : Forcer le renouvellement
- GET /app-token-manager?action=status          : Statut du cache
*/