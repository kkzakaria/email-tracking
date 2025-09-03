import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET /api/auth/microsoft - Initiate Microsoft OAuth flow
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to connect Microsoft account' },
        { status: 401 }
      )
    }

    // Microsoft OAuth endpoints
    const tenantId = process.env.AZURE_AD_TENANT_ID || 'common'
    const clientId = process.env.AZURE_AD_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`
    
    if (!clientId) {
      console.error('Missing AZURE_AD_CLIENT_ID environment variable')
      return NextResponse.json(
        { error: 'Microsoft authentication not configured' },
        { status: 500 }
      )
    }

    // Generate state parameter for CSRF protection
    // Store user ID in state to retrieve it in callback
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7)
    })).toString('base64')

    // Store state in database for validation (optional - continue if table doesn't exist)
    try {
      const { error: stateError } = await supabase
        .from('oauth_states')
        .insert({
          state,
          user_id: user.id,
          provider: 'microsoft',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        })

      if (stateError) {
        console.log('Note: Could not store OAuth state (table may not exist):', stateError.message)
      }
    } catch (error) {
      console.log('Note: oauth_states table not available, continuing without state storage')
    }

    // Scopes required for email tracking
    const scopes = [
      'User.Read',           // Basic profile
      'Mail.Read',          // Read emails
      'Mail.Send',          // Send emails
      'Mail.ReadWrite',     // Manage emails
      'offline_access'      // Refresh token
    ].join(' ')

    // Build authorization URL
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('response_mode', 'query')
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('prompt', 'consent') // Force consent to get refresh token

    // Redirect to Microsoft login
    return NextResponse.redirect(authUrl.toString())
    
  } catch (error) {
    console.error('Error initiating Microsoft OAuth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft authentication' },
      { status: 500 }
    )
  }
}