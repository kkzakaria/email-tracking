import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// 1x1 transparent pixel in base64
const PIXEL_DATA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// GET /api/emails/pixel/[id] - Email tracking pixel endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      // Return pixel even if ID is invalid to avoid breaking email rendering
      return new NextResponse(PIXEL_DATA, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': PIXEL_DATA.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Create Supabase client without user authentication
    // (pixel requests don't have user session)
    const supabase = await createClient()

    try {
      // Find email tracking record by ID
      const { data: emailTracking, error } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && emailTracking && emailTracking.status === 'PENDING') {
        // Mark email as opened (replied status indicates interaction)
        await supabase
          .from('email_tracking')
          .update({
            status: 'REPLIED',
            reply_received_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        // Log the tracking event (optional - for analytics)
        console.log(`Email tracking pixel loaded for ID: ${id}`, {
          recipient: emailTracking.recipient_email,
          subject: emailTracking.subject,
          timestamp: new Date().toISOString()
        })
      }
    } catch (dbError) {
      // Log error but still return pixel to avoid breaking email
      console.error('Database error in pixel tracking:', dbError)
    }

    // Always return the tracking pixel
    return new NextResponse(PIXEL_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': PIXEL_DATA.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    // Log error but still return pixel to avoid breaking email
    console.error('Error in pixel tracking endpoint:', error)
    
    return new NextResponse(PIXEL_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': PIXEL_DATA.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}