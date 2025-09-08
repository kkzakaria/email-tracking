// ====================================================================================================
// SUPABASE EDGE FUNCTION: subscription-manager
// ====================================================================================================
// Description: Gère les subscriptions Microsoft Graph (création, renouvellement, monitoring)
// URL: https://[project-id].supabase.co/functions/v1/subscription-manager
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types Microsoft Graph
interface GraphSubscription {
  id?: string
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  latestSupportedTlsVersion?: string
}

interface GraphSubscriptionResponse {
  id: string
  resource: string
  changeType: string
  notificationUrl: string
  expirationDateTime: string
  clientState: string
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_CLIENT_STATE = Deno.env.get('WEBHOOK_CLIENT_STATE') || 'supabase-webhook-secret'
const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID')!
const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET')!
const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID')!

// URL de base pour les webhooks
const WEBHOOK_BASE_URL = `${SUPABASE_URL}/functions/v1/webhook-handler`

console.log('🔧 Subscription Manager initialized')

serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'renew'
    
    console.log(`📨 ${req.method} ${req.url}`)
    console.log('🎯 Action demandée:', action)

    // ================================================================================================
    // ACTIONS DISPONIBLES
    // ================================================================================================
    switch (action) {
      case 'create':
        return await handleCreateSubscription(req)
      
      case 'renew':
        return await handleRenewSubscriptions(req)
      
      case 'status':
        return await handleGetStatus(req)
      
      case 'cleanup':
        return await handleCleanupSubscriptions(req)
      
      default:
        return new Response(JSON.stringify({
          error: 'Action non supportée',
          availableActions: ['create', 'renew', 'status', 'cleanup']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

  } catch (error: unknown) {
    console.error('❌ Erreur dans subscription manager:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// ====================================================================================================
// CRÉER UNE NOUVELLE SUBSCRIPTION
// ====================================================================================================
async function handleCreateSubscription(_req: Request): Promise<Response> {
  try {
    console.log('🆕 Création nouvelle subscription')

    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      throw new Error('Token d\'accès indisponible')
    }

    // Calculer la date d'expiration (max 3 jours pour les messages)
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 71) // ~3 jours

    const subscription: GraphSubscription = {
      changeType: 'created',
      notificationUrl: WEBHOOK_BASE_URL,
      resource: '/me/messages',
      expirationDateTime: expirationDate.toISOString(),
      clientState: WEBHOOK_CLIENT_STATE,
      latestSupportedTlsVersion: 'v1_2'
    }

    console.log('📤 Envoi subscription à Microsoft Graph:', {
      resource: subscription.resource,
      notificationUrl: subscription.notificationUrl,
      expirationDateTime: subscription.expirationDateTime
    })

    // Créer la subscription via Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur création subscription Graph:', response.status, errorText)
      throw new Error(`Graph API error: ${response.status} - ${errorText}`)
    }

    const graphSubscription: GraphSubscriptionResponse = await response.json()
    console.log('✅ Subscription créée:', graphSubscription.id)

    // Sauvegarder en base de données
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { error: dbError } = await supabase
      .from('graph_subscriptions')
      .insert({
        subscription_id: graphSubscription.id,
        resource: graphSubscription.resource,
        notification_url: graphSubscription.notificationUrl,
        change_types: [graphSubscription.changeType],
        expiration_datetime: graphSubscription.expirationDateTime,
        client_state: graphSubscription.clientState,
        is_active: true,
        last_renewal_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('❌ Erreur sauvegarde DB:', dbError)
      // Tentative de supprimer la subscription Graph en cas d'erreur DB
      await deleteGraphSubscription(accessToken, graphSubscription.id)
      throw new Error(`Erreur base de données: ${dbError.message}`)
    }

    console.log('✅ Subscription sauvegardée en DB')

    return new Response(JSON.stringify({
      success: true,
      subscription: {
        id: graphSubscription.id,
        resource: graphSubscription.resource,
        expirationDateTime: graphSubscription.expirationDateTime,
        notificationUrl: graphSubscription.notificationUrl
      },
      message: 'Subscription créée avec succès'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('❌ Erreur création subscription:', error)
    return new Response(JSON.stringify({
      error: 'Erreur création subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ====================================================================================================
// RENOUVELER LES SUBSCRIPTIONS EXISTANTES
// ====================================================================================================
async function handleRenewSubscriptions(_req: Request): Promise<Response> {
  try {
    console.log('🔄 Renouvellement des subscriptions')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Récupérer les subscriptions qui expirent dans les 6 prochaines heures
    const expirationThreshold = new Date()
    expirationThreshold.setHours(expirationThreshold.getHours() + 6)

    const { data: subscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .eq('is_active', true)
      .lt('expiration_datetime', expirationThreshold.toISOString())
      .order('expiration_datetime', { ascending: true })

    if (error) {
      throw new Error(`Erreur récupération subscriptions: ${error.message}`)
    }

    console.log(`📋 ${subscriptions?.length || 0} subscriptions à renouveler`)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Aucune subscription à renouveler',
        renewed: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const accessToken = await getGraphAccessToken()
    if (!accessToken) {
      throw new Error('Token d\'accès indisponible')
    }

    let renewed = 0
    let errors = 0

    for (const subscription of subscriptions) {
      try {
        console.log(`🔄 Renouvellement subscription: ${subscription.subscription_id}`)

        // Nouvelle date d'expiration (3 jours)
        const newExpirationDate = new Date()
        newExpirationDate.setHours(newExpirationDate.getHours() + 71)

        // Renouveler via Microsoft Graph
        const renewResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscription.subscription_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            expirationDateTime: newExpirationDate.toISOString()
          })
        })

        if (!renewResponse.ok) {
          console.error(`❌ Erreur renouvellement Graph ${subscription.subscription_id}:`, renewResponse.status)
          
          // Si la subscription n'existe plus, la marquer comme inactive
          if (renewResponse.status === 404) {
            await supabase
              .from('graph_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id)
            console.log(`⚠️ Subscription ${subscription.subscription_id} marquée inactive (404)`)
          }
          
          errors++
          continue
        }

        // Mettre à jour en base de données
        const { error: updateError } = await supabase
          .from('graph_subscriptions')
          .update({
            expiration_datetime: newExpirationDate.toISOString(),
            last_renewal_at: new Date().toISOString(),
            renewal_attempts: subscription.renewal_attempts + 1
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error(`❌ Erreur mise à jour DB ${subscription.subscription_id}:`, updateError)
          errors++
          continue
        }

        console.log(`✅ Subscription ${subscription.subscription_id} renouvelée jusqu'au ${newExpirationDate.toISOString()}`)
        renewed++

      } catch (error: unknown) {
        console.error(`❌ Erreur renouvellement ${subscription.subscription_id}:`, error)
        errors++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Renouvellement terminé',
      renewed,
      errors,
      total: subscriptions.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('❌ Erreur renouvellement subscriptions:', error)
    return new Response(JSON.stringify({
      error: 'Erreur renouvellement subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ====================================================================================================
// OBTENIR LE STATUT DES SUBSCRIPTIONS
// ====================================================================================================
async function handleGetStatus(_req: Request): Promise<Response> {
  try {
    console.log('📊 Récupération du statut des subscriptions')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Statistiques générales
    const { data: stats } = await supabase
      .from('graph_subscriptions')
      .select('is_active, expiration_datetime')

    const now = new Date()
    const active = stats?.filter(s => s.is_active).length || 0
    const expired = stats?.filter(s => s.is_active && new Date(s.expiration_datetime) < now).length || 0
    const expiringIn6h = stats?.filter(s => {
      const expiry = new Date(s.expiration_datetime)
      const in6hours = new Date(now.getTime() + 6 * 60 * 60 * 1000)
      return s.is_active && expiry < in6hours
    }).length || 0

    // Détails des subscriptions actives
    const { data: activeSubscriptions } = await supabase
      .from('active_subscriptions')
      .select('*')

    return new Response(JSON.stringify({
      success: true,
      statistics: {
        total: stats?.length || 0,
        active,
        expired,
        expiringIn6h
      },
      subscriptions: activeSubscriptions || [],
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('❌ Erreur statut subscriptions:', error)
    return new Response(JSON.stringify({
      error: 'Erreur récupération statut',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ====================================================================================================
// NETTOYER LES SUBSCRIPTIONS INACTIVES
// ====================================================================================================
async function handleCleanupSubscriptions(_req: Request): Promise<Response> {
  try {
    console.log('🧹 Nettoyage des subscriptions inactives')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Supprimer les subscriptions expirées depuis plus de 24h
    const cleanupThreshold = new Date()
    cleanupThreshold.setHours(cleanupThreshold.getHours() - 24)

    const { data: expiredSubscriptions, error } = await supabase
      .from('graph_subscriptions')
      .select('*')
      .or('is_active.eq.false,expiration_datetime.lt.' + cleanupThreshold.toISOString())

    if (error) {
      throw new Error(`Erreur récupération subscriptions expirées: ${error.message}`)
    }

    console.log(`📋 ${expiredSubscriptions?.length || 0} subscriptions à nettoyer`)

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Aucune subscription à nettoyer',
        cleaned: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const accessToken = await getGraphAccessToken()
    let cleaned = 0

    for (const subscription of expiredSubscriptions) {
      try {
        // Supprimer de Microsoft Graph si le token est disponible
        if (accessToken) {
          await deleteGraphSubscription(accessToken, subscription.subscription_id)
        }

        // Supprimer de la base de données
        const { error: deleteError } = await supabase
          .from('graph_subscriptions')
          .delete()
          .eq('id', subscription.id)

        if (deleteError) {
          console.error(`❌ Erreur suppression DB ${subscription.subscription_id}:`, deleteError)
          continue
        }

        console.log(`✅ Subscription ${subscription.subscription_id} nettoyée`)
        cleaned++

      } catch (error: unknown) {
        console.error(`❌ Erreur nettoyage ${subscription.subscription_id}:`, error)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Nettoyage terminé',
      cleaned,
      total: expiredSubscriptions.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('❌ Erreur nettoyage subscriptions:', error)
    return new Response(JSON.stringify({
      error: 'Erreur nettoyage subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ====================================================================================================
// UTILITAIRES
// ====================================================================================================

// Obtenir un token d'accès Microsoft Graph
async function getGraphAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'client_id': AZURE_CLIENT_ID,
        'client_secret': AZURE_CLIENT_SECRET,
        'scope': 'https://graph.microsoft.com/.default',
        'grant_type': 'client_credentials'
      })
    })

    if (!response.ok) {
      console.error('❌ Erreur obtention token:', response.status, await response.text())
      return null
    }

    const tokenData = await response.json()
    return tokenData.access_token

  } catch (error: unknown) {
    console.error('❌ Erreur token d\'accès:', error)
    return null
  }
}

// Supprimer une subscription de Microsoft Graph
async function deleteGraphSubscription(accessToken: string, subscriptionId: string): Promise<void> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok || response.status === 404) {
      console.log(`✅ Subscription Graph ${subscriptionId} supprimée`)
    } else {
      console.error(`❌ Erreur suppression Graph ${subscriptionId}:`, response.status)
    }
  } catch (error: unknown) {
    console.error(`❌ Erreur suppression subscription ${subscriptionId}:`, error)
  }
}

console.log('🚀 Subscription Manager v2.0 ready - Supabase Edge Function')