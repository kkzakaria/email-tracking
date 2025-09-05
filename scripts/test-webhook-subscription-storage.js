#!/usr/bin/env node

/**
 * Script de test pour diagnostiquer les problèmes d'enregistrement 
 * des souscriptions webhook en base de données
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { randomBytes } from 'crypto'

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' })

const WEBHOOK_URL = "https://email-tracking-zeta.vercel.app"

async function testSupabaseConnection() {
  console.log('🔍 TEST DE CONNEXION SUPABASE')
  console.log('===============================')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('Variables d\'environnement:')
  console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Définie' : '❌ Manquante'}`)
  console.log(`${serviceKey ? '✅' : '❌'} SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? 'Définie' : 'Manquante'}`)
  console.log(`✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? 'Définie' : '❌ Manquante'}`)
  console.log()

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Variables d\'environnement manquantes')
    return false
  }

  // Test de connexion avec service role key
  const serviceSupabase = createClient(supabaseUrl, serviceKey)
  
  try {
    // Test basique de connexion
    const { data, error } = await serviceSupabase.from('webhook_subscriptions').select('count').limit(1)
    
    if (error) {
      console.error('❌ Erreur de connexion Supabase:', error)
      return false
    }
    
    console.log('✅ Connexion Supabase réussie')
    return true
  } catch (err) {
    console.error('❌ Erreur de connexion:', err)
    return false
  }
}

async function testTableAccess() {
  console.log('📋 TEST D\'ACCÈS AUX TABLES')
  console.log('==========================')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Test d'accès à la table webhook_subscriptions
  try {
    const { data, error, count } = await supabase
      .from('webhook_subscriptions')
      .select('*', { count: 'exact' })
      .limit(5)

    if (error) {
      console.error('❌ Erreur d\'accès à webhook_subscriptions:', error)
      return false
    }

    console.log(`✅ Table webhook_subscriptions accessible`)
    console.log(`📊 Nombre total de souscriptions: ${count}`)
    
    if (data && data.length > 0) {
      console.log('📝 Dernières souscriptions:')
      data.forEach((sub, index) => {
        console.log(`  ${index + 1}. ID: ${sub.subscription_id}`)
        console.log(`     User: ${sub.user_id}`)
        console.log(`     Status: ${sub.status}`)
        console.log(`     Création: ${sub.created_at}`)
        console.log()
      })
    } else {
      console.log('📝 Aucune souscription trouvée')
    }

    return true
  } catch (err) {
    console.error('❌ Erreur lors du test de table:', err)
    return false
  }
}

async function testRLSPolicies() {
  console.log('🔒 TEST DES POLITIQUES RLS')
  console.log('==========================')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Vérifier les policies RLS
    const { data: policies, error } = await supabase
      .rpc('pg_get_policies', { 
        table_name: 'webhook_subscriptions' 
      })
      .select('*')

    if (error) {
      console.log('⚠️ Impossible de récupérer les policies RLS (normal si pas d\'accès système)')
    } else {
      console.log('✅ Policies RLS trouvées:', policies?.length || 0)
    }

    // Test d'insertion avec un utilisateur fictif
    const testUserId = '00000000-0000-0000-0000-000000000000'
    const testSubscriptionId = `test-${Date.now()}`

    const { data: insertData, error: insertError } = await supabase
      .from('webhook_subscriptions')
      .insert({
        subscription_id: testSubscriptionId,
        user_id: testUserId,
        resource: '/me/messages',
        change_types: ['created', 'updated'],
        notification_url: `${WEBHOOK_URL}/api/webhooks/outlook`,
        expiration_datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        client_state: randomBytes(16).toString('base64'),
        status: 'active'
      })
      .select()

    if (insertError) {
      console.error('❌ Erreur lors de l\'insertion test:', insertError)
      console.log('   → Ceci pourrait expliquer pourquoi les souscriptions ne sont pas sauvegardées')
    } else {
      console.log('✅ Insertion test réussie')
      console.log('   → Les souscriptions PEUVENT être sauvegardées')
      
      // Nettoyer le test
      await supabase
        .from('webhook_subscriptions')
        .delete()
        .eq('subscription_id', testSubscriptionId)
      
      console.log('🧹 Nettoyage de l\'enregistrement test effectué')
    }

    return insertError === null
  } catch (err) {
    console.error('❌ Erreur lors du test RLS:', err)
    return false
  }
}

async function testWebhookServiceLogic() {
  console.log('🔧 TEST DE LA LOGIQUE WEBHOOK SERVICE')
  console.log('=====================================')

  // Simuler la même logique que WebhookService.createSubscription()
  console.log('Configuration webhook:')
  console.log(`  WEBHOOK_ENDPOINT_URL: ${process.env.WEBHOOK_ENDPOINT_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`}`)
  console.log(`  WEBHOOK_CLIENT_STATE: ${process.env.WEBHOOK_CLIENT_STATE ? 'Défini' : 'Généré automatiquement'}`)
  console.log()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  console.log(`Client Supabase configuré avec: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' : 'ANON_KEY'}`)

  // Tester avec les mêmes paramètres que le vrai service
  const mockResponse = {
    id: `mock-subscription-${Date.now()}`,
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  }

  const mockOptions = {
    userId: '00000000-0000-0000-0000-000000000000',
    resourceType: 'messages',
    changeTypes: ['created', 'updated']
  }

  const notificationUrl = process.env.WEBHOOK_ENDPOINT_URL || 
    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`
  const clientState = process.env.WEBHOOK_CLIENT_STATE || 
    randomBytes(32).toString('base64')

  console.log('Paramètres d\'insertion:')
  console.log(`  subscription_id: ${mockResponse.id}`)
  console.log(`  user_id: ${mockOptions.userId}`)
  console.log(`  resource: /me/messages`)
  console.log(`  notification_url: ${notificationUrl}`)
  console.log()

  const { error: dbError } = await supabase
    .from('webhook_subscriptions')
    .insert({
      subscription_id: mockResponse.id,
      user_id: mockOptions.userId,
      resource: '/me/messages',
      change_types: mockOptions.changeTypes,
      notification_url: notificationUrl,
      expiration_datetime: mockResponse.expirationDateTime,
      client_state: clientState,
      status: 'active'
    })

  if (dbError) {
    console.error('❌ Erreur lors de l\'insertion (même logique que WebhookService):', dbError)
    console.log('   → Ceci explique pourquoi les souscriptions ne sont pas sauvegardées!')
    
    // Analyser l'erreur
    if (dbError.code === '23503') {
      console.log('   → Erreur de contrainte de clé étrangère (user_id invalide?)')
    } else if (dbError.code === '42501') {
      console.log('   → Erreur de permission (RLS?)')
    } else if (dbError.code === '23505') {
      console.log('   → Violation de contrainte unique (subscription_id dupliqué?)')
    }
  } else {
    console.log('✅ Insertion réussie avec la même logique que WebhookService')
    
    // Nettoyer
    await supabase
      .from('webhook_subscriptions')
      .delete()
      .eq('subscription_id', mockResponse.id)
    
    console.log('🧹 Nettoyage effectué')
  }

  return dbError === null
}

async function main() {
  console.log(`🔍 DIAGNOSTIC D'ENREGISTREMENT DES SOUSCRIPTIONS WEBHOOK`)
  console.log(`========================================================`)
  console.log()

  const tests = [
    { name: 'Connexion Supabase', test: testSupabaseConnection },
    { name: 'Accès aux tables', test: testTableAccess },
    { name: 'Politiques RLS', test: testRLSPolicies },
    { name: 'Logique WebhookService', test: testWebhookServiceLogic }
  ]

  let allPassed = true

  for (const { name, test } of tests) {
    try {
      const passed = await test()
      if (!passed) {
        allPassed = false
      }
      console.log()
    } catch (error) {
      console.error(`❌ Erreur lors du test "${name}":`, error)
      allPassed = false
      console.log()
    }
  }

  console.log('📊 RÉSUMÉ FINAL')
  console.log('===============')
  if (allPassed) {
    console.log('✅ Tous les tests sont passés - le système devrait fonctionner')
    console.log('   → Si les souscriptions ne s\'affichent toujours pas, vérifiez:')
    console.log('     • Les logs Vercel pendant la création')
    console.log('     • Que user.id correspond bien entre l\'interface et l\'API')
  } else {
    console.log('❌ Des problèmes ont été détectés')
    console.log('   → Consultez les erreurs ci-dessus pour identifier la cause')
  }
}

// Exécuter le diagnostic
main().catch(console.error)