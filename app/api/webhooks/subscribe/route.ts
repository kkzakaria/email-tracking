import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/lib/microsoft/webhook-service'
import { createClient } from '@/utils/supabase/server'

/**
 * POST /api/webhooks/subscribe
 * Créer une nouvelle subscription webhook pour l'utilisateur connecté
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      resourceType = 'messages',
      changeTypes = ['created', 'updated'],
      expirationHours = 71 // Max ~3 jours
    } = body

    console.log('📝 Création de subscription pour:', user.email)

    // Créer la subscription
    const result = await webhookService.createSubscription({
      userId: user.id,
      resourceType,
      changeTypes,
      expirationHours
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Échec de la création de la subscription' },
        { status: 400 }
      )
    }

    console.log('✅ Subscription créée avec succès:', result.subscriptionId)

    return NextResponse.json({
      message: 'Subscription créée avec succès',
      subscriptionId: result.subscriptionId,
      expirationDateTime: result.expirationDateTime
    })

  } catch (error) {
    console.error('❌ Erreur lors de la création de la subscription:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/subscribe
 * Lister les subscriptions actives de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer les subscriptions depuis Microsoft Graph
    const graphSubscriptions = await webhookService.listSubscriptions()

    // Récupérer les subscriptions depuis la base de données
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: dbSubscriptions } = await serviceSupabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Combiner les informations
    const subscriptions = dbSubscriptions?.map(dbSub => {
      const graphSub = graphSubscriptions.find(gs => gs.id === dbSub.subscription_id)
      return {
        ...dbSub,
        graphStatus: graphSub ? 'active' : 'not_found',
        graphExpiration: graphSub?.expirationDateTime
      }
    }) || []

    return NextResponse.json({
      subscriptions,
      count: subscriptions.length
    })

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des subscriptions:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/webhooks/subscribe
 * Supprimer une subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { subscriptionId } = await request.json()

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId requis' },
        { status: 400 }
      )
    }

    // Vérifier que la subscription appartient à l'utilisateur
    const { createClient: createServiceClient2 } = await import('@supabase/supabase-js')
    const serviceSupabase2 = createServiceClient2(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: subscription } = await serviceSupabase2
      .from('webhook_subscriptions')
      .select('user_id')
      .eq('subscription_id', subscriptionId)
      .single()

    if (!subscription || subscription.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Subscription non trouvée ou non autorisée' },
        { status: 404 }
      )
    }

    // Supprimer la subscription
    const success = await webhookService.deleteSubscription(subscriptionId)

    if (!success) {
      return NextResponse.json(
        { error: 'Échec de la suppression de la subscription' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Subscription supprimée avec succès'
    })

  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la subscription:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}