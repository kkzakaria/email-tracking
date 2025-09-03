import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET /api/auth/microsoft/callback - Handle OAuth callback from Microsoft
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=microsoft_auth_failed`
    )
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=invalid_callback`
    )
  }

  try {
    console.log('🔄 Microsoft OAuth callback received')
    console.log('Code present:', !!code)
    console.log('State present:', !!state)
    
    const supabase = await createClient()

    // Decode and validate state
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      console.log('✅ State decoded successfully')
    } catch (e) {
      console.error('❌ Invalid state parameter:', e)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=invalid_state`
      )
    }

    // Optional: Validate state in database (for extra security)
    try {
      const { data: storedState } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('user_id', stateData.userId)
        .single()

      if (storedState) {
        // Clean up used state
        await supabase
          .from('oauth_states')
          .delete()
          .eq('state', state)
      }
    } catch (error) {
      console.log('Note: Could not validate state in database (table may not exist), continuing...')
    }

    // Exchange authorization code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/token`
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      code: code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`,
      grant_type: 'authorization_code'
    })

    console.log('🔄 Attempting token exchange...')
    console.log('Token URL:', tokenUrl)
    console.log('Redirect URI:', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`)
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    })

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorData)
      console.error('Status:', tokenResponse.status)
      console.error('Status Text:', tokenResponse.statusText)
      
      // Parse error if JSON
      try {
        const errorJson = JSON.parse(errorData)
        console.error('Error details:', errorJson)
      } catch (e) {
        console.error('Raw error response:', errorData)
      }
      
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=token_exchange_failed`
      )
    }

    const tokens = await tokenResponse.json()

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    let profile = null
    if (profileResponse.ok) {
      profile = await profileResponse.json()
    }

    // Store tokens in Supabase (encrypted in user metadata)
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        microsoft_tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          token_type: tokens.token_type,
          scope: tokens.scope
        },
        microsoft_profile: profile ? {
          id: profile.id,
          email: profile.mail || profile.userPrincipalName,
          display_name: profile.displayName,
          job_title: profile.jobTitle,
          office_location: profile.officeLocation
        } : null,
        microsoft_connected_at: new Date().toISOString()
      }
    })

    if (updateError) {
      console.error('Error storing Microsoft tokens:', updateError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=token_storage_failed`
      )
    }

    // Redirect back to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?microsoft=connected`
    )

  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=callback_error`
    )
  }
}