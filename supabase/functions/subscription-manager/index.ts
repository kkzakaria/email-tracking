// ====================================================================================================
// SUPABASE EDGE FUNCTION: subscription-manager (Version Application Permissions v2.0)
// ====================================================================================================
// Description: Gère les subscriptions Microsoft Graph avec token d'application centralisé
// URL: https://[project-id].supabase.co/functions/v1/subscription-manager
// Version: 2.0 - Architecture simplifiée avec permissions application
// ====================================================================================================

/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createCorsResponse, handleCors } from '../_shared/cors.ts'
import { GraphSubscription, GraphSubscriptionResponse } from '../_shared/types.ts'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE')!

/**
 * Obtenir un token d'application via app-token-manager
 */
async function getApplicationToken(): Promise<string> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  if (!baseUrl) {
    throw new Error('SUPABASE_URL non configurée')
  }

  const tokenManagerUrl = `${baseUrl}/functions/v1/app-token-manager?action=get-token`

  const response = await fetch(tokenManagerUrl, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Erreur obtention token application:', error)
    throw new Error('Impossible d\'obtenir le token d\'application')
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Erreur token manager')
  }

  console.log('✅ Token d\'application obtenu via app-token-manager')
  return data.data.access_token
}

// ====================================================================================================
// GESTION DES SUBSCRIPTIONS
// ====================================================================================================

/**
 * Créer une subscription Microsoft Graph
 */
async function createGraphSubscription(
  accessToken: string,
  userEmail: string,
  webhookUrl: string
): Promise<GraphSubscriptionResponse | null> {
  try {
    console.log(`📝 Création subscription pour: ${userEmail}`)

    // Calculer l'expiration (maximum 4230 minutes = ~71h pour les mailboxes)
    const expirationDateTime = new Date(Date.now() + (4230 * 60 * 1000)).toISOString()

    const subscriptionData: GraphSubscription = {
      changeType: 'created',
      notificationUrl: webhookUrl,
      resource: `users/${userEmail}/messages`,
      expirationDateTime: expirationDateTime,
      clientState: WEBHOOK_CLIENT_STATE,
      latestSupportedTlsVersion: 'v1_2'
    }

    console.log('📡 Données subscription:', JSON.stringify(subscriptionData, null, 2))

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur création subscription Graph:', response.status, errorText)
      return null
    }

    const subscription: GraphSubscriptionResponse = await response.json()
    console.log('✅ Subscription créée:', subscription.id)

    return subscription

  } catch (error) {
    console.error('❌ Erreur createGraphSubscription:', error)
    return null
  }
}

/**
 * Renouveler une subscription Microsoft Graph
 */
async function renewGraphSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<boolean> {
  try {
    console.log(`🔄 Renouvellement subscription: ${subscriptionId}`)

    // Calculer nouvelle expiration
    const expirationDateTime = new Date(Date.now() + (4230 * 60 * 1000)).toISOString()

    const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expirationDateTime: expirationDateTime
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur renouvellement subscription:', response.status, errorText)
      return false
    }

    console.log('✅ Subscription renouvelée avec succès')
    return true

  } catch (error) {
    console.error('❌ Erreur renewGraphSubscription:', error)
    return false
  }
}

/**
 * Supprimer une subscription Microsoft Graph
 */
async function deleteGraphSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<boolean> {
  try {
    console.log(`🗑️ Suppression subscription: ${subscriptionId}`)

    const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      console.error('❌ Erreur suppression subscription:', response.status, errorText)
      return false
    }

    console.log('✅ Subscription supprimée avec succès')
    return true

  } catch (error) {
    console.error('❌ Erreur deleteGraphSubscription:', error)
    return false
  }
}

/**
 * Lister toutes les subscriptions
 */
async function listGraphSubscriptions(accessToken: string): Promise<GraphSubscriptionResponse[]> {
  try {
    console.log('📋 Liste des subscriptions Graph')

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur liste subscriptions:', response.status, errorText)
      return []
    }

    const data = await response.json()
    const subscriptions: GraphSubscriptionResponse[] = data.value || []

    console.log(`📊 ${subscriptions.length} subscription(s) trouvée(s)`)
    return subscriptions

  } catch (error) {
    console.error('❌ Erreur listGraphSubscriptions:', error)
    return []
  }
}

// ====================================================================================================
// HANDLERS ACTIONS
// ====================================================================================================

/**
 * Handler: Créer une subscription
 */
