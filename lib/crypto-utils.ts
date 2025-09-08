// ====================================================================================================
// CRYPTO UTILITIES - Chiffrement E2E pour tokens Microsoft
// ====================================================================================================
// Description: Utilitaires de chiffrement PBKDF2 + Web Crypto API pour sécuriser les tokens OAuth
// Usage: Frontend (chiffrement) + Edge Functions (déchiffrement)
// ====================================================================================================

// Types pour les tokens chiffrés
export interface EncryptedTokens {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  nonce: string
  expiresAt: string
  scope: string
}

export interface MicrosoftTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
}

// ====================================================================================================
// FRONTEND - Chiffrement côté client
// ====================================================================================================

/**
 * Dérive une clé de chiffrement unique pour chaque utilisateur
 * Utilise PBKDF2 avec salt serveur pour la sécurité (Web Crypto API native)
 */
export async function deriveEncryptionKey(userId: string, serverSalt: string): Promise<ArrayBuffer> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  // Encoder les inputs
  const userIdBuffer = new TextEncoder().encode(userId)
  const saltBuffer = new TextEncoder().encode(serverSalt)

  // Importer la clé de base (userId)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    userIdBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  // Dériver la clé de chiffrement avec PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,  // 100k itérations pour la sécurité
      hash: 'SHA-256'
    },
    keyMaterial,
    256  // 256 bits = 32 bytes pour AES-256-GCM
  )

  return derivedBits
}

/**
 * Chiffre les tokens Microsoft avec AES-256-GCM
 */
export async function encryptTokens(
  tokens: MicrosoftTokens, 
  userId: string, 
  serverSalt: string
): Promise<EncryptedTokens> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  // Dériver la clé de chiffrement unique pour cet utilisateur
  const encryptionKeyBytes = await deriveEncryptionKey(userId, serverSalt)
  
  // Importer la clé pour AES-GCM
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    encryptionKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // Générer un nonce unique (IV) pour ce chiffrement
  const nonce = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes pour AES-GCM
  
  // Chiffrer les tokens
  const accessTokenBytes = new TextEncoder().encode(tokens.accessToken)
  const refreshTokenBytes = new TextEncoder().encode(tokens.refreshToken)
  
  const accessTokenEncrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    encryptionKey,
    accessTokenBytes
  )
  
  const refreshTokenEncrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    encryptionKey,
    refreshTokenBytes
  )
  
  // Encoder en base64 pour le stockage
  return {
    accessTokenEncrypted: arrayBufferToBase64(accessTokenEncrypted),
    refreshTokenEncrypted: arrayBufferToBase64(refreshTokenEncrypted),
    nonce: arrayBufferToBase64(nonce.buffer),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope
  }
}

/**
 * Déchiffre les tokens depuis le stockage sécurisé
 * Utilisé principalement côté serveur (Edge Functions)
 */
export async function decryptTokens(
  encryptedTokens: EncryptedTokens,
  userId: string,
  serverSalt: string
): Promise<MicrosoftTokens> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }

  // Dériver la même clé de chiffrement
  const encryptionKeyBytes = await deriveEncryptionKey(userId, serverSalt)
  
  // Importer la clé pour déchiffrement
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    encryptionKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // Décoder depuis base64
  const accessTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.accessTokenEncrypted))
  const refreshTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.refreshTokenEncrypted))
  const nonce = new Uint8Array(base64ToArrayBuffer(encryptedTokens.nonce))
  
  try {
    // Déchiffrer les tokens
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
    
    // Décoder en string
    const accessToken = new TextDecoder().decode(accessTokenBytes)
    const refreshToken = new TextDecoder().decode(refreshTokenBytes)
    
    return {
      accessToken,
      refreshToken,
      expiresAt: encryptedTokens.expiresAt,
      scope: encryptedTokens.scope
    }
  } catch (error) {
    throw new TokenDecryptionError('Impossible de déchiffrer les tokens - clé invalide ou données corrompues', error instanceof Error ? error : undefined)
  }
}

// ====================================================================================================
// UTILITAIRES DE CONVERSION
// ====================================================================================================

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

// ====================================================================================================
// UTILITAIRES DE VALIDATION
// ====================================================================================================

/**
 * Vérifie si les tokens sont expirés
 */
export function areTokensExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}

/**
 * Calcule le temps restant avant expiration en secondes
 */
export function getTimeToExpiry(expiresAt: string): number {
  const expiryTime = new Date(expiresAt).getTime()
  const currentTime = new Date().getTime()
  return Math.max(0, Math.floor((expiryTime - currentTime) / 1000))
}

/**
 * Vérifie si un renouvellement est recommandé (moins de 10 minutes restantes)
 */
export function shouldRefreshTokens(expiresAt: string): boolean {
  const timeToExpiry = getTimeToExpiry(expiresAt)
  return timeToExpiry < 600 // 10 minutes en secondes
}

// ====================================================================================================
// GESTION D'ERREURS CRYPTO
// ====================================================================================================

export class CryptoError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'CryptoError'
  }
}

export class TokenDecryptionError extends CryptoError {
  constructor(message: string = 'Impossible de déchiffrer les tokens', cause?: Error) {
    super(message, cause)
    this.name = 'TokenDecryptionError'
  }
}

export class KeyDerivationError extends CryptoError {
  constructor(message: string = 'Erreur dérivation de clé', cause?: Error) {
    super(message, cause)
    this.name = 'KeyDerivationError'
  }
}