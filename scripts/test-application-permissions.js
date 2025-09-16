#!/usr/bin/env node

/**
 * Script de test pour le système de relances avec permissions d'application
 * Teste les Edge Functions app-token-manager et email-reminder
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/**
 * Tester app-token-manager
 */
async function testTokenManager() {
  console.log('\n🔑 Test du gestionnaire de tokens...');

  try {
    // Test obtention de token
    const { data, error } = await supabase.functions.invoke('app-token-manager', {
      body: { action: 'get-token' }
    });

    if (error) {
      console.error('❌ Erreur app-token-manager:', error);
      return false;
    }

    if (!data.success) {
      console.error('❌ Token manager a échoué:', data.error);
      return false;
    }

    console.log('✅ Token d\'application obtenu');
    console.log('   - Token type:', data.data.token_type);
    console.log('   - Cached:', data.data.cached);
    console.log('   - Expires at:', new Date(data.data.expires_at).toLocaleString('fr-FR'));

    return true;

  } catch (error) {
    console.error('❌ Erreur test token manager:', error.message);
    return false;
  }
}

/**
 * Créer une relance de test
 */
async function createTestReminder() {
  console.log('\n📝 Création d\'une relance de test...');

  try {
    // Trouver l'email TEST RELANCE
    const { data: email, error: emailError } = await supabase
      .from('tracked_emails')
      .select('*')
      .eq('subject', 'TEST RELANCE')
      .single();

    if (emailError || !email) {
      console.error('❌ Email TEST RELANCE non trouvé:', emailError);
      return null;
    }

    console.log('📧 Email trouvé:', email.subject, '→', email.recipient_email);

    // Créer une relance immédiate
    const { data: reminder, error: reminderError } = await supabase
      .from('email_reminders')
      .insert({
        tracked_email_id: email.id,
        user_id: null, // Pas d'utilisateur pour les permissions d'application
        reminder_number: 1,
        scheduled_for: new Date().toISOString(),
        status: 'SCHEDULED',
        compiled_message: `Bonjour,

Ceci est un test de relance automatique avec permissions d'application pour l'email "${email.subject}".

Test effectué le ${new Date().toLocaleString('fr-FR')}.

Cette relance utilise le nouveau système centralisé de tokens.

Cordialement,
Système de test (permissions application)`
      })
      .select()
      .single();

    if (reminderError) {
      console.error('❌ Erreur création relance:', reminderError);
      return null;
    }

    console.log('✅ Relance de test créée:', reminder.id);
    console.log('   - Programmée pour:', new Date(reminder.scheduled_for).toLocaleString('fr-FR'));

    return reminder;

  } catch (error) {
    console.error('❌ Erreur création relance:', error.message);
    return null;
  }
}

/**
 * Tester le traitement des relances
 */
async function testReminderProcessing() {
  console.log('\n🔄 Test du traitement des relances...');

  try {
    const { data, error } = await supabase.functions.invoke('email-reminder', {
      body: { action: 'process-pending' }
    });

    if (error) {
      console.error('❌ Erreur traitement relances:', error);
      return false;
    }

    if (!data.success) {
      console.error('❌ Traitement relances a échoué:', data.error);
      return false;
    }

    console.log('✅ Traitement des relances terminé');
    console.log('   - Relances traitées:', data.data.processed);
    console.log('   - Envoyées avec succès:', data.data.sent);
    console.log('   - Échecs:', data.data.failed);

    return data.data.sent > 0;

  } catch (error) {
    console.error('❌ Erreur test traitement:', error.message);
    return false;
  }
}

/**
 * Vérifier l'état des relances
 */
async function checkReminderStatus() {
  console.log('\n📊 Vérification de l\'état des relances...');

  try {
    const { data: reminders, error } = await supabase
      .from('email_reminders')
      .select(`
        *,
        tracked_emails(subject, recipient_email)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération relances:', error);
      return;
    }

    console.log(`📋 ${reminders.length} relance(s) récente(s):`);
    reminders.forEach(reminder => {
      const email = reminder.tracked_emails;
      console.log(`   - ${email.subject} → ${email.recipient_email}`);
      console.log(`     Status: ${reminder.status}, Relance #${reminder.reminder_number}`);
      console.log(`     Programmée: ${new Date(reminder.scheduled_for).toLocaleString('fr-FR')}`);
      if (reminder.sent_at) {
        console.log(`     Envoyée: ${new Date(reminder.sent_at).toLocaleString('fr-FR')}`);
      }
      console.log();
    });

  } catch (error) {
    console.error('❌ Erreur vérification statut:', error.message);
  }
}

/**
 * Programme principal
 */
async function main() {
  console.log('🚀 Test du système de relances avec permissions d\'application');
  console.log('=' .repeat(60));

  const action = process.argv[2];

  switch (action) {
    case 'token':
      await testTokenManager();
      break;

    case 'create':
      await createTestReminder();
      await checkReminderStatus();
      break;

    case 'send':
      await testReminderProcessing();
      await checkReminderStatus();
      break;

    case 'full':
      console.log('🧪 Test complet du système...');

      // 1. Test du token manager
      const tokenOk = await testTokenManager();
      if (!tokenOk) {
        console.error('❌ Test arrêté : problème avec le token manager');
        return;
      }

      // 2. Créer une relance
      const reminder = await createTestReminder();
      if (!reminder) {
        console.error('❌ Test arrêté : impossible de créer une relance');
        return;
      }

      // 3. Attendre quelques secondes
      console.log('\n⏳ Attente 3 secondes...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Traiter les relances
      const sent = await testReminderProcessing();

      // 5. Vérifier le statut final
      await checkReminderStatus();

      if (sent) {
        console.log('\n🎉 Test complet réussi !');
        console.log('✅ Le système de relances avec permissions d\'application fonctionne');
      } else {
        console.log('\n⚠️ Test partiellement réussi');
        console.log('❓ Vérifiez les logs pour identifier le problème d\'envoi');
      }
      break;

    case 'status':
      await checkReminderStatus();
      break;

    default:
      console.log(`
Usage: node scripts/test-application-permissions.js [action]

Actions:
  token   - Tester uniquement app-token-manager
  create  - Créer une relance de test
  send    - Traiter les relances en attente
  full    - Test complet (recommandé)
  status  - Voir l'état des relances

Exemple pour test complet:
  node scripts/test-application-permissions.js full
      `);
  }
}

main().catch(console.error);