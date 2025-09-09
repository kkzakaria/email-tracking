// ====================================================================================================
// SUPABASE EDGE FUNCTION: microsoft-auth
// ====================================================================================================
// Description: Gère l'authentification OAuth2 Microsoft Graph avec chiffrement E2E des tokens
// URL: https://[project-id].supabase.co/functions/v1/microsoft-auth
// Actions: authorize, callback, refresh, revoke, status
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse } from '../_shared/cors.ts'
import type { 
  OAuthTokenResponse, 
  EncryptedTokenData, 
  RequestBody, 
  SupabaseUser,
  TokenResponse,
  AuthUrlResponse
} from '../_shared/types.ts'

// ====================================================================================================
// CONFIGURATION
// ====================================================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID')!
const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET')!
const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID')!

// URLs Microsoft OAuth2
const AUTHORIZE_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`
const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`

// Configuration OAuth2
const SCOPES = 'openid profile Mail.Read offline_access'
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'
const REDIRECT_URI = `${APP_URL}/auth/microsoft-callback` // Page HTML qui traite le callback

console.log('🔐 Microsoft Auth initialized')
console.log('📍 Redirect URI:', REDIRECT_URI)

// ====================================================================================================
// MAIN HANDLER
// ====================================================================================================

serve(async (req: Request) => {
  // Gérer la requête OPTIONS pour le preflight CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    let action = url.searchParams.get('action') || 'status'
    
    // Si POST avec body, l'action peut être dans le body
    let bodyData: RequestBody = {}
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      try {
        bodyData = await req.json() as RequestBody
        console.log('📦 Body reçu:', JSON.stringify(bodyData))
        if (bodyData.action) {
          action = bodyData.action
          console.log('🔄 Action mise à jour depuis le body:', action)
        }
      } catch (e) {
        console.error('❌ Erreur parsing JSON:', e)
        // Ignore JSON parse errors for non-JSON bodies
      }
    }
    
    console.log(`📨 ${req.method} ${req.url}`)
    console.log('🎯 Action finale:', action)
    console.log('📝 Body data keys:', Object.keys(bodyData))

    // Récupérer l'utilisateur depuis l'en-tête Authorization
    const authHeader = req.headers.get('Authorization')
    
    // Vérifier l'autorisation selon l'action
    const actionsRequiringAuth = ['store', 'refresh', 'revoke']
    if (!authHeader && actionsRequiringAuth.includes(action)) {
      return createCorsResponse({
        error: 'Authorization header manquant',
        message: 'Token Supabase requis pour cette action'
      }, { status: 401 })
    }

    // ================================================================================================
    // ACTIONS OAUTH2
    // ================================================================================================
    
    switch (action) {
      case 'authorize':
        return await handleAuthorize(req)
      
      case 'callback':
        return await handleCallback(req, bodyData)
      
      case 'store':
        return await handleStoreTokens(req, authHeader!, bodyData)
      
      case 'refresh':
        return await handleRefresh(req, authHeader!, bodyData)
      
      case 'revoke':
        return await handleRevoke(req, authHeader!)
      
      case 'status':
        return await handleStatus(req, authHeader)
      
      default:
        return createCorsResponse({
          error: 'Action non supportée',
          availableActions: ['authorize', 'callback', 'store', 'refresh', 'revoke', 'status']
        }, { status: 400 })
    }

  } catch (error: unknown) {
    console.error('❌ Erreur dans microsoft-auth:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// AUTORISATION OAUTH2 - Générer l'URL d'autorisation
// ====================================================================================================

async function handleAuthorize(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const state = url.searchParams.get('state') || crypto.randomUUID()
    
    // Générer les paramètres OAuth2 avec PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    // Construire l'URL d'autorisation Microsoft
    const authUrl = new URL(AUTHORIZE_URL)
    authUrl.searchParams.set('client_id', AZURE_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('prompt', 'select_account')

    console.log('🔗 URL d\'autorisation générée:', authUrl.toString())

    const response: AuthUrlResponse = {
      authUrl: authUrl.toString(),
      state,
      codeVerifier, // À stocker côté client pour le callback
      expiresIn: 600 // 10 minutes de validité
    }

    return createCorsResponse(response, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur génération URL d\'autorisation:', error)
    return createCorsResponse({
      error: 'Erreur génération URL d\'autorisation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// CALLBACK OAUTH2 - Échanger le code contre des tokens
// ====================================================================================================

async function handleCallback(req: Request, bodyData: RequestBody): Promise<Response> {
  try {
    const url = new URL(req.url)
    // Le code peut venir de l'URL ou du body
    const code = url.searchParams.get('code') || bodyData.code
    const _state = url.searchParams.get('state') || bodyData.state
    const error = url.searchParams.get('error')

    if (error) {
      console.error('❌ Erreur OAuth2:', error, url.searchParams.get('error_description'))
      return createCorsResponse({
        error: 'OAuth2 error',
        message: url.searchParams.get('error_description') || error
      }, { status: 400 })
    }

    if (!code) {
      return createCorsResponse({
        error: 'Code d\'autorisation manquant',
        message: 'Le paramètre code est requis'
      }, { status: 400 })
    }

    const codeVerifier = bodyData.codeVerifier
    if (!codeVerifier) {
      return createCorsResponse({
        error: 'Code verifier manquant',
        message: 'Le codeVerifier PKCE est requis pour sécuriser l\'échange'
      }, { status: 400 })
    }

    // Échanger le code contre des tokens
    const tokenData = await exchangeCodeForTokens(code, codeVerifier)
    
    console.log('✅ Tokens Microsoft obtenus avec succès')
    console.log('📅 Expiration:', new Date(Date.now() + tokenData.expires_in * 1000).toISOString())

    // Retourner les tokens pour chiffrement côté client
    const response: TokenResponse = {
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope
      },
      message: 'Tokens obtenus avec succès'
    }

    return createCorsResponse(response, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur callback OAuth2:', error)
    return createCorsResponse({
      error: 'Erreur callback OAuth2',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// STOCKAGE SÉCURISÉ - Stocker les tokens chiffrés
// ====================================================================================================

async function handleStoreTokens(_req: Request, authHeader: string, bodyData: RequestBody): Promise<Response> {
  try {
    console.log('🔐 handleStoreTokens appelé')
    console.log('📦 Body data reçu:', JSON.stringify(bodyData))
    
    // Vérifier l'utilisateur Supabase
    const user = await getSupabaseUser(authHeader)
    if (!user) {
      console.error('❌ Utilisateur non authentifié')
      return createCorsResponse({
        error: 'Utilisateur non authentifié'
      }, { status: 401 })
    }

    console.log('👤 User ID:', user.id)

    const body: EncryptedTokenData = {
      accessTokenEncrypted: bodyData.accessTokenEncrypted || '',
      refreshTokenEncrypted: bodyData.refreshTokenEncrypted || '',
      nonce: bodyData.nonce || '',
      expiresAt: bodyData.expiresAt || '',
      scope: bodyData.scope || ''
    }
    
    console.log('🔐 Encrypted tokens prepared:', {
      hasAccessToken: !!body.accessTokenEncrypted,
      hasRefreshToken: !!body.refreshTokenEncrypted,
      hasNonce: !!body.nonce,
      expiresAt: body.expiresAt,
      scope: body.scope
    })
    
    if (!body.accessTokenEncrypted || !body.refreshTokenEncrypted || !body.nonce) {
      console.error('❌ Données manquantes:', body)
      return createCorsResponse({
        error: 'Données de tokens chiffrés manquantes',
        message: 'accessTokenEncrypted, refreshTokenEncrypted et nonce requis'
      }, { status: 400 })
    }

    // Sauvegarder les tokens chiffrés en base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: _data, error } = await supabase
      .from('microsoft_tokens')
      .upsert({
        user_id: user.id,
        access_token_encrypted: body.accessTokenEncrypted,
        refresh_token_encrypted: body.refreshTokenEncrypted,
        token_nonce: body.nonce,
        expires_at: body.expiresAt,
        scope: body.scope,
        last_refreshed_at: new Date().toISOString(),
        refresh_attempts: 0
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Erreur sauvegarde tokens:', error)
      throw new Error(`Erreur base de données: ${error.message}`)
    }

    console.log('✅ Tokens chiffrés sauvegardés pour user:', user.id)

    // Créer automatiquement la subscription Microsoft Graph après le stockage des tokens
    let subscriptionCreated = false
    try {
      console.log('📧 Création automatique de la subscription Microsoft Graph...')
      
      // Déchiffrer temporairement l'access token pour créer la subscription
      const serverSalt = `${user.id}-encryption-salt-2024`
      const decryptedTokens = await decryptUserTokens({
        accessTokenEncrypted: body.accessTokenEncrypted,
        refreshTokenEncrypted: body.refreshTokenEncrypted,
        nonce: body.nonce,
        expiresAt: body.expiresAt,
        scope: body.scope
      }, user.id, serverSalt)
      
      if (decryptedTokens && decryptedTokens.accessToken) {
        await createMicrosoftSubscription(user.id, decryptedTokens.accessToken)
        subscriptionCreated = true
        console.log('✅ Subscription Microsoft Graph créée automatiquement')
      } else {
        console.error('⚠️ Impossible de déchiffrer le token pour créer la subscription')
      }
    } catch (subscriptionError) {
      console.error('⚠️ Erreur création subscription (non bloquante):', subscriptionError)
      // Ne pas faire échouer le stockage des tokens si la subscription échoue
    }

    return createCorsResponse({
      success: true,
      message: 'Tokens Microsoft sauvegardés avec succès',
      subscriptionCreated
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('❌ Erreur stockage tokens:', error)
    return createCorsResponse({
      error: 'Erreur stockage tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// RENOUVELLEMENT - Refresh des tokens expirés
// ====================================================================================================

async function handleRefresh(_req: Request, authHeader: string, bodyData: RequestBody): Promise<Response> {
  try {
    const user = await getSupabaseUser(authHeader)
    if (!user) {
      return createCorsResponse({
        error: 'Utilisateur non authentifié'
      }, { status: 401 })
    }

    console.log('🔄 Renouvellement tokens pour user:', user.id)

    // Récupérer les tokens chiffrés stockés
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: storedTokens, error } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error || !storedTokens) {
      return createCorsResponse({
        error: 'Tokens Microsoft non trouvés',
        message: 'Veuillez vous reconnecter à Microsoft'
      }, { status: 404 })
    }

    // Pour le renouvellement, nous devons déchiffrer le refresh token
    // Le client doit fournir les tokens déchiffrés ou nous devons les déchiffrer ici
    const refreshToken = bodyData.refreshToken

    if (!refreshToken) {
      return createCorsResponse({
        error: 'Refresh token manquant',
        message: 'Le refresh token déchiffré est requis'
      }, { status: 400 })
    }

    // Renouveler les tokens via Microsoft
    const newTokens = await refreshMicrosoftTokens(refreshToken)
    
    console.log('✅ Nouveaux tokens Microsoft obtenus')

    // Retourner les nouveaux tokens pour re-chiffrement côté client
    return createCorsResponse({
      success: true,
      tokens: {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || refreshToken, // Garde l'ancien si pas de nouveau
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        scope: newTokens.scope
      },
      message: 'Tokens renouvelés avec succès'
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur renouvellement tokens:', error)
    return createCorsResponse({
      error: 'Erreur renouvellement tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// RÉVOCATION - Supprimer les tokens
// ====================================================================================================

async function handleRevoke(_req: Request, authHeader: string): Promise<Response> {
  try {
    const user = await getSupabaseUser(authHeader)
    if (!user) {
      return createCorsResponse({
        error: 'Utilisateur non authentifié'
      }, { status: 401 })
    }

    console.log('🗑️ Révocation tokens pour user:', user.id)

    // Supprimer les tokens de la base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { error } = await supabase
      .from('microsoft_tokens')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ Erreur suppression tokens:', error)
      throw new Error(`Erreur base de données: ${error.message}`)
    }

    console.log('✅ Tokens Microsoft révoqués pour user:', user.id)

    return createCorsResponse({
      success: true,
      message: 'Tokens Microsoft révoqués avec succès'
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur révocation tokens:', error)
    return createCorsResponse({
      error: 'Erreur révocation tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// STATUT - Vérifier l'état de l'authentification
// ====================================================================================================

async function handleStatus(_req: Request, authHeader: string | null): Promise<Response> {
  try {
    if (!authHeader) {
      return createCorsResponse({
        authenticated: false,
        microsoft: false,
        message: 'Non authentifié'
      }, { status: 200 })
    }

    const user = await getSupabaseUser(authHeader)
    if (!user) {
      return createCorsResponse({
        authenticated: false,
        microsoft: false,
        message: 'Token Supabase invalide'
      }, { status: 200 })
    }

    // Vérifier si l'utilisateur a des tokens Microsoft
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: tokens, error } = await supabase
      .from('microsoft_tokens')
      .select('expires_at, scope, created_at, last_refreshed_at')
      .eq('user_id', user.id)
      .single()

    if (error || !tokens) {
      return createCorsResponse({
        authenticated: true,
        microsoft: false,
        user: {
          id: user.id,
          email: user.email
        },
        message: 'Pas de tokens Microsoft'
      }, { status: 200 })
    }

    const isExpired = new Date(tokens.expires_at) < new Date()

    return createCorsResponse({
      authenticated: true,
      microsoft: true,
      user: {
        id: user.id,
        email: user.email
      },
      tokens: {
        expiresAt: tokens.expires_at,
        isExpired,
        scope: tokens.scope,
        connectedAt: tokens.created_at,
        lastRefreshed: tokens.last_refreshed_at
      },
      message: isExpired ? 'Tokens expirés, renouvellement requis' : 'Connecté à Microsoft'
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur vérification statut:', error)
    return createCorsResponse({
      error: 'Erreur vérification statut',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// UTILITAIRES OAUTH2
// ====================================================================================================

// Générer un code verifier pour PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Générer un code challenge pour PKCE
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Échanger le code d'autorisation contre des tokens
async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur échange code/tokens:', response.status, errorText)
    throw new Error(`Microsoft OAuth2 error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

// Renouveler les tokens avec le refresh token
async function refreshMicrosoftTokens(refreshToken: string): Promise<OAuthTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur renouvellement tokens:', response.status, errorText)
    throw new Error(`Microsoft refresh error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

// ====================================================================================================
// UTILITAIRES SUPABASE
// ====================================================================================================

// Récupérer l'utilisateur Supabase depuis le token
async function getSupabaseUser(authHeader: string): Promise<SupabaseUser | null> {
  try {
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      console.error('❌ Utilisateur Supabase non valide:', error)
      return null
    }
    
    return user as unknown as SupabaseUser
  } catch (error) {
    console.error('❌ Erreur vérification utilisateur:', error)
    return null
  }
}

// ====================================================================================================
// CRÉATION DE SUBSCRIPTION MICROSOFT GRAPH
// ====================================================================================================

async function createMicrosoftSubscription(userId: string, accessToken: string): Promise<void> {
  try {
    console.log('🆕 Création subscription Microsoft Graph pour user:', userId)

    if (!accessToken) {
      throw new Error('Token Microsoft manquant pour créer la subscription')
    }

    // Calculer la date d'expiration (max 3 jours pour les messages)
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 71) // ~3 jours

    const subscription = {
      changeType: 'created',
      notificationUrl: `${SUPABASE_URL}/functions/v1/webhook-handler`,
      resource: 'me/messages',
      expirationDateTime: expirationDate.toISOString(),
      clientState: Deno.env.get('WEBHOOK_CLIENT_STATE') || 'secure-webhook-validation-key-2024'
    }

    console.log('📧 Création subscription:', {
      changeType: subscription.changeType,
      resource: subscription.resource,
      notificationUrl: subscription.notificationUrl,
      expirationDateTime: subscription.expirationDateTime
    })

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur création subscription Graph:', response.status, errorText)
      throw new Error(`Microsoft Graph error: ${response.status} - ${errorText}`)
    }

    const subscriptionData = await response.json()
    console.log('✅ Subscription créée:', subscriptionData.id)

    // Stocker la subscription en base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await supabase
      .from('graph_subscriptions')
      .insert({
        user_id: userId,
        subscription_id: subscriptionData.id,
        resource: subscription.resource,
        change_types: [subscription.changeType],
        notification_url: subscription.notificationUrl,
        expiration_datetime: subscription.expirationDateTime,
        client_state: subscription.clientState,
        is_active: true
      })

    console.log('✅ Subscription sauvegardée en base pour user:', userId)
  } catch (error) {
    console.error('❌ Erreur création subscription:', error)
    throw error
  }
}

// Fonction supprimée car non utilisée - le déchiffrement se fait directement dans handleStoreTokens

// ====================================================================================================
// FONCTIONS DE CHIFFREMENT COMPATIBLES AVEC LE FRONTEND
// ====================================================================================================

// Types pour les tokens chiffrés (compatibles avec frontend)
interface EncryptedTokens {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  nonce: string
  expiresAt: string
  scope: string
}

interface MicrosoftTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
}

/**
 * Dérive une clé de chiffrement unique pour chaque utilisateur (compatible frontend)
 */
async function deriveEncryptionKey(userId: string, serverSalt: string): Promise<ArrayBuffer> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  const userIdBuffer = new TextEncoder().encode(userId)
  const saltBuffer = new TextEncoder().encode(serverSalt)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    userIdBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )

  return derivedBits
}

/**
 * Déchiffre les tokens depuis le stockage sécurisé (compatible frontend)
 */
async function decryptUserTokens(
  encryptedTokens: EncryptedTokens,
  userId: string,
  serverSalt: string
): Promise<MicrosoftTokens | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Crypto API not available')
    }

    const encryptionKeyBytes = await deriveEncryptionKey(userId, serverSalt)
    
    const encryptionKey = await crypto.subtle.importKey(
      'raw',
      encryptionKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const accessTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.accessTokenEncrypted))
    const refreshTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.refreshTokenEncrypted))
    const nonce = new Uint8Array(base64ToArrayBuffer(encryptedTokens.nonce))
    
    const accessTokenBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      encryptionKey,
      accessTokenEncrypted
    )
    
    const refreshTokenBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      encryptionKey,
      refreshTokenEncrypted
    )
    
    const accessToken = new TextDecoder().decode(accessTokenBytes)
    const refreshToken = new TextDecoder().decode(refreshTokenBytes)
    
    return {
      accessToken,
      refreshToken,
      expiresAt: encryptedTokens.expiresAt,
      scope: encryptedTokens.scope
    }
  } catch (error) {
    console.error('❌ Impossible de déchiffrer les tokens - clé invalide ou données corrompues:', error)
    return null
  }
}

/**
 * Convertit une string base64 en ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

console.log('🚀 Microsoft Auth v1.0 ready - OAuth2 + E2E Encryption')