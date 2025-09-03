import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { emailService } from '@/lib/supabase/email-service'

// GET /api/emails/[id] - Get specific email tracking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Get email tracking
    const emailTracking = await emailService.getEmailTrackingById(id)
    
    if (!emailTracking) {
      return NextResponse.json(
        { error: 'Email tracking not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: emailTracking
    })
  } catch (error) {
    console.error('Error fetching email tracking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email tracking' },
      { status: 500 }
    )
  }
}

// PATCH /api/emails/[id] - Update email tracking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { status, reply_received_at, stopped_at } = body

    // Validate status if provided
    const validStatuses = ['PENDING', 'REPLIED', 'STOPPED', 'EXPIRED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    if (status) updateData.status = status
    if (reply_received_at) updateData.reply_received_at = reply_received_at
    if (stopped_at) updateData.stopped_at = stopped_at

    // Set automatic timestamps based on status
    if (status === 'REPLIED' && !reply_received_at) {
      updateData.reply_received_at = new Date().toISOString()
    }
    if (status === 'STOPPED' && !stopped_at) {
      updateData.stopped_at = new Date().toISOString()
    }

    // Update email tracking
    const updatedEmailTracking = await emailService.updateEmailTracking(id, updateData)

    return NextResponse.json({
      success: true,
      data: updatedEmailTracking
    })
  } catch (error) {
    console.error('Error updating email tracking:', error)
    return NextResponse.json(
      { error: 'Failed to update email tracking' },
      { status: 500 }
    )
  }
}

// DELETE /api/emails/[id] - Delete email tracking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Delete email tracking
    await emailService.deleteEmailTracking(id)

    return NextResponse.json({
      success: true,
      message: 'Email tracking deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting email tracking:', error)
    return NextResponse.json(
      { error: 'Failed to delete email tracking' },
      { status: 500 }
    )
  }
}