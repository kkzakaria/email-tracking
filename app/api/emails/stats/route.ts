import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { emailService } from '@/lib/supabase/email-service'

// GET /api/emails/stats - Get email tracking statistics
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

    // Get email statistics
    const stats = await emailService.getEmailStats()
    
    // Calculate additional metrics
    const totalEmails = Object.values(stats).reduce((a, b) => a + b, 0)
    const responseRate = totalEmails > 0 ? (stats.REPLIED / totalEmails * 100).toFixed(1) : '0.0'
    const pendingRate = totalEmails > 0 ? (stats.PENDING / totalEmails * 100).toFixed(1) : '0.0'

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        total: totalEmails,
        response_rate: parseFloat(responseRate),
        pending_rate: parseFloat(pendingRate)
      }
    })
  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email statistics' },
      { status: 500 }
    )
  }
}