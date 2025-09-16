#!/usr/bin/env node

/**
 * Script de diagnostic des permissions Microsoft Graph
 */

require('dotenv').config({ path: '.env.local' });

async function checkGraphAccess() {
  console.log('🔍 Vérification accès Microsoft Graph...');
  console.log('=' .repeat(50));

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
  const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    console.error('❌ Variables Azure manquantes');
    return;
  }

  // 1. Obtenir le token application
  console.log('\n1️⃣ Obtention du token...');
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
    console.error('❌ Erreur obtention token:', response.status);
    const error = await response.text();
    console.error(error);
    return;
  }

  const tokenData = await response.json();
  console.log('✅ Token obtenu');

  // 2. Décoder le token pour voir les permissions
  console.log('\n2️⃣ Analyse du token...');
  const tokenParts = tokenData.access_token.split('.');
  if (tokenParts.length === 3) {
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('- App ID:', payload.appid);
    console.log('- App Name:', payload.app_displayname);
    console.log('- Tenant:', payload.tid);
    console.log('- Roles (permissions application):', payload.roles || ['Aucun']);
    console.log('- Scopes (permissions déléguées):', payload.scp || 'Aucun');
  }

  // 3. Vérifier les permissions accordées à l'application
  console.log('\n3️⃣ Vérification des permissions accordées...');

  // Obtenir les détails de l'application
  const appDetailsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${AZURE_CLIENT_ID}'`,
    {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (appDetailsResponse.ok) {
    const appData = await appDetailsResponse.json();
    console.log('📱 Application trouvée:', appData.value?.[0]?.displayName || 'Nom non disponible');

    const app = appData.value?.[0];
    if (app) {
      console.log('📋 Permissions requises configurées:');
      app.requiredResourceAccess?.forEach(resource => {
        if (resource.resourceAppId === '00000003-0000-0000-c000-000000000000') { // Microsoft Graph
          console.log('  Microsoft Graph:');
          resource.resourceAccess?.forEach(permission => {
            console.log(`    - ${permission.id} (${permission.type})`);
          });
        }
      });
    }
  } else {
    console.log('⚠️ Impossible de récupérer les détails de l\'application');
  }

  // Vérifier les permissions accordées via le service principal
  const spResponse = await fetch(
    `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${AZURE_CLIENT_ID}'`,
    {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (spResponse.ok) {
    const spData = await spResponse.json();
    const servicePrincipal = spData.value?.[0];

    if (servicePrincipal) {
      console.log('\n🔐 Service Principal trouvé:', servicePrincipal.displayName);

      // Récupérer les permissions accordées
      const grantsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipal.id}/appRoleAssignments`,
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (grantsResponse.ok) {
        const grants = await grantsResponse.json();
        console.log('✅ Permissions application accordées:');
        if (grants.value.length === 0) {
          console.log('   ❌ Aucune permission accordée !');
        } else {
          grants.value.forEach(grant => {
            console.log(`   - Role ID: ${grant.appRoleId}`);
          });
        }
      } else {
        console.log('⚠️ Impossible de récupérer les permissions accordées');
      }
    }
  } else {
    console.log('⚠️ Impossible de trouver le service principal');
  }

  // 4. Tester différents endpoints
  console.log('\n4️⃣ Tests des endpoints Graph API...');

  const endpoints = [
    {
      name: 'Application details (self)',
      method: 'GET',
      url: `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${AZURE_CLIENT_ID}'`
    },
    {
      name: 'Send mail as user',
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/users/service-exploitation@karta-transit.ci/sendMail',
      body: {
        message: {
          subject: 'Test Permission',
          body: {
            contentType: 'Text',
            content: 'Test de permission d\'envoi'
          },
          toRecipients: [{
            emailAddress: {
              address: 'test@example.com'
            }
          }]
        },
        saveToSentItems: false
      }
    }
  ];

  for (const endpoint of endpoints) {
    const options = {
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    };

    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }

    const testResponse = await fetch(endpoint.url, options);

    console.log(`\n📌 ${endpoint.name}:`);
    console.log(`   ${endpoint.method} ${endpoint.url}`);
    console.log(`   Résultat: ${testResponse.status} ${testResponse.statusText}`);

    if (!testResponse.ok && testResponse.status !== 404) {
      try {
        const error = await testResponse.json();
        console.log('   Erreur:', error.error?.message || JSON.stringify(error));
      } catch {
        const errorText = await testResponse.text();
        console.log('   Erreur:', errorText);
      }
    }
  }

  // 5. Solution recommandée
  console.log('\n5️⃣ Analyse et recommandations:');
  console.log('=' .repeat(50));
  console.log(`
Pour envoyer des emails avec les permissions application (sans utilisateur):
1. L'application doit avoir la permission "Mail.Send" dans Azure AD
2. Aller dans Azure Portal > Azure AD > App registrations
3. Sélectionner votre application
4. API permissions > Add permission > Microsoft Graph
5. Application permissions > Mail > Mail.Send
6. Cliquer "Grant admin consent"

Alternative: Utiliser les permissions déléguées avec OAuth2:
- L'utilisateur se connecte et autorise l'app
- L'app peut envoyer des emails au nom de l'utilisateur
- Plus adapté pour une utilisation interactive
  `);
}

// Exécuter
checkGraphAccess().catch(console.error);