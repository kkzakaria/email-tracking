import { Client } from '@microsoft/microsoft-graph-client'
import { createClient } from '@/utils/supabase/server'

/**
 * Helper to refresh Microsoft access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<any> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/token`
  
  const tokenParams = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'User.Read Mail.Read Mail.Send Mail.ReadWrite offline_access'
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

/**
 * Get or refresh Microsoft access token for current user
 */
export async function getMicrosoftToken(): Promise<string | null> {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    console.error('No authenticated user')
    return null
  }

  const microsoftTokens = user.user_metadata?.microsoft_tokens
  
  if (!microsoftTokens) {
    console.error('No Microsoft tokens found for user')
    return null
  }

  // Check if token is expired
  if (microsoftTokens.expires_at && Date.now() > microsoftTokens.expires_at) {
    console.log('Access token expired, refreshing...')
    
    try {
      // Refresh the token
      const newTokens = await refreshAccessToken(microsoftTokens.refresh_token)
      
      // Update stored tokens
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          microsoft_tokens: {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || microsoftTokens.refresh_token,
            expires_at: Date.now() + (newTokens.expires_in * 1000),
            token_type: newTokens.token_type,
            scope: newTokens.scope
          }
        }
      })
      
      if (updateError) {
        console.error('Error updating refreshed tokens:', updateError)
      }
      
      return newTokens.access_token
    } catch (error) {
      console.error('Error refreshing token:', error)
      return null
    }
  }

  return microsoftTokens.access_token
}

/**
 * Create Microsoft Graph client with current user's token
 */
export async function createGraphClient(): Promise<Client | null> {
  const accessToken = await getMicrosoftToken()
  
  if (!accessToken) {
    return null
  }

  try {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })

    return client
  } catch (error) {
    console.error('Error creating Graph client:', error)
    return null
  }
}

/**
 * Check if user has connected Microsoft account
 */
export async function isMicrosoftConnected(): Promise<boolean> {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return false
  }

  return !!user.user_metadata?.microsoft_tokens
}