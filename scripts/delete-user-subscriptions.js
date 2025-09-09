#!/usr/bin/env node

// ====================================================================================================
// SCRIPT: Supprimer les souscriptions Microsoft Graph avec token utilisateur
// ====================================================================================================
// Description: Supprime toutes les souscriptions créées avec le token utilisateur
// Usage: node scripts/delete-user-subscriptions.js
// ====================================================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto').webcrypto;
const readline = require('readline');

// Charger les variables d'environnement
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fonctions de déchiffrement (copiées depuis le script précédent)
async function deriveEncryptionKey(userId, serverSalt) {
    const userIdBuffer = new TextEncoder().encode(userId);
    const saltBuffer = new TextEncoder().encode(serverSalt);

    const keyMaterial = await crypto.subtle.importKey('raw', userIdBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
    }, keyMaterial, 256);

    return derivedBits;
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function decryptTokens(encryptedTokens, userId, serverSalt) {
    try {
        const encryptionKeyBytes = await deriveEncryptionKey(userId, serverSalt);
        const encryptionKey = await crypto.subtle.importKey('raw', encryptionKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        
        const accessTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.accessTokenEncrypted));
        const refreshTokenEncrypted = new Uint8Array(base64ToArrayBuffer(encryptedTokens.refreshTokenEncrypted));
        const nonce = new Uint8Array(base64ToArrayBuffer(encryptedTokens.nonce));
        
        const accessTokenBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, encryptionKey, accessTokenEncrypted);
        const refreshTokenBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, encryptionKey, refreshTokenEncrypted);
        
        return {
            accessToken: new TextDecoder().decode(accessTokenBytes),
            refreshToken: new TextDecoder().decode(refreshTokenBytes),
            expiresAt: encryptedTokens.expiresAt,
            scope: encryptedTokens.scope
        };
    } catch (error) {
        console.error('❌ Erreur déchiffrement:', error);
        return null;
    }
}

async function refreshUserToken(tokenData, refreshToken) {
    try {
        const response = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'client_id': AZURE_CLIENT_ID,
                'client_secret': AZURE_CLIENT_SECRET,
                'grant_type': 'refresh_token',
                'refresh_token': refreshToken,
                'scope': 'openid profile Mail.Read offline_access'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Erreur refresh token:', error);
            return null;
        }

        const newTokenData = await response.json();
        return newTokenData.access_token;
    } catch (error) {
        console.error('❌ Erreur refresh:', error);
        return null;
    }
}

async function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function main() {
    console.log('=====================================================================================================');
    console.log('🗑️  Supprimer les souscriptions Microsoft Graph (Token Utilisateur)');
    console.log('=====================================================================================================\n');

    // Récupérer et déchiffrer les tokens
    console.log('📋 Récupération des tokens utilisateur...');
    const { data: tokenData, error } = await supabase
        .from('microsoft_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !tokenData) {
        console.error('❌ Aucun token trouvé en base');
        process.exit(1);
    }

    console.log(`✅ Token trouvé pour user: ${tokenData.user_id}`);

    const serverSalt = `${tokenData.user_id}-encryption-salt-2024`;
    const decryptedTokens = await decryptTokens({
        accessTokenEncrypted: tokenData.access_token_encrypted,
        refreshTokenEncrypted: tokenData.refresh_token_encrypted,
        nonce: tokenData.token_nonce,
        expiresAt: tokenData.expires_at,
        scope: tokenData.scope || ''
    }, tokenData.user_id, serverSalt);

    if (!decryptedTokens) {
        console.error('❌ Impossible de déchiffrer les tokens');
        process.exit(1);
    }

    let accessToken = decryptedTokens.accessToken;

    // Renouveler si expiré
    if (new Date(tokenData.expires_at) <= new Date()) {
        console.log('\n⚠️  Token expiré, tentative de refresh...');
        accessToken = await refreshUserToken(tokenData, decryptedTokens.refreshToken);
        if (!accessToken) {
            console.error('❌ Impossible de rafraîchir le token');
            process.exit(1);
        }
        console.log('✅ Token rafraîchi avec succès');
    }

    // Lister les souscriptions
    console.log('\n📋 Récupération des souscriptions...');
    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ Erreur API Graph:', response.status, error);
        process.exit(1);
    }

    const data = await response.json();
    const subscriptions = data.value || [];

    console.log(`✅ Nombre de souscriptions trouvées: ${subscriptions.length}\n`);

    if (subscriptions.length === 0) {
        console.log('ℹ️  Aucune souscription à supprimer');
        return;
    }

    // Afficher les souscriptions
    console.log('📝 Souscriptions à supprimer:');
    console.log('=====================================================================================================');
    subscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.id} (${sub.resource})`);
        console.log(`   Expiration: ${sub.expirationDateTime}`);
        console.log(`   URL: ${sub.notificationUrl}\n`);
    });

    // Demander confirmation
    const confirmed = await askConfirmation(`⚠️  Êtes-vous sûr de vouloir supprimer ces ${subscriptions.length} souscriptions ? (y/N): `);
    
    if (!confirmed) {
        console.log('\n❌ Suppression annulée');
        return;
    }

    // Supprimer les souscriptions
    console.log('\n🗑️  Suppression en cours...');
    let deleted = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        try {
            console.log(`\n🔄 Suppression: ${subscription.id}`);
            
            const deleteResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscription.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (deleteResponse.ok || deleteResponse.status === 404) {
                console.log(`✅ Supprimée: ${subscription.id}`);
                deleted++;
            } else {
                const error = await deleteResponse.text();
                console.log(`❌ Échec: ${subscription.id} (${deleteResponse.status})`);
                console.log(`   Erreur: ${error}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Erreur: ${subscription.id}`);
            console.log(`   ${error.message}`);
            failed++;
        }
    }

    // Résumé
    console.log('\n=====================================================================================================');
    console.log('📊 Résumé:');
    console.log(`✅ Supprimées: ${deleted}`);
    console.log(`❌ Échecs: ${failed}`);

    // Nettoyer la base de données
    if (deleted > 0) {
        console.log('\n🧹 Nettoyage de la base de données...');
        await supabase
            .from('graph_subscriptions')
            .update({ is_active: false })
            .eq('is_active', true);
        
        console.log('✅ Base de données nettoyée');
    }

    console.log('\n✅ Terminé!');
}

main().catch(console.error);