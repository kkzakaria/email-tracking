import { NextRequest, NextResponse } from 'next/server'

// GET /api/auth/microsoft/test - Test Microsoft OAuth configuration
export async function GET(request: NextRequest) {
  const config = {
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? '✅ Set' : '❌ Missing',
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? '✅ Set' : '❌ Missing',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'Not set (using default)',
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/token`

  return NextResponse.json({
    message: 'Microsoft OAuth Configuration Test',
    config,
    computed: {
      redirectUri,
      tokenUrl,
      tenantId: process.env.AZURE_AD_TENANT_ID || 'common'
    },
    timestamp: new Date().toISOString()
  })
}