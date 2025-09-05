import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncAllPendingReplies } from '@/lib/services/reply-detection'

/**
 * POST /api/debug/force-reply-check
 * Forcer la vérification des réponses pour tous les emails PENDING
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    console.log('🔄 Vérification forcée des réponses pour utilisateur:', user.email)

    // Récupérer tous les emails PENDING récents
    const { data: pendingEmails, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 jours
      .order('sent_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des emails' },
        { status: 500 }
      )
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({
        message: 'Aucun email PENDING à vérifier',
        processed: 0,
        updated: 0
      })
    }

    console.log(`📊 ${pendingEmails.length} emails PENDING à vérifier`)

    // Lancer la synchronisation complète
    const result = await syncAllPendingReplies(7) // 7 jours max

    console.log(`✅ Vérification terminée: ${result.processed} traités, ${result.updated} mis à jour`)

    // Récupérer l'état après traitement
    const { data: updatedEmails } = await supabase
      .from('email_tracking')
      .select('id, recipient_email, subject, status, reply_received_at, reply_detection_method, sent_at')
      .eq('user_id', user.id)
      .in('id', pendingEmails.map(e => e.id))
      .order('sent_at', { ascending: false })

    return NextResponse.json({
      message: `Vérification terminée avec succès`,
      before: {
        totalChecked: pendingEmails.length,
        pendingCount: pendingEmails.filter(e => e.status === 'PENDING').length
      },
      after: {
        totalChecked: updatedEmails?.length || 0,
        pendingCount: updatedEmails?.filter(e => e.status === 'PENDING').length || 0,
        repliedCount: updatedEmails?.filter(e => e.status === 'REPLIED').length || 0
      },
      result: {
        processed: result.processed,
        updated: result.updated,
        errors: result.errors
      },
      emails: updatedEmails?.map(email => ({
        id: email.id,
        recipient: email.recipient_email,
        subject: email.subject,
        status: email.status,
        sentAt: email.sent_at,
        replyAt: email.reply_received_at,
        method: email.reply_detection_method
      })) || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erreur dans la vérification forcée:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur interne',
        details: 'Consultez les logs Vercel pour plus de détails'
      },
      { status: 500 }
    )
  }
}