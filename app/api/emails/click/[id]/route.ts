import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET /api/emails/click/[id] - Endpoint de tracking des clics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')
    
    // Validation de l'ID de tracking
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'ID de tracking invalide' },
        { status: 400 }
      )
    }
    
    // Validation de l'URL cible
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL cible manquante' },
        { status: 400 }
      )
    }
    
    let decodedUrl: string
    try {
      decodedUrl = decodeURIComponent(targetUrl)
      // Validation basique de l'URL
      new URL(decodedUrl)
    } catch (error) {
      return NextResponse.json(
        { error: 'URL cible invalide' },
        { status: 400 }
      )
    }
    
    // Créer un client Supabase (sans authentification utilisateur)
    const supabase = await createClient()
    
    try {
      // Vérifier que l'email tracking existe
      const { data: emailTracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('id', id)
        .single()
      
      if (trackingError || !emailTracking) {
        console.log(`⚠️ Email tracking non trouvé pour ID: ${id}`)
        // Rediriger quand même vers l'URL cible
        return NextResponse.redirect(decodedUrl, 302)
      }
      
      // Collecter des métadonnées sur le clic
      const userAgent = request.headers.get('user-agent') || ''
      const referer = request.headers.get('referer') || ''
      const forwardedFor = request.headers.get('x-forwarded-for')
      const realIp = request.headers.get('x-real-ip')
      const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown'
      
      // Enregistrer l'événement de clic dans email_events
      await supabase
        .from('email_events')
        .insert({
          email_tracking_id: id,
          event_type: 'CLICK',
          target_url: decodedUrl,
          client_ip: clientIp,
          user_agent: userAgent,
          referer: referer,
          created_at: new Date().toISOString()
        })
      
      // Logger le clic
      console.log('🔗 Clic tracké:', {
        trackingId: id,
        recipient: emailTracking.recipient_email,
        subject: emailTracking.subject,
        targetUrl: decodedUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent,
          referer,
          clientIp
        }
      })
      
      // Mettre à jour le statut de l'email si nécessaire
      if (emailTracking.status === 'PENDING') {
        await supabase
          .from('email_tracking')
          .update({
            status: 'REPLIED', // Indique qu'il y a eu interaction
            reply_received_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
        
        console.log(`✅ Statut mis à jour pour l'email tracking: ${id}`)
      }
      
    } catch (dbError) {
      console.error('❌ Erreur base de données lors du tracking de clic:', dbError)
      // Continuer la redirection même en cas d'erreur
    }
    
    // Redirection vers l'URL cible
    return NextResponse.redirect(decodedUrl, 302)
    
  } catch (error) {
    console.error('❌ Erreur dans l\'endpoint de tracking de clic:', error)
    
    // En cas d'erreur, essayer de rediriger vers l'URL cible quand même
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')
    
    if (targetUrl) {
      try {
        const decodedUrl = decodeURIComponent(targetUrl)
        return NextResponse.redirect(decodedUrl, 302)
      } catch (e) {
        // Si impossible de décoder l'URL, retourner une erreur
        return NextResponse.json(
          { error: 'Erreur de redirection' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}