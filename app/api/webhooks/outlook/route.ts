import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/microsoft/webhook-service'
import { createClient } from '@supabase/supabase-js'
import { updateEmailTracking } from '@/lib/supabase/email-service'

// Créer un client Supabase avec la clé de service pour les opérations système
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/webhooks/outlook
 * Endpoint pour recevoir les notifications webhook de Microsoft Graph
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    
    // Microsoft Graph envoie un token de validation lors de la création de subscription
    const validationToken = request.nextUrl.searchParams.get('validationToken')
    
    if (validationToken) {
      console.log('🔐 Validation de l\'endpoint webhook avec token:', validationToken)
      // Répondre avec le token de validation en texte brut
      return new Response(validationToken, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    }

    // Traiter la notification webhook
    if (!contentType?.includes('application/json')) {
      console.error('❌ Content-Type invalide:', contentType)
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      )
    }

    const notification = await request.json()
    console.log('📬 Notification webhook reçue:', {
      valueCount: notification.value?.length || 0,
      firstSubscriptionId: notification.value?.[0]?.subscriptionId
    })

    // Traiter les notifications de manière asynchrone
    // On répond immédiatement à Microsoft Graph pour éviter les timeouts
    processNotificationAsync(notification).catch(error => {
      console.error('❌ Erreur lors du traitement asynchrone:', error)
    })

    // Répondre immédiatement avec un 202 Accepted
    return NextResponse.json(
      { message: 'Notification accepted for processing' },
      { status: 202 }
    )

  } catch (error) {
    console.error('❌ Erreur dans l\'endpoint webhook:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/outlook
 * Endpoint de test/santé pour vérifier que le webhook est accessible
 */
export async function GET(request: NextRequest) {
  // Si un token de validation est présent, le retourner
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  
  if (validationToken) {
    console.log('🔐 Validation GET avec token:', validationToken)
    return new Response(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    })
  }

  // Sinon, retourner le statut de santé
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhooks/outlook',
    timestamp: new Date().toISOString()
  })
}

/**
 * Traiter la notification de manière asynchrone
 */
async function processNotificationAsync(notification: any) {
  try {
    console.log('⚙️ Début du traitement asynchrone de la notification')
    
    // Valider et sauvegarder les événements
    const result = await webhookService.processNotification(notification)
    console.log('📊 Résultat du traitement:', result)

    // Traiter chaque événement pour mettre à jour les statuts d'emails
    for (const item of notification.value || []) {
      await processEmailStatusUpdate(item)
    }

  } catch (error) {
    console.error('❌ Erreur dans le traitement asynchrone:', error)
    
    // Logger l'erreur dans la base de données
    await supabase
      .from('webhook_events')
      .insert({
        event_type: 'processing_error',
        resource_data: { error: error instanceof Error ? error.message : 'Unknown error', notification },
        processed: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
  }
}

/**
 * Traiter une mise à jour de statut d'email basée sur un événement webhook
 */
async function processEmailStatusUpdate(event: any) {
  try {
    // Extraire les informations importantes
    const resourceData = event.resourceData
    if (!resourceData) return

    const conversationId = resourceData.conversationId
    const subject = resourceData.subject
    const changeType = event.changeType

    console.log('📧 Traitement de l\'événement email:', {
      changeType,
      conversationId,
      subject
    })

    // Si c'est un nouveau message (potentielle réponse)
    if (changeType === 'created' && conversationId) {
      // Rechercher les emails trackés avec cette conversation ID
      // Note: Nécessite d'ajouter conversation_id à email_tracking table
      
      // Pour l'instant, on peut chercher par subject similaire
      if (subject) {
        // Chercher des emails avec un subject similaire qui sont en PENDING
        const { data: trackedEmails } = await supabase
          .from('email_tracking')
          .select('*')
          .eq('status', 'PENDING')
          .ilike('subject', `%${subject.replace('RE: ', '').replace('Re: ', '')}%`)
          .limit(10)

        if (trackedEmails && trackedEmails.length > 0) {
          console.log(`🎯 ${trackedEmails.length} emails trackés trouvés pour mise à jour`)

          // Vérifier si c'est vraiment une réponse en analysant le contexte
          for (const email of trackedEmails) {
            // Si le nouveau message a le même subject (avec RE:) et arrive après l'envoi
            const isReply = subject.toLowerCase().includes('re:') && 
                          new Date(resourceData.receivedDateTime) > new Date(email.sent_at)

            if (isReply) {
              console.log(`✅ Mise à jour du statut de l'email ${email.id} vers REPLIED`)
              
              // Mettre à jour le statut vers REPLIED
              await updateEmailTracking(email.id, {
                status: 'REPLIED',
                reply_received_at: resourceData.receivedDateTime || new Date().toISOString()
              })

              // Logger l'action
              await supabase
                .from('webhook_processing_log')
                .insert({
                  event_id: event.id,
                  action: 'email_status_updated',
                  details: {
                    tracking_id: email.id,
                    old_status: 'PENDING',
                    new_status: 'REPLIED',
                    conversation_id: conversationId
                  },
                  success: true,
                  processing_time_ms: 100
                })
            }
          }
        }
      }
    }

    // Si c'est une mise à jour de message
    if (changeType === 'updated' && resourceData.isRead !== undefined) {
      console.log(`📖 Message marqué comme ${resourceData.isRead ? 'lu' : 'non lu'}`)
      
      // On pourrait tracker les lectures ici si nécessaire
      await supabase
        .from('webhook_processing_log')
        .insert({
          event_id: event.id,
          action: 'message_read_status',
          details: {
            message_id: resourceData.id,
            is_read: resourceData.isRead
          },
          success: true
        })
    }

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du statut:', error)
    
    // Logger l'erreur
    await supabase
      .from('webhook_processing_log')
      .insert({
        event_id: event.id,
        action: 'email_status_update_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
  }
}

/**
 * OPTIONS /api/webhooks/outlook
 * Gérer les requêtes CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}