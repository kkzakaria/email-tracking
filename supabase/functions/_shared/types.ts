// ====================================================================================================
// TYPES PARTAGÉS - Edge Functions Supabase
// ====================================================================================================

// Types OAuth2 Microsoft
export interface OAuthTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface MicrosoftTokenData {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
}

export interface EncryptedTokenData {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  nonce: string
  expiresAt: string
  scope: string
}

// Type pour les requêtes multi-usage
export interface RequestBody {
  action?: string
  code?: string
  state?: string
  codeVerifier?: string
  refreshToken?: string
  accessTokenEncrypted?: string
  refreshTokenEncrypted?: string
  nonce?: string
  expiresAt?: string
  scope?: string
}

// Type pour l'utilisateur Supabase
export interface SupabaseUser {
  id: string
  email?: string
  [key: string]: unknown
}

// Types pour les réponses API
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthUrlResponse {
  authUrl: string
  state: string
  codeVerifier: string
  expiresIn: number
}

export interface TokenResponse {
  success: boolean
  tokens: MicrosoftTokenData
  message: string
}

export interface StatusResponse {
  authenticated: boolean
  microsoft: boolean
  user?: {
    id: string
    email?: string
  }
  tokens?: {
    expiresAt: string
    isExpired: boolean
    scope: string
    connectedAt: string
    lastRefreshed?: string
  }
  message: string
}