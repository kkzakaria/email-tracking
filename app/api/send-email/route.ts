import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface EmailRequest {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  bodyType?: 'text' | 'html'
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Parser la requête
    const emailRequest: EmailRequest = await request.json()

    // Validation
    if (!emailRequest.to || emailRequest.to.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Au moins un destinataire est requis' },
        { status: 400 }
      )
    }

    if (!emailRequest.subject || !emailRequest.body) {
      return NextResponse.json(
        { success: false, error: 'Le sujet et le corps sont requis' },
        { status: 400 }
      )
    }

    // Appeler l'Edge Function email-sender
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const response = await fetch(`${supabaseUrl}/functions/v1/email-sender`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailRequest)
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erreur lors de l\'envoi' },
        { status: response.status }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Erreur API send-email:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  })
}