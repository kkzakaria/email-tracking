// ====================================================================================================
// EMAIL HISTORY SYNC - Utilitaire de récupération des emails des 7 derniers jours
// ====================================================================================================
// Edge Function pour synchroniser les emails via Microsoft Graph API
// Récupère les emails des 7 derniers jours et met à jour le tracking automatiquement
// Utilise le système de tokens chiffrés E2E
// ====================================================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Types Supabase User
interface SupabaseUser {
  id: string
  email?: string
  [key: string]: unknown
}

// Types pour tokens chiffrés
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

interface GraphMessage {
  id: string
  internetMessageId?: string
  conversationId?: string
  subject?: string
  from?: {
    emailAddress: {
      address: string
      name?: string
    }
  }
  toRecipients?: Array<{
    emailAddress: {
      address: string
      name?: string
    }
  }>
  receivedDateTime?: string
  sentDateTime?: string
  bodyPreview?: string
  isDraft?: boolean
  isRead?: boolean
}

interface GraphResponse {
  value: GraphMessage[]
  '@odata.nextLink'?: string
}

interface SyncResult {
  sentEmails: number
  receivedEmails: number
  trackedEmails: number
  repliesDetected: number
  errors: string[]
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Vérifier l'authentification utilisateur
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header manquant. Veuillez vous authentifier.')
    }

    // Récupérer l'utilisateur Supabase
    const user = await getSupabaseUser(authHeader, supabaseClient)
    if (!user) {
      throw new Error('Utilisateur non authentifié. Token Supabase invalide.')
    }

    console.log(`🔐 Email history sync pour user: ${user.id}`)

    // Récupérer le token Microsoft déchiffré de l'utilisateur
    const accessToken = await getUserMicrosoftToken(user.id, supabaseClient)
    if (!accessToken) {
      throw new Error('Token Microsoft Graph manquant ou expiré. Veuillez vous reconnecter à Microsoft dans les paramètres.')
    }

    console.log('✅ Token Microsoft récupéré et déchiffré avec succès')

    // Calculate date range (7 days ago)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dateFilter = sevenDaysAgo.toISOString()

    console.log(`Starting email sync for emails since ${dateFilter}`)

    const result: SyncResult = {
      sentEmails: 0,
      receivedEmails: 0,
      trackedEmails: 0,
      repliesDetected: 0,
      errors: []
    }

    // ====================================================================================================
    // 1. Récupérer les emails ENVOYÉS des 7 derniers jours
    // ====================================================================================================
    try {
      console.log('Fetching sent emails from Microsoft Graph...')
      const sentEmailsUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$filter=sentDateTime ge ${dateFilter}&$select=id,internetMessageId,conversationId,subject,from,toRecipients,sentDateTime,bodyPreview&$top=999`
      
      const sentResponse = await fetch(sentEmailsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!sentResponse.ok) {
        throw new Error(`Microsoft Graph API error for sent emails: ${sentResponse.status} ${sentResponse.statusText}`)
      }

      const sentData: GraphResponse = await sentResponse.json()
      console.log(`Found ${sentData.value.length} sent emails`)

      // Traiter chaque email envoyé
      for (const message of sentData.value) {
        if (message.isDraft) continue // Ignorer les brouillons

        const toEmail = message.toRecipients?.[0]?.emailAddress?.address
        const fromEmail = message.from?.emailAddress?.address

        if (toEmail && fromEmail) {
          // Utiliser la fonction log_sent_message qui déclenche l'auto-tracking
          const { error } = await supabaseClient.rpc('log_sent_message', {
            p_graph_message_id: message.id,
            p_internet_message_id: message.internetMessageId || null,
            p_conversation_id: message.conversationId || null,
            p_subject: message.subject || null,
            p_from_email: fromEmail,
            p_to_email: toEmail,
            p_body_preview: message.bodyPreview || null,
            p_sent_at: message.sentDateTime || null
          })

          if (error) {
            console.error(`Error logging sent message ${message.id}:`, error)
            result.errors.push(`Sent email ${message.id}: ${error.message}`)
          } else {
            result.sentEmails++
            console.log(`Logged sent email: ${message.subject} to ${toEmail}`)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sent emails:', error)
      result.errors.push(`Sent emails fetch: ${error.message}`)
    }

    // ====================================================================================================
    // 2. Récupérer les emails REÇUS des 7 derniers jours
    // ====================================================================================================
    try {
      console.log('Fetching received emails from Microsoft Graph...')
      const receivedEmailsUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=receivedDateTime ge ${dateFilter}&$select=id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview&$top=999`
      
      const receivedResponse = await fetch(receivedEmailsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!receivedResponse.ok) {
        throw new Error(`Microsoft Graph API error for received emails: ${receivedResponse.status} ${receivedResponse.statusText}`)
      }

      const receivedData: GraphResponse = await receivedResponse.json()
      console.log(`Found ${receivedData.value.length} received emails`)

      // Traiter chaque email reçu
      for (const message of receivedData.value) {
        const fromEmail = message.from?.emailAddress?.address
        const toEmail = message.toRecipients?.[0]?.emailAddress?.address

        if (fromEmail) {
          // Utiliser la fonction log_received_message qui déclenche la détection automatique des réponses
          const { error } = await supabaseClient.rpc('log_received_message', {
            p_graph_message_id: message.id,
            p_internet_message_id: message.internetMessageId || null,
            p_conversation_id: message.conversationId || null,
            p_subject: message.subject || null,
            p_from_email: fromEmail,
            p_to_email: toEmail || null,
            p_body_preview: message.bodyPreview || null,
            p_received_at: message.receivedDateTime || null
          })

          if (error) {
            console.error(`Error logging received message ${message.id}:`, error)
            result.errors.push(`Received email ${message.id}: ${error.message}`)
          } else {
            result.receivedEmails++
            console.log(`Logged received email: ${message.subject} from ${fromEmail}`)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching received emails:', error)
      result.errors.push(`Received emails fetch: ${error.message}`)
    }

    // ====================================================================================================
    // 3. Obtenir les statistiques après synchronisation
    // ====================================================================================================
    try {
      // Compter les emails trackés créés dans les dernières heures
      const { data: recentTracked } = await supabaseClient
        .from('tracked_emails')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // 2 dernières heures

      result.trackedEmails = recentTracked || 0

      // Compter les réponses détectées récemment
      const { data: recentReplies } = await supabaseClient
        .from('tracked_emails')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'REPLIED')
        .gte('reply_received_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // 2 dernières heures

      result.repliesDetected = recentReplies || 0

    } catch (error) {
      console.error('Error getting stats:', error)
      result.errors.push(`Stats calculation: ${error.message}`)
    }

    console.log('Email history sync completed:', result)

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      result
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Email history sync failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
})

// ====================================================================================================
// UTILITAIRES - Gestion des utilisateurs et tokens chiffrés
// ====================================================================================================

/**
 * Récupère l'utilisateur Supabase depuis le token d'autorisation
 */
async function getSupabaseUser(authHeader: string, supabaseClient: ReturnType<typeof createClient>): Promise<SupabaseUser | null> {
  try {
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)
    
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

/**
 * Récupère le token Microsoft d'un utilisateur (déchiffré et vérifié)
 * Utilise le même système de chiffrement que microsoft-auth et subscription-manager
 */
async function getUserMicrosoftToken(userId: string, supabaseClient: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    // Récupérer les tokens chiffrés de l'utilisateur
    const { data: tokenData, error } = await supabaseClient
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
      return null
    }

    console.log(`✅ Token Microsoft valide pour user ${userId}`)
    
    // Décrypter les tokens avec la même méthode que les autres Edge Functions
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

// ====================================================================================================
// FONCTIONS DE CHIFFREMENT COMPATIBLES AVEC LE FRONTEND
// ====================================================================================================

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

/**
 * Vérifie si un token est expiré
 */
function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date()
}

// ====================================================================================================
// USAGE:
// 
// POST /functions/v1/email-history-sync
// Headers: Authorization: Bearer <supabase-user-token>
// 
// Response:
// {
//   "success": true,
//   "timestamp": "2025-01-09T10:30:00.000Z",
//   "result": {
//     "sentEmails": 15,
//     "receivedEmails": 23,
//     "trackedEmails": 15,
//     "repliesDetected": 8,
//     "errors": []
//   }
// }
// ====================================================================================================

console.log('🚀 Email History Sync v2.0 ready - E2E Encrypted Tokens')