// ====================================================================================================
// SUPABASE EDGE FUNCTION: subscription-manager
// ====================================================================================================
// Description: Gère les subscriptions Microsoft Graph (création, renouvellement, monitoring)
// URL: https://[project-id].supabase.co/functions/v1/subscription-manager
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse } from '../_shared/cors.ts'
// Les fonctions de déchiffrement sont maintenant intégrées dans ce fichier (voir lignes 673+)

// Types Supabase
interface SupabaseUser {
  id: string
  email?: string
  [key: string]: unknown
}

interface MicrosoftTokenData {
  id: string
  user_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_nonce: string
  expires_at: string
  scope: string
  created_at: string
  updated_at: string
  last_refreshed_at?: string
  refresh_attempts: number
}

// Types Microsoft Graph
interface GraphSubscription {
  id?: string
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  latestSupportedTlsVersion?: string
}

interface GraphSubscriptionResponse {
  id: string
  resource: string
  changeType: string
  notificationUrl: string
  expirationDateTime: string
  clientState: string
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE') || 'supabase-webhook-secret'

// Note: AZURE_* variables ne sont plus nécessaires car nous utilisons les tokens utilisateur délégués
// au lieu du token d'application client_credentials

// URL de base pour les webhooks
const WEBHOOK_BASE_URL = `${SUPABASE_URL}/functions/v1/webhook-handler`

console.log('🔧 Subscription Manager initialized')

serve(async (req: Request) => {
  // Gérer la requête OPTIONS pour le preflight CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Vérifier l'authentification utilisateur
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return createCorsResponse({
        error: 'Authorization header manquant',
        message: 'Token Supabase requis'
      }, { status: 401 })
    }

    // Récupérer l'utilisateur Supabase
    const user = await getSupabaseUser(authHeader)
    if (!user) {
      return createCorsResponse({
        error: 'Utilisateur non authentifié',
        message: 'Token Supabase invalide'
      }, { status: 401 })
    }

    const url = new URL(req.url)
    let action = url.searchParams.get('action') || 'status'
    
    // Si pas d'action dans l'URL, vérifier le body pour les appels via supabase.functions.invoke
    if (!url.searchParams.get('action') && req.method === 'POST') {
      try {
        const body = await req.json()
        action = body.action || action
      } catch (error) {
        console.log(`📝 Pas de body JSON, utilisation des paramètres URL : ${error}`)
      }
    }
    
    // Pour les appels GET sans paramètre, action par défaut = status
    if (req.method === 'GET' && !url.searchParams.get('action')) {
      action = 'status'
    }
    
    console.log(`📨 ${req.method} ${req.url}`)
    console.log('🎯 Action demandée:', action, 'pour user:', user.id)

    // ================================================================================================
    // ACTIONS DISPONIBLES
    // ================================================================================================
    switch (action) {
      case 'create':
        return await handleCreateSubscription(user)
      
      case 'renew':
        return await handleRenewSubscriptions(user)
      
      case 'status':
        return await handleGetStatus(user)
      
      case 'cleanup':
        return await handleCleanupSubscriptions(user)
      
      default:
        return createCorsResponse({
          error: 'Action non supportée',
          availableActions: ['create', 'renew', 'status', 'cleanup']
        }, { status: 400 })
    }

  } catch (error: unknown) {
    console.error('❌ Erreur dans subscription manager:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// CRÉER UNE NOUVELLE SUBSCRIPTION (DUAL: INBOX + SENT ITEMS)
// ====================================================================================================
async function handleCreateSubscription(user: SupabaseUser): Promise<Response> {
  try {
    console.log('🆕 Création subscriptions duales pour user:', user.id)

    // Récupérer le token Microsoft de l'utilisateur
    const accessToken = await getUserMicrosoftToken(user.id)
    if (!accessToken) {
      return createCorsResponse({
        error: 'Token Microsoft manquant',
        message: 'Veuillez vous connecter à Microsoft dans les paramètres'
      }, { status: 401 })
    }

    // Calculer la date d'expiration (max 3 jours pour les messages)
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 71) // ~3 jours

    // Définir les deux subscriptions : inbox + sent items
    const subscriptions: GraphSubscription[] = [
      {
        changeType: 'created',
        notificationUrl: WEBHOOK_BASE_URL,
        resource: '/me/messages', // Messages reçus (inbox)
        expirationDateTime: expirationDate.toISOString(),
        clientState: WEBHOOK_CLIENT_STATE,
        latestSupportedTlsVersion: 'v1_2'
      },
      {
        changeType: 'created',
        notificationUrl: WEBHOOK_BASE_URL,
        resource: '/me/mailFolders/sentitems/messages', // Messages envoyés
        expirationDateTime: expirationDate.toISOString(),
        clientState: WEBHOOK_CLIENT_STATE,
        latestSupportedTlsVersion: 'v1_2'
      }
    ]

    const createdSubscriptions: GraphSubscriptionResponse[] = []
    let errors = 0

    // Créer les deux subscriptions
    for (const subscription of subscriptions) {
      try {
        console.log('📤 Envoi subscription à Microsoft Graph:', {
          resource: subscription.resource,
          notificationUrl: subscription.notificationUrl,
          expirationDateTime: subscription.expirationDateTime
        })

        // Créer la subscription via Microsoft Graph
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
          console.error('❌ Erreur création subscription Graph:', response.status, errorText, 'Resource:', subscription.resource)
          errors++
          continue
        }

        const graphSubscription: GraphSubscriptionResponse = await response.json()
        console.log('✅ Subscription créée:', graphSubscription.id, 'Resource:', graphSubscription.resource)

        // Sauvegarder en base de données
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        const { error: dbError } = await supabase
          .from('graph_subscriptions')
          .insert({
            subscription_id: graphSubscription.id,
            resource: graphSubscription.resource,
            notification_url: graphSubscription.notificationUrl,
            change_types: [graphSubscription.changeType],
            expiration_datetime: graphSubscription.expirationDateTime,
            client_state: graphSubscription.clientState,
            is_active: true,
            last_renewal_at: new Date().toISOString()
          })

        if (dbError) {
          console.error('❌ Erreur sauvegarde DB:', dbError)
          // Tentative de supprimer la subscription Graph en cas d'erreur DB
          await deleteGraphSubscription(accessToken, graphSubscription.id)
          errors++
          continue
        }

        console.log('✅ Subscription sauvegardée en DB:', graphSubscription.resource)
        createdSubscriptions.push(graphSubscription)

      } catch (error: unknown) {
        console.error('❌ Erreur pour subscription:', subscription.resource, error)
        errors++
      }
    }

    // Vérifier les résultats
    if (createdSubscriptions.length === 0) {
      return createCorsResponse({
        error: 'Aucune subscription créée',
        message: 'Toutes les subscriptions ont échoué',
        errors
      }, { status: 500 })
    }

    const success = createdSubscriptions.length === subscriptions.length
    const statusCode = success ? 201 : 207 // 207 = Multi-Status

    return createCorsResponse({
      success,
      subscriptions: createdSubscriptions.map(sub => ({
        id: sub.id,
        resource: sub.resource,
        expirationDateTime: sub.expirationDateTime,
        notificationUrl: sub.notificationUrl
      })),
      message: `${createdSubscriptions.length}/${subscriptions.length} subscriptions créées`,
      total: subscriptions.length,
      created: createdSubscriptions.length,
      errors
    }, { status: statusCode })

  } catch (error: unknown) {
    console.error('❌ Erreur création subscriptions duales:', error)
    return createCorsResponse({
      error: 'Erreur création subscriptions duales',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// RENOUVELER LES SUBSCRIPTIONS EXISTANTES
// ====================================================================================================
async function handleRenewSubscriptions(user: SupabaseUser): Promise<Response> {
  try {
    console.log('🔄 Renouvellement des subscriptions')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer les subscriptions qui expirent dans les 6 prochaines heures
    const expirationThreshold = new Date()
    expirationThreshold.setHours(expirationThreshold.getHours() + 6)

    const { data: subscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .eq('is_active', true)
      .lt('expiration_datetime', expirationThreshold.toISOString())
      .order('expiration_datetime', { ascending: true })

    if (error) {
      throw new Error(`Erreur récupération subscriptions: ${error.message}`)
    }

    console.log(`📋 ${subscriptions?.length || 0} subscriptions à renouveler`)

    if (!subscriptions || subscriptions.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucune subscription à renouveler',
        renewed: 0
      }, { status: 200 })
    }

    // Récupérer le token Microsoft de l'utilisateur
    const accessToken = await getUserMicrosoftToken(user.id)
    if (!accessToken) {
      return createCorsResponse({
        error: 'Token Microsoft manquant',
        message: 'Veuillez vous reconnecter à Microsoft dans les paramètres'
      }, { status: 401 })
    }

    let renewed = 0
    let errors = 0

    for (const subscription of subscriptions) {
      try {
        console.log(`🔄 Renouvellement subscription: ${subscription.subscription_id}`)

        // Nouvelle date d'expiration (3 jours)
        const newExpirationDate = new Date()
        newExpirationDate.setHours(newExpirationDate.getHours() + 71)

        // Renouveler via Microsoft Graph
        const renewResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscription.subscription_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            expirationDateTime: newExpirationDate.toISOString()
          })
        })

        if (!renewResponse.ok) {
          console.error(`❌ Erreur renouvellement Graph ${subscription.subscription_id}:`, renewResponse.status)
          
          // Si la subscription n'existe plus, la marquer comme inactive
          if (renewResponse.status === 404) {
            await supabase
              .from('graph_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id)
            console.log(`⚠️ Subscription ${subscription.subscription_id} marquée inactive (404)`)
          }
          
          errors++
          continue
        }

        // Mettre à jour en base de données
        const { error: updateError } = await supabase
          .from('graph_subscriptions')
          .update({
            expiration_datetime: newExpirationDate.toISOString(),
            last_renewal_at: new Date().toISOString(),
            renewal_attempts: subscription.renewal_attempts + 1
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error(`❌ Erreur mise à jour DB ${subscription.subscription_id}:`, updateError)
          errors++
          continue
        }

        console.log(`✅ Subscription ${subscription.subscription_id} renouvelée jusqu'au ${newExpirationDate.toISOString()}`)
        renewed++

      } catch (error: unknown) {
        console.error(`❌ Erreur renouvellement ${subscription.subscription_id}:`, error)
        errors++
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Renouvellement terminé',
      renewed,
      errors,
      total: subscriptions.length
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur renouvellement subscriptions:', error)
    return createCorsResponse({
      error: 'Erreur renouvellement subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// OBTENIR LE STATUT DES SUBSCRIPTIONS
// ====================================================================================================
async function handleGetStatus(_user: SupabaseUser): Promise<Response> {
  try {
    console.log('📊 Récupération du statut des subscriptions')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Statistiques générales
    const { data: stats } = await supabase
      .from('graph_subscriptions')
      .select('is_active, expiration_datetime')

    const now = new Date()
    const active = stats?.filter(s => s.is_active).length || 0
    const expired = stats?.filter(s => s.is_active && new Date(s.expiration_datetime) < now).length || 0
    const expiringIn6h = stats?.filter(s => {
      const expiry = new Date(s.expiration_datetime)
      const in6hours = new Date(now.getTime() + 6 * 60 * 60 * 1000)
      return s.is_active && expiry < in6hours
    }).length || 0

    // Détails des subscriptions actives
    const { data: activeSubscriptions } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .eq('is_active', true)
      .order('expiration_datetime', { ascending: false })

    // Formater la réponse pour le composant React
    const formattedSubscriptions = activeSubscriptions?.map(sub => ({
      id: sub.subscription_id,
      resource: sub.resource,
      expires_at: sub.expiration_datetime,
      status: new Date(sub.expiration_datetime) > now ? 'active' : 'expired'
    })) || []

    return createCorsResponse({
      active: active > 0,
      count: active,
      subscriptions: formattedSubscriptions,
      lastUpdate: new Date().toISOString(),
      statistics: {
        total: stats?.length || 0,
        active,
        expired,
        expiringIn6h
      }
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur statut subscriptions:', error)
    return createCorsResponse({
      error: 'Erreur récupération statut',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// NETTOYER LES SUBSCRIPTIONS INACTIVES
// ====================================================================================================
async function handleCleanupSubscriptions(user: SupabaseUser): Promise<Response> {
  try {
    console.log('🧹 Nettoyage des subscriptions inactives')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Supprimer les subscriptions expirées depuis plus de 24h
    const cleanupThreshold = new Date()
    cleanupThreshold.setHours(cleanupThreshold.getHours() - 24)

    const { data: expiredSubscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .or('is_active.eq.false,expiration_datetime.lt.' + cleanupThreshold.toISOString())

    if (error) {
      throw new Error(`Erreur récupération subscriptions expirées: ${error.message}`)
    }

    console.log(`📋 ${expiredSubscriptions?.length || 0} subscriptions à nettoyer`)

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Aucune subscription à nettoyer',
        cleaned: 0
      }, { status: 200 })
    }

    // Récupérer le token Microsoft de l'utilisateur pour supprimer les subscriptions
    const accessToken = await getUserMicrosoftToken(user.id)
    let cleaned = 0

    for (const subscription of expiredSubscriptions) {
      try {
        // Supprimer de Microsoft Graph si le token est disponible
        if (accessToken) {
          await deleteGraphSubscription(accessToken, subscription.subscription_id)
        }

        // Supprimer de la base de données
        const { error: deleteError } = await supabase
          .from('graph_subscriptions')
          .delete()
          .eq('id', subscription.id)

        if (deleteError) {
          console.error(`❌ Erreur suppression DB ${subscription.subscription_id}:`, deleteError)
          continue
        }

        console.log(`✅ Subscription ${subscription.subscription_id} nettoyée`)
        cleaned++

      } catch (error: unknown) {
        console.error(`❌ Erreur nettoyage ${subscription.subscription_id}:`, error)
      }
    }

    return createCorsResponse({
      success: true,
      message: 'Nettoyage terminé',
      cleaned,
      total: expiredSubscriptions.length
    }, { status: 200 })

  } catch (error: unknown) {
    console.error('❌ Erreur nettoyage subscriptions:', error)
    return createCorsResponse({
      error: 'Erreur nettoyage subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ====================================================================================================
// UTILITAIRES
// ====================================================================================================

// ====================================================================================================
// GESTION DES TOKENS UTILISATEUR MICROSOFT
// ====================================================================================================

/**
 * Récupère le token Microsoft d'un utilisateur (déchiffré et vérifié)
 */
async function getUserMicrosoftToken(userId: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer les tokens chiffrés de l'utilisateur
    const { data: tokenData, error } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !tokenData) {
      console.log(`📭 Pas de tokens Microsoft pour user ${userId}`)
      return null
    }

    // Vérifier si le token est expiré
    if (isTokenExpired(tokenData.expires_at)) {
      console.log(`⏰ Token Microsoft expiré pour user ${userId}`)
      
      // Essayer de renouveler automatiquement
      const refreshedToken = await refreshUserMicrosoftToken(userId, tokenData)
      return refreshedToken
    }

    console.log(`✅ Token Microsoft valide pour user ${userId}`)
    
    // Décrypter les tokens avec la même méthode que le frontend
    console.log('🔓 Déchiffrement du token d\'accès...')
    const serverSalt = `${userId}-encryption-salt-2024`
    const decryptedTokens = await decryptUserTokens({
      accessTokenEncrypted: tokenData.access_token_encrypted,
      refreshTokenEncrypted: tokenData.refresh_token_encrypted,
      nonce: tokenData.token_nonce,
      expiresAt: tokenData.expires_at,
      scope: tokenData.scope || ''
    }, userId, serverSalt)

    if (!decryptedTokens) {
      console.error('❌ Impossible de déchiffrer les tokens')
      return null
    }

    console.log('✅ Token d\'accès déchiffré avec succès')
    return decryptedTokens.accessToken

  } catch (error: unknown) {
    console.error(`❌ Erreur récupération token user ${userId}:`, error)
    return null
  }
}

/**
 * Renouvelle automatiquement le token Microsoft d'un utilisateur
 */
async function refreshUserMicrosoftToken(userId: string, tokenData: MicrosoftTokenData): Promise<string | null> {
  try {
    console.log(`🔄 Tentative de renouvellement token pour user ${userId}`)
    
    // TODO: Implémenter le renouvellement automatique
    // 1. Déchiffrer le refresh token
    // 2. Appeler Microsoft pour renouveler
    // 3. Re-chiffrer et sauvegarder les nouveaux tokens
    
    // Pour l'instant, marquer comme nécessitant une reconnexion
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    await supabase
      .from('microsoft_tokens')
      .update({ 
        refresh_attempts: tokenData.refresh_attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    console.log(`⚠️ Token non renouvelé - reconnexion requise pour user ${userId}`)
    return null

  } catch (error: unknown) {
    console.error(`❌ Erreur renouvellement token user ${userId}:`, error)
    return null
  }
}

// Supprimer une subscription de Microsoft Graph
async function deleteGraphSubscription(accessToken: string, subscriptionId: string): Promise<void> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok || response.status === 404) {
      console.log(`✅ Subscription Graph ${subscriptionId} supprimée`)
    } else {
      console.error(`❌ Erreur suppression Graph ${subscriptionId}:`, response.status)
    }
  } catch (error: unknown) {
    console.error(`❌ Erreur suppression subscription ${subscriptionId}:`, error)
  }
}

// ====================================================================================================
// UTILITAIRES SUPABASE
// ====================================================================================================

/**
 * Récupère l'utilisateur Supabase depuis le token d'autorisation
 */
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
    
    const accessTokenEncrypted = new Uint8Array(base64ToArrayBufferCompat(encryptedTokens.accessTokenEncrypted))
    const refreshTokenEncrypted = new Uint8Array(base64ToArrayBufferCompat(encryptedTokens.refreshTokenEncrypted))
    const nonce = new Uint8Array(base64ToArrayBufferCompat(encryptedTokens.nonce))
    
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
function base64ToArrayBufferCompat(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Vérifie si un token est expiré
 */
function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date()
}

console.log('🚀 Subscription Manager v2.2 ready - Dual Subscriptions (Inbox + Sent Items)')