async function handleCreateSubscription(userEmail?: string): Promise<Response> {
  try {
    const email = userEmail || 'service-exploitation@karta-transit.ci'
    console.log(`📝 Création subscription pour: ${email}`)

    const accessToken = await getApplicationToken()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // URL du webhook
    const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook-handler`

    // Créer la subscription dans Microsoft Graph
    const graphSubscription = await createGraphSubscription(accessToken, email, webhookUrl)

    if (!graphSubscription) {
      return createCorsResponse({
        success: false,
        error: 'Impossible de créer la subscription Graph'
      }, { status: 500 })
    }

    // Sauvegarder dans Supabase
    const { error: insertError } = await supabase
      .from('graph_subscriptions')
      .insert({
        subscription_id: graphSubscription.id,
        user_email: email,
        resource: graphSubscription.resource,
        change_type: graphSubscription.changeType,
        notification_url: graphSubscription.notificationUrl,
        expires_at: graphSubscription.expirationDateTime,
        client_state: graphSubscription.clientState,
        status: 'active',
        user_id: null, // Plus de user_id avec l'architecture application
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('❌ Erreur sauvegarde subscription:', insertError)
      // Tenter de supprimer la subscription Graph créée
      await deleteGraphSubscription(accessToken, graphSubscription.id)
      return createCorsResponse({
        success: false,
        error: 'Erreur sauvegarde subscription'
      }, { status: 500 })
    }

    return createCorsResponse({
      success: true,
      subscription: {
        id: graphSubscription.id,
        userEmail: email,
        resource: graphSubscription.resource,
        expiresAt: graphSubscription.expirationDateTime
      }
    })

  } catch (error) {
    console.error('❌ Erreur handleCreateSubscription:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * Handler: Renouveler les subscriptions
 */
async function handleRenewSubscriptions(): Promise<Response> {
  try {
    console.log('🔄 Renouvellement des subscriptions')

    const accessToken = await getApplicationToken()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer les subscriptions à renouveler (expiration dans moins de 2h)
    const twoHoursFromNow = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString()

    const { data: subscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .eq('status', 'active')
      .lt('expires_at', twoHoursFromNow)

    if (error) {
      console.error('❌ Erreur récupération subscriptions:', error)
      return createCorsResponse({
        success: false,
        error: 'Erreur récupération subscriptions'
      }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('📭 Aucune subscription à renouveler')
      return createCorsResponse({
        success: true,
        message: 'Aucune subscription à renouveler',
        renewed: 0
      })
    }

    console.log(`🔄 ${subscriptions.length} subscription(s) à renouveler`)

    let renewedCount = 0
    let errorCount = 0

    // Renouveler chaque subscription
    for (const subscription of subscriptions) {
      const success = await renewGraphSubscription(accessToken, subscription.subscription_id)

      if (success) {
        // Mettre à jour l'expiration dans Supabase
        const newExpiration = new Date(Date.now() + (4230 * 60 * 1000)).toISOString()

        await supabase
          .from('graph_subscriptions')
          .update({
            expires_at: newExpiration,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        renewedCount++
      } else {
        // Marquer comme échouée
        await supabase
          .from('graph_subscriptions')
          .update({
            status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        errorCount++
      }
    }

    return createCorsResponse({
      success: true,
      renewed: renewedCount,
      errors: errorCount,
      total: subscriptions.length
    })

  } catch (error) {
    console.error('❌ Erreur handleRenewSubscriptions:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * Handler: Lister les subscriptions
 */
async function handleListSubscriptions(): Promise<Response> {
  try {
    console.log('📋 Liste des subscriptions')

    const accessToken = await getApplicationToken()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer depuis Supabase
    const { data: dbSubscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Erreur récupération subscriptions DB:', error)
      return createCorsResponse({
        success: false,
        error: 'Erreur récupération subscriptions'
      }, { status: 500 })
    }

    // Récupérer depuis Microsoft Graph
    const graphSubscriptions = await listGraphSubscriptions(accessToken)

    return createCorsResponse({
      success: true,
      database: dbSubscriptions || [],
      graph: graphSubscriptions,
      total: {
        database: dbSubscriptions?.length || 0,
        graph: graphSubscriptions.length
      }
    })

  } catch (error) {
    console.error('❌ Erreur handleListSubscriptions:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * Handler: Nettoyer les subscriptions
 */
async function handleCleanupSubscriptions(): Promise<Response> {
  try {
    console.log('🧹 Nettoyage des subscriptions')

    const accessToken = await getApplicationToken()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer les subscriptions expirées
    const now = new Date().toISOString()

    const { data: expiredSubscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .lt('expires_at', now)
      .neq('status', 'deleted')

    if (error) {
      console.error('❌ Erreur récupération subscriptions expirées:', error)
      return createCorsResponse({
        success: false,
        error: 'Erreur récupération subscriptions expirées'
      }, { status: 500 })
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      console.log('📭 Aucune subscription expirée à nettoyer')
      return createCorsResponse({
        success: true,
        message: 'Aucune subscription expirée',
        cleaned: 0
      })
    }

    console.log(`🧹 ${expiredSubscriptions.length} subscription(s) expirée(s) à nettoyer`)

    let cleanedCount = 0

    // Nettoyer chaque subscription expirée
    for (const subscription of expiredSubscriptions) {
      // Tenter de la supprimer de Graph (peut échouer si déjà supprimée)
      await deleteGraphSubscription(accessToken, subscription.subscription_id)

      // Marquer comme supprimée dans la DB
      await supabase
        .from('graph_subscriptions')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)

      cleanedCount++
    }

    return createCorsResponse({
      success: true,
      cleaned: cleanedCount,
      total: expiredSubscriptions.length
    })

  } catch (error) {
    console.error('❌ Erreur handleCleanupSubscriptions:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

// ====================================================================================================
// HANDLER PRINCIPAL
// ====================================================================================================

serve(async (req: Request): Promise<Response> => {
  // Gestion CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log(`📊 Subscription Manager: ${req.method} ${req.url}`)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    // Support du body pour les appels POST
    let bodyData: Record<string, unknown> = {}
    if (req.method === 'POST') {
      try {
        bodyData = await req.json()
      } catch {
        // Pas de body JSON
      }
    }

    switch (action) {
      case 'create':
        return await handleCreateSubscription(bodyData.userEmail as string)

      case 'renew':
        return await handleRenewSubscriptions()

      case 'list':
        return await handleListSubscriptions()

      case 'cleanup':
        return await handleCleanupSubscriptions()

      case 'status':
        return createCorsResponse({
          success: true,
          version: '2.0',
          architecture: 'application-permissions',
          timestamp: new Date().toISOString()
        })

      default:
        return createCorsResponse({
          success: false,
          error: `Action non supportée: ${action}`,
          availableActions: ['create', 'renew', 'list', 'cleanup', 'status']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Erreur Subscription Manager:', error)
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
})

console.log('🚀 Subscription Manager v2.0 ready - Application permissions architecture')