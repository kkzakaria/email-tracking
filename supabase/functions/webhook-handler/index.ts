// ====================================================================================================
// SUPABASE EDGE FUNCTION: webhook-handler
// ====================================================================================================
// Description: Réceptionne et traite les webhooks Microsoft Graph
// URL: https://[project-id].supabase.co/functions/v1/webhook-handler
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse, corsHeaders } from '../_shared/cors.ts'
// Les fonctions de chiffrement sont maintenant intégrées dans chaque Edge Function

// Types Microsoft Graph
interface MicrosoftTokenData {
  id: string
  user_id: string  // Ajout du user_id manquant
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_nonce: string
  expires_at: string
  created_at?: string
  updated_at?: string
  token_scope?: string
  scope?: string  // Alias pour token_scope
}

interface WebhookNotification {
  value: Array<{
    subscriptionId: string
    clientState: string
    changeType: string
    resource: string
    resourceData?: {
      id: string
      '@odata.type': string
      '@odata.etag': string
    }
    subscriptionExpirationDateTime: string
    tenantId?: string
  }>
  validationTokens?: string[]
}

interface GraphMessage {
  id: string
  internetMessageId?: string
  conversationId?: string
  subject?: string
  from?: {
    emailAddress?: {
      address?: string
      name?: string
    }
  }
  toRecipients?: Array<{
    emailAddress?: {
      address?: string
      name?: string
    }
  }>
  receivedDateTime?: string
  sentDateTime?: string  // Ajouté pour les messages envoyés
  bodyPreview?: string
  isRead?: boolean
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE') || 'supabase-webhook-secret'
const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID')!
const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET')!
const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID')!

console.log('🔧 Webhook Handler initialized')

serve(async (req: Request) => {
  // Gérer la requête OPTIONS pour le preflight CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log(`📨 ${req.method} ${req.url}`)

    // ================================================================================================
    // VALIDATION TOKEN (Microsoft Graph validation)
    // ================================================================================================
    const url = new URL(req.url)
    const validationToken = url.searchParams.get('validationToken')
    
    if (validationToken) {
      console.log('🔐 Validation token reçu:', validationToken)
      return new Response(validationToken, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      })
    }

    // ================================================================================================
    // WEBHOOK NOTIFICATION PROCESSING
    // ================================================================================================
    if (req.method === 'POST') {
      const notification: WebhookNotification = await req.json()
      console.log('📬 Notification reçue:', {
        valueCount: notification.value?.length || 0,
        validationTokens: notification.validationTokens?.length || 0
      })

      // Traitement asynchrone pour répondre rapidement à Microsoft Graph
      processNotificationAsync(notification).catch((error: unknown) => {
        console.error('❌ Erreur traitement asynchrone:', error)
      })

      return createCorsResponse({ 
        status: 'accepted',
        message: 'Notification en cours de traitement',
        timestamp: new Date().toISOString()
      }, { status: 202 })
    }

    // ================================================================================================
    // HEALTH CHECK
    // ================================================================================================
    if (req.method === 'GET') {
      return createCorsResponse({
        status: 'healthy',
        service: 'webhook-handler',
        timestamp: new Date().toISOString(),
        version: '2.0.0-supabase'
      }, { status: 200 })
    }

    return createCorsResponse('Method not allowed', { status: 405 })

  } catch (error: unknown) {
    console.error('❌ Erreur dans webhook handler:', error)
    return createCorsResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
})

// ====================================================================================================
// TRAITEMENT ASYNCHRONE DES NOTIFICATIONS
// ====================================================================================================
async function processNotificationAsync(notification: WebhookNotification) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  let processed = 0
  let errors = 0

  console.log('⚙️ Début traitement asynchrone de', notification.value?.length || 0, 'notifications')

  for (const item of notification.value || []) {
    try {
      console.log('📋 Traitement notification:', {
        subscriptionId: item.subscriptionId,
        changeType: item.changeType,
        resource: item.resource
      })

      // ============================================================================================
      // VALIDATION CLIENT STATE
      // ============================================================================================
      if (item.clientState !== WEBHOOK_CLIENT_STATE) {
        console.error('⚠️ Client state invalide:', item.clientState)
        errors++
        continue
      }

      // ============================================================================================
      // LOG WEBHOOK EVENT
      // ============================================================================================
      const { error: logError } = await supabase
        .from('webhook_events')
        .insert({
          subscription_id: item.subscriptionId,
          change_type: item.changeType,
          resource_id: item.resourceData?.id,
          raw_notification: item,
          processed: false
        })

      if (logError) {
        console.error('❌ Erreur log webhook event:', logError)
      }

      // ============================================================================================
      // TRAITEMENT SELON TYPE DE CHANGEMENT
      // ============================================================================================
      if (item.changeType === 'created' && item.resourceData?.id) {
        // Pour déterminer si c'est un message envoyé ou reçu, nous devons d'abord
        // récupérer le message et examiner ses métadonnées
        await handleMessageWithAutoDetection(item.resourceData.id, item.subscriptionId)
        processed++
      } else {
        console.log('ℹ️ Type de changement ignoré:', item.changeType)
      }

    } catch (error: unknown) {
      console.error('❌ Erreur pour notification:', error)
      errors++
    }
  }

  console.log(`✅ Traitement terminé: ${processed} traités, ${errors} erreurs`)
}

