#!/bin/bash

# Script pour tester la connexion Realtime et les politiques RLS
# Usage: ./scripts/test-realtime-connection.sh

echo "🔍 Test de connexion Realtime Supabase"
echo "======================================="

# Vérifier que les variables d'environnement sont définies
if [ ! -f .env.local ]; then
    echo "❌ Fichier .env.local non trouvé"
    exit 1
fi

# Charger les variables d'environnement
export $(cat .env.local | grep -v '^#' | xargs)

echo ""
echo "1️⃣ Vérification des tables dans la publication Realtime..."
echo "-----------------------------------------------------------"

# Requête SQL pour vérifier la publication
SQL_QUERY="SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;"

# Utiliser supabase db pour exécuter la requête
echo "Tables dans la publication supabase_realtime:"
supabase db query "$SQL_QUERY" 2>/dev/null || echo "⚠️  Impossible de se connecter à la base de données"

echo ""
echo "2️⃣ Vérification des politiques RLS sur tracked_emails..."
echo "-----------------------------------------------------------"

SQL_POLICIES="SELECT policyname, cmd, roles::text FROM pg_policies WHERE tablename = 'tracked_emails' ORDER BY policyname;"

echo "Politiques RLS actives:"
supabase db query "$SQL_POLICIES" 2>/dev/null || echo "⚠️  Impossible de récupérer les politiques"

echo ""
echo "3️⃣ Test de connexion avec le client JavaScript..."
echo "-----------------------------------------------------------"

# Créer un petit script Node.js pour tester
cat > /tmp/test-realtime.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔄 Tentative de connexion Realtime...');

const channel = supabase
    .channel('test_channel')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tracked_emails' },
        (payload) => {
            console.log('📨 Changement reçu:', payload);
        }
    )
    .subscribe((status) => {
        console.log('📡 Statut:', status);
        if (status === 'SUBSCRIBED') {
            console.log('✅ Connexion Realtime réussie!');
            setTimeout(() => {
                channel.unsubscribe();
                process.exit(0);
            }, 2000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('❌ Erreur de connexion:', status);
            process.exit(1);
        }
    });

// Timeout après 10 secondes
setTimeout(() => {
    console.error('⏱️ Timeout - pas de réponse après 10 secondes');
    process.exit(1);
}, 10000);
EOF

# Vérifier si Node.js est installé
if command -v node &> /dev/null; then
    echo "Test de connexion en cours..."
    cd /home/super/codes/email-tracking
    node /tmp/test-realtime.js
else
    echo "⚠️  Node.js n'est pas installé, impossible de tester la connexion"
fi

# Nettoyer
rm -f /tmp/test-realtime.js

echo ""
echo "======================================="
echo "✅ Test terminé"
echo ""
echo "Si la connexion Realtime échoue, vérifiez:"
echo "1. Que la migration 011 a bien été appliquée"
echo "2. Que RLS est activé sur les tables"
echo "3. Les paramètres Realtime dans Supabase Dashboard > Settings > Realtime"