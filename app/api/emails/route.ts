import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getEmailTrackings, createEmailTracking } from '@/lib/supabase/email-service'

// GET /api/emails - List user's email tracking records
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get email trackings
    const emails = await getEmailTrackings()
    
    return NextResponse.json({
      success: true,
      data: emails,
      count: emails.length
    })
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}

// POST /api/emails - Create new email tracking
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { recipient_email, subject, message_id, expires_at } = body

    // Validate required fields
    if (!recipient_email || !subject || !message_id) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient_email, subject, message_id' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipient_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Create email tracking
    const emailTracking = await createEmailTracking({
      recipient_email,
      subject,
      message_id,
      expires_at
    })

    return NextResponse.json({
      success: true,
      data: emailTracking
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating email tracking:', error)
    return NextResponse.json(
      { error: 'Failed to create email tracking' },
      { status: 500 }
    )
  }
}