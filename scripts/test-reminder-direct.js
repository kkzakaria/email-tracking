#!/usr/bin/env node

/**
 * Script de test direct pour le système de relance
 * Test sans authentification, directement avec service_role
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Microsoft Graph config
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Créer client Supabase avec service role (pas de RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Obtenir un token Microsoft Graph
 */
async function getMicrosoftGraphToken() {
  console.log('🔑 Obtention du token Microsoft Graph...');

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Envoyer un email via Microsoft Graph
 */
async function sendEmail(token, to, subject, body) {
  console.log(`📧 Envoi d'email à ${to}...`);

  // Utiliser l'email de service
  const fromEmail = 'service-exploitation@karta-transit.ci';

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject: subject,
          body: {
            contentType: 'Text',
            content: body
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur envoi: ${response.status} - ${error}`);
  }

  console.log('✅ Email envoyé avec succès');
}

/**
 * Traiter les relances en attente
 */
async function processReminders() {
  console.log('\n🔄 Traitement des relances en attente...');
  console.log('⏰ Heure actuelle:', new Date().toISOString());

  // 1. Récupérer les relances à envoyer
  const { data: reminders, error } = await supabase
    .from('email_reminders')
    .select(`
      *,
      tracked_emails!inner(
        subject,
        recipient_email,
        sent_at
      )
    `)
    .eq('status', 'SCHEDULED')
    .lte('scheduled_for', new Date().toISOString())
    .limit(10);

  if (error) {
    console.error('❌ Erreur récupération relances:', error);
    return;
  }

  if (!reminders || reminders.length === 0) {
    console.log('📭 Aucune relance à envoyer');
    return;
  }

  console.log(`📬 ${reminders.length} relance(s) à traiter`);

  // 2. Obtenir le token Microsoft Graph
  let token;
  try {
    token = await getMicrosoftGraphToken();
  } catch (error) {
    console.error('❌ Impossible d\'obtenir le token Graph:', error.message);
    return;
  }

  // 3. Traiter chaque relance
  for (const reminder of reminders) {
    console.log(`\n📨 Traitement relance #${reminder.reminder_number} pour email ${reminder.tracked_email_id}`);

    try {
      const email = reminder.tracked_emails;

      // Préparer le message de relance
      const subject = `Re: ${email.subject}`;
      const body = reminder.compiled_message || `
Bonjour,

Je me permets de revenir vers vous concernant mon email du ${new Date(email.sent_at).toLocaleDateString('fr-FR')} au sujet de "${email.subject}".

N'ayant pas encore reçu de réponse, je me demandais si vous aviez eu l'occasion de le consulter.

Cordialement,
Service Exploitation Karta
      `.trim();

      // Envoyer l'email
      await sendEmail(token, email.recipient_email, subject, body);

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('email_reminders')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      if (updateError) {
        console.error('⚠️ Erreur mise à jour statut:', updateError);
      } else {
        console.log('✅ Relance marquée comme envoyée');
      }

    } catch (error) {
      console.error(`❌ Erreur envoi relance:`, error.message);

      // Marquer comme échouée
      await supabase
        .from('email_reminders')
        .update({
          status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);
    }
  }
}

/**
 * Créer une relance de test
 */
async function createTestReminder() {
  console.log('\n🧪 Création d\'une relance de test...');

  // Trouver l'email TEST RELANCE
  const { data: email, error: emailError } = await supabase
    .from('tracked_emails')
    .select('*')
    .eq('subject', 'TEST RELANCE')
    .single();

  if (!email) {
    console.error('❌ Email TEST RELANCE non trouvé');
    return;
  }

  console.log('📧 Email trouvé:', email.id);

  // Créer une relance immédiate
  const { data: reminder, error: reminderError } = await supabase
    .from('email_reminders')
    .insert({
      tracked_email_id: email.id,
      user_id: null,
      reminder_number: 1,
      scheduled_for: new Date().toISOString(), // Maintenant !
      status: 'SCHEDULED',
      compiled_message: `Bonjour,

Ceci est un test de relance automatique pour l'email "${email.subject}".

Test effectué le ${new Date().toLocaleString('fr-FR')}.

Cordialement,
Système de test`
    })
    .select()
    .single();

  if (reminderError) {
    console.error('❌ Erreur création relance:', reminderError);
    return;
  }

  console.log('✅ Relance de test créée:', reminder.id);
  return reminder;
}

/**
 * Programme principal
 */
async function main() {
  console.log('🚀 Test du système de relance (sans authentification)');
  console.log('=' .repeat(50));

  const action = process.argv[2];

  switch (action) {
    case 'create':
      // Créer une relance de test
      await createTestReminder();
      break;

    case 'send':
      // Envoyer les relances en attente
      await processReminders();
      break;

    case 'test':
      // Créer et envoyer immédiatement
      await createTestReminder();
      console.log('\n⏳ Attente 2 secondes...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await processReminders();
      break;

    default:
      console.log(`
Usage: node test-reminder-direct.js [action]

Actions:
  create  - Créer une relance de test pour l'email TEST RELANCE
  send    - Envoyer toutes les relances en attente
  test    - Créer et envoyer une relance de test (combiné)

Exemple:
  node test-reminder-direct.js test
      `);
  }
}

// Exécuter
main().catch(console.error);