// ====================================================================================================
// DÉTECTION AUTOMATIQUE ET TRAITEMENT DU MESSAGE
// ====================================================================================================
async function handleMessageWithAutoDetection(messageId: string, subscriptionId: string) {
  try {
    console.log('🔍 Récupération et analyse du message:', messageId)

    // Récupérer le message pour analyser ses métadonnées
    const graphMessage = await fetchMessageFromGraph(messageId)
    if (!graphMessage) {
      console.error('❌ Message non trouvé dans Graph:', messageId)
      return
    }

    // Récupérer l'email de l'utilisateur authentifié
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: tokenData } = await supabase
      .from('microsoft_tokens')
      .select('user_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Si nous avons l'info du user, on peut déterminer plus précisément
    // Pour l'instant, utilisons une heuristique simple basée sur le folder
    
    // Essayons de déterminer si c'est un message envoyé ou reçu
    // En vérifiant si le message est dans le dossier Sent Items
    const isSentMessage = await checkIfMessageInSentItems(messageId)
    
    if (isSentMessage) {
      console.log('📤 Message identifié comme ENVOYÉ')
      await handleNewSentMessage(messageId, subscriptionId)
    } else {
      console.log('📥 Message identifié comme REÇU')
      await handleNewMessage(messageId, subscriptionId)
    }

  } catch (error: unknown) {
    console.error('❌ Erreur détection automatique du message:', error)
    // En cas d'erreur, traiter comme message reçu par défaut
    console.log('⚠️ Traitement par défaut comme message reçu')
    await handleNewMessage(messageId, subscriptionId)
  }
}

// ====================================================================================================
// VÉRIFIER SI LE MESSAGE EST UN MESSAGE ENVOYÉ (MÉTHODE AMÉLIORÉE)
// ====================================================================================================
async function checkIfMessageInSentItems(messageId: string): Promise<boolean> {
  try {
    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      console.log('⚠️ Pas de token d\'accès disponible')
      return false
    }

    // Récupérer le message avec ses propriétés étendues incluant parentFolderId
    const messageResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,parentFolderId,sentDateTime,receivedDateTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!messageResponse.ok) {
      console.error('❌ Impossible de récupérer le message:', messageResponse.status)
      return false
    }

    const message = await messageResponse.json()
    console.log('📧 Message récupéré:', {
      subject: message.subject,
      from: message.from?.emailAddress?.address,
      parentFolderId: message.parentFolderId
    })

    // Récupérer l'ID du dossier Sent Items
    const sentFolderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems?$select=id`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!sentFolderResponse.ok) {
      console.error('❌ Impossible de récupérer l\'ID du dossier Sent Items')
      return false
    }

    const sentFolder = await sentFolderResponse.json()
    const sentFolderId = sentFolder.id

    // Comparer les IDs de dossier
    const isInSentFolder = message.parentFolderId === sentFolderId
    
    console.log('📁 Vérification dossier:', {
      messageFolderId: message.parentFolderId,
      sentFolderId: sentFolderId,
      isInSentFolder: isInSentFolder
    })

    return isInSentFolder

  } catch (error: unknown) {
    console.error('❌ Erreur vérification message envoyé:', error)
    return false
  }
}

// ====================================================================================================
// TRAITEMENT D'UN NOUVEAU MESSAGE REÇU
// ====================================================================================================
async function handleNewMessage(messageId: string, subscriptionId: string) {
  try {
    console.log('📧 Traitement nouveau message:', messageId)

    // ============================================================================================
    // RÉCUPÉRATION DU MESSAGE VIA MICROSOFT GRAPH
    // ============================================================================================
    const graphMessage = await fetchMessageFromGraph(messageId)
    if (!graphMessage) {
      console.error('❌ Message non trouvé dans Graph:', messageId)
      return
    }

    console.log('✅ Message récupéré:', {
      id: graphMessage.id,
      subject: graphMessage.subject?.substring(0, 50),
      conversationId: graphMessage.conversationId,
      from: graphMessage.from?.emailAddress?.address
    })

    // ============================================================================================
    // VALIDATION DES DONNÉES AVANT ENREGISTREMENT
    // ============================================================================================
    // Ne pas enregistrer les messages avec des données essentielles manquantes
    if (!graphMessage.subject || !graphMessage.from?.emailAddress?.address) {
      console.log('⚠️ Message incomplet, données manquantes:', {
        hasSubject: !!graphMessage.subject,
        hasFrom: !!graphMessage.from?.emailAddress?.address,
        hasTo: !!graphMessage.toRecipients?.[0]?.emailAddress?.address
      })
      // Ne pas enregistrer ce message mais marquer l'événement comme traité
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: 'Message incomplet - données essentielles manquantes'
        })
        .eq('subscription_id', subscriptionId)
        .eq('resource_id', messageId)
      return
    }

    // ============================================================================================
    // ENREGISTREMENT DU MESSAGE REÇU
    // ============================================================================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: messageData, error: messageError } = await supabase
      .rpc('log_received_message', {
        p_graph_message_id: graphMessage.id,
        p_internet_message_id: graphMessage.internetMessageId,
        p_conversation_id: graphMessage.conversationId,
        p_subject: graphMessage.subject,
        p_from_email: graphMessage.from?.emailAddress?.address,
        p_to_email: graphMessage.toRecipients?.[0]?.emailAddress?.address,
        p_body_preview: graphMessage.bodyPreview?.substring(0, 500),
        p_received_at: graphMessage.receivedDateTime ? new Date(graphMessage.receivedDateTime).toISOString() : null
      })

    if (messageError) {
      console.error('❌ Erreur enregistrement message:', messageError)
      return
    }

    console.log('✅ Message enregistré avec ID:', messageData)

    // ============================================================================================
    // MARQUER L'ÉVÉNEMENT WEBHOOK COMME TRAITÉ
    // ============================================================================================
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId)
      .eq('resource_id', messageId)

    console.log('✅ Événement webhook marqué comme traité')

    // Note: La détection des réponses se fait automatiquement via le trigger PostgreSQL
    // lors de l'insertion dans received_messages

  } catch (error: unknown) {
    console.error('❌ Erreur traitement nouveau message:', error)
    throw error
  }
}

// ====================================================================================================
// RÉCUPÉRATION D'UN MESSAGE VIA MICROSOFT GRAPH API
// ====================================================================================================
async function fetchMessageFromGraph(messageId: string): Promise<GraphMessage | null> {
  try {
    console.log('🔍 Récupération message Graph API:', messageId)

    // Obtenir le token d'accès
    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      throw new Error('Impossible d\'obtenir le token d\'accès')
    }

    // Récupérer le message (inbox par défaut)
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual'
      }
    })

    if (!response.ok) {
      console.error('❌ Erreur Graph API:', response.status, await response.text())
      return null
    }

    const message: GraphMessage = await response.json()
    return message

  } catch (error: unknown) {
    console.error('❌ Erreur récupération message Graph:', error)
    return null
  }
}

// ====================================================================================================
// OBTENIR UN TOKEN D'ACCÈS MICROSOFT GRAPH (User Token)
// ====================================================================================================
async function getGraphAccessToken(): Promise<string | null> {
  try {
    console.log('🔑 Récupération du token utilisateur depuis la base de données')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer le token utilisateur le plus récent
    const { data: tokenData, error: tokenError } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (tokenError || !tokenData) {
      console.error('❌ Aucun token utilisateur trouvé:', tokenError)
      return null
    }

    console.log('✅ Token utilisateur trouvé, vérification expiration')

    // Vérifier si le token est expiré
    if (isTokenExpired(tokenData.expires_at)) {
      console.log('⚠️ Token expiré, tentative de refresh')
      return await refreshUserToken(tokenData)
    }

    // Décrypter les tokens avec la même méthode que le frontend
    console.log('🔓 Déchiffrement du token d\'accès...')
    const serverSalt = `${tokenData.user_id}-encryption-salt-2024`
    const decryptedTokens = await decryptUserTokens({
      accessTokenEncrypted: tokenData.access_token_encrypted,
      refreshTokenEncrypted: tokenData.refresh_token_encrypted,
      nonce: tokenData.token_nonce,
      expiresAt: tokenData.expires_at,
      scope: tokenData.token_scope || ''
    }, tokenData.user_id, serverSalt)

    if (!decryptedTokens) {
      console.error('❌ Impossible de déchiffrer les tokens')
      return null
    }

    console.log('✅ Token d\'accès déchiffré avec succès')
    return decryptedTokens.accessToken

  } catch (error: unknown) {
    console.error('❌ Erreur récupération token utilisateur:', error)
    return null
  }
}

// ====================================================================================================
// REFRESH TOKEN UTILISATEUR
// ====================================================================================================
async function refreshUserToken(tokenData: MicrosoftTokenData): Promise<string | null> {
  try {
    console.log('🔄 Refresh du token utilisateur')

    // Décrypter le refresh token avec la même méthode que le frontend
    const serverSalt = `${tokenData.user_id}-encryption-salt-2024`
    const decryptedTokens = await decryptUserTokens({
      accessTokenEncrypted: tokenData.access_token_encrypted,
      refreshTokenEncrypted: tokenData.refresh_token_encrypted,
      nonce: tokenData.token_nonce,
      expiresAt: tokenData.expires_at,
      scope: tokenData.token_scope || ''
    }, tokenData.user_id, serverSalt)

    if (!decryptedTokens) {
      console.error('❌ Impossible de déchiffrer les tokens pour refresh')
      return null
    }

    const refreshToken = decryptedTokens.refreshToken

    const response = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'client_id': AZURE_CLIENT_ID,
        'client_secret': AZURE_CLIENT_SECRET,
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'scope': 'User.Read Mail.Read offline_access'
      })
    })

    if (!response.ok) {
      console.error('❌ Erreur refresh token:', response.status, await response.text())
      return null
    }

    const newTokenData = await response.json()
    
    // Chiffrer les nouveaux tokens
    const encryptedTokens = await encryptTokensForStorage(
      newTokenData.access_token,
      newTokenData.refresh_token || refreshToken,
      tokenData.user_id
    )

    if (!encryptedTokens) {
      console.error('❌ Impossible de chiffrer les nouveaux tokens')
      return null
    }
    
    // Mettre à jour le token en base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const expiresAt = getNewExpiresAt(newTokenData.expires_in)

    await supabase
      .from('microsoft_tokens')
      .update({
        access_token_encrypted: encryptedTokens.accessTokenEncrypted,
        refresh_token_encrypted: encryptedTokens.refreshTokenEncrypted,
        token_nonce: encryptedTokens.nonce,
        expires_at: expiresAt,
        token_scope: newTokenData.scope,
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenData.id)

    console.log('✅ Token rafraîchi et chiffré avec succès')
    return newTokenData.access_token

  } catch (error: unknown) {
    console.error('❌ Erreur refresh token:', error)
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
    
    const accessTokenEncrypted = new Uint8Array(base64ToArrayBufferWebhook(encryptedTokens.accessTokenEncrypted))
    const refreshTokenEncrypted = new Uint8Array(base64ToArrayBufferWebhook(encryptedTokens.refreshTokenEncrypted))
    const nonce = new Uint8Array(base64ToArrayBufferWebhook(encryptedTokens.nonce))
    
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
function base64ToArrayBufferWebhook(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Convertit un ArrayBuffer en string base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Vérifie si un token est expiré
 */
function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date()
}

/**
 * Calcule la nouvelle date d'expiration
 */
function getNewExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

/**
 * Chiffre les tokens pour le stockage sécurisé
 */
async function encryptTokensForStorage(
  accessToken: string,
  refreshToken: string,
  userId: string
): Promise<{ accessTokenEncrypted: string; refreshTokenEncrypted: string; nonce: string } | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Crypto API not available')
    }

    // Générer un salt déterministe basé sur l'ID utilisateur
    const serverSalt = `${userId}-encryption-salt-2024`
    const encryptionKeyBytes = await deriveEncryptionKey(userId, serverSalt)
    
    const encryptionKey = await crypto.subtle.importKey(
      'raw',
      encryptionKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )
    
    // Générer un nonce aléatoire pour ce chiffrement
    const nonce = crypto.getRandomValues(new Uint8Array(12))
    
    // Chiffrer les tokens
    const accessTokenBytes = new TextEncoder().encode(accessToken)
    const refreshTokenBytes = new TextEncoder().encode(refreshToken)
    
    const encryptedAccessToken = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      encryptionKey,
      accessTokenBytes
    )
    
    const encryptedRefreshToken = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      encryptionKey,
      refreshTokenBytes
    )
    
    return {
      accessTokenEncrypted: arrayBufferToBase64(encryptedAccessToken),
      refreshTokenEncrypted: arrayBufferToBase64(encryptedRefreshToken),
      nonce: arrayBufferToBase64(nonce.buffer)
    }
  } catch (error) {
    console.error('❌ Erreur lors du chiffrement des tokens:', error)
    return null
  }
}

// ====================================================================================================
// TRAITEMENT D'UN NOUVEAU MESSAGE ENVOYÉ
// ====================================================================================================
async function handleNewSentMessage(messageId: string, subscriptionId: string) {
  try {
    console.log('📤 Traitement nouveau message envoyé:', messageId)

    // ============================================================================================
    // RÉCUPÉRATION DU MESSAGE ENVOYÉ VIA MICROSOFT GRAPH
    // ============================================================================================
    const graphMessage = await fetchSentMessageFromGraph(messageId)
    if (!graphMessage) {
      console.error('❌ Message envoyé non trouvé dans Graph:', messageId)
      return
    }

    console.log('✅ Message envoyé récupéré:', {
      id: graphMessage.id,
      subject: graphMessage.subject?.substring(0, 50),
      conversationId: graphMessage.conversationId,
      to: graphMessage.toRecipients?.[0]?.emailAddress?.address
    })

    // ============================================================================================
    // VALIDATION DES DONNÉES AVANT ENREGISTREMENT
    // ============================================================================================
    // Ne pas enregistrer les messages envoyés avec des données essentielles manquantes
    if (!graphMessage.subject || !graphMessage.toRecipients?.[0]?.emailAddress?.address) {
      console.log('⚠️ Message envoyé incomplet, données manquantes:', {
        hasSubject: !!graphMessage.subject,
        hasFrom: !!graphMessage.from?.emailAddress?.address,
        hasTo: !!graphMessage.toRecipients?.[0]?.emailAddress?.address
      })
      // Ne pas enregistrer ce message mais marquer l'événement comme traité
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: 'Message envoyé incomplet - données essentielles manquantes'
        })
        .eq('subscription_id', subscriptionId)
        .eq('resource_id', messageId)
      return
    }

    // ============================================================================================
    // ENREGISTREMENT DU MESSAGE ENVOYÉ
    // ============================================================================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: messageData, error: messageError } = await supabase
      .rpc('log_sent_message', {
        p_graph_message_id: graphMessage.id,
        p_internet_message_id: graphMessage.internetMessageId,
        p_conversation_id: graphMessage.conversationId,
        p_subject: graphMessage.subject,
        p_from_email: graphMessage.from?.emailAddress?.address,
        p_to_email: graphMessage.toRecipients?.[0]?.emailAddress?.address,
        p_body_preview: graphMessage.bodyPreview?.substring(0, 500),
        p_sent_at: graphMessage.sentDateTime ? new Date(graphMessage.sentDateTime).toISOString() : null
      })

    if (messageError) {
      console.error('❌ Erreur enregistrement message envoyé:', messageError)
      return
    }

    console.log('✅ Message envoyé enregistré avec ID:', messageData)

    // ============================================================================================
    // MARQUER L'ÉVÉNEMENT WEBHOOK COMME TRAITÉ
    // ============================================================================================
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId)
      .eq('resource_id', messageId)

    console.log('✅ Événement webhook message envoyé marqué comme traité')

    // Note: L'auto-tracking se fait automatiquement via le trigger PostgreSQL
    // lors de l'insertion dans sent_messages

  } catch (error: unknown) {
    console.error('❌ Erreur traitement nouveau message envoyé:', error)
    throw error
  }
}

// ====================================================================================================
// RÉCUPÉRATION D'UN MESSAGE ENVOYÉ VIA MICROSOFT GRAPH API
// ====================================================================================================
async function fetchSentMessageFromGraph(messageId: string): Promise<GraphMessage | null> {
  try {
    console.log('🔍 Récupération message depuis les messages généraux:', messageId)

    // Obtenir le token d'accès
    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      throw new Error('Impossible d\'obtenir le token d\'accès')
    }

    // Récupérer le message depuis l'API générale (pas spécifiquement sent items)
    // Car le message pourrait ne pas être dans sent items même s'il est envoyé
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual'
      }
    })

    if (!response.ok) {
      console.error('❌ Erreur Graph API récupération message:', response.status, await response.text())
      return null
    }

    const message: GraphMessage = await response.json()
    return message

  } catch (error: unknown) {
    console.error('❌ Erreur récupération message Graph:', error)
    return null
  }
}

console.log('🚀 Webhook Handler v2.1 ready - Supabase Edge Function with Sent Items Support')