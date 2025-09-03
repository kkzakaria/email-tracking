# Guide complet : Configuration ngrok et système adaptatif

## 🎯 **Problème résolu**

Vous avez raison : **si votre ordinateur est éteint, ngrok ne fonctionne plus !**

## ✅ **Solution : Système adaptatif** 

Le système bascule automatiquement entre :
- ⚡ **Mode Webhook** (temps réel) quand disponible
- 🔄 **Mode Synchronisation** (backup) sinon

## 📋 **Configuration étape par étape**

### **1. Installation ngrok**
```bash
# Installation
npm install -g ngrok

# Configuration (récupérer le token sur ngrok.com)
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### **2. Configuration initiale (SANS ngrok)**
```env
# .env.local - Configuration de base
WEBHOOK_ENABLED="false"                    # Désactivé initialement
SYNC_FALLBACK_ENABLED="true"               # Backup automatique
SYNC_INTERVAL_MINUTES="10"                 # Sync toutes les 10 min
```

**Résultat** : Le système fonctionne en mode synchronisation (toutes les 10 min).

### **3. Activation du mode temps réel (AVEC ngrok)**

#### Étape A : Démarrer ngrok
```bash
# Dans un terminal séparé
ngrok http 3000

# Copier l'URL HTTPS (ex: https://abc123.ngrok-free.app)
```

#### Étape B : Configurer les variables
```env
# .env.local - Mode temps réel
WEBHOOK_ENABLED="true"                                              # ACTIVER
WEBHOOK_ENDPOINT_URL="https://abc123.ngrok-free.app/api/webhooks/outlook"  # URL ngrok
```

#### Étape C : Redémarrer le serveur
```bash
# Redémarrer Next.js pour prendre en compte les nouvelles variables
npm run dev
```

#### Étape D : Créer une subscription
1. Aller sur `http://localhost:3000/dashboard`
2. Voir le **Statut système** : devrait afficher "Temps réel actif" ✅
3. Cliquer sur **"Webhooks"** → **"Nouvelle Subscription"**

**Résultat** : Détection instantanée des réponses ! ⚡

## 📊 **Monitoring du système**

### **Dashboard principal**
`http://localhost:3000/dashboard`

Vous verrez une section **"Statut du système"** qui affiche :
- 🟢 **Temps réel actif** : Webhooks fonctionnels
- 🔵 **Sync (10min)** : Mode synchronisation
- 🔴 **Webhook indisponible** : Problème détecté

### **Page webhooks détaillée**
`http://localhost:3000/dashboard/webhooks`

Monitoring avancé avec :
- Subscriptions actives/expirées
- Statistiques des événements
- Actions de gestion

## 🔄 **Scénarios d'usage**

### **Scénario 1 : Développement quotidien**
```bash
# Matin : Démarrer le mode temps réel
ngrok http 3000
# Copier l'URL dans WEBHOOK_ENDPOINT_URL
# Redémarrer npm run dev

# Soir : Arrêter ngrok
# Le système bascule automatiquement en mode sync
```

### **Scénario 2 : Weekend/vacances**
```env
# .env.local - Mode économie
WEBHOOK_ENABLED="false"
SYNC_INTERVAL_MINUTES="60"    # Sync toutes les heures seulement
```

### **Scénario 3 : Démonstration cliente**
```bash
# Mode temps réel pour l'effet "wow"
ngrok http 3000
# Configurer WEBHOOK_ENABLED="true"
# Montrer la détection instantanée !
```

## 🌐 **Solutions permanentes**

### **Option A : Déploiement cloud (GRATUIT)**

#### Vercel (recommandé)
```bash
# Déployer gratuitement
vercel

# URL fixe : https://your-app.vercel.app
# Webhooks 24/7 sans ordinateur allumé !
```

#### Variables Vercel
```env
WEBHOOK_ENABLED="true"
WEBHOOK_ENDPOINT_URL="https://your-app.vercel.app/api/webhooks/outlook"
```

### **Option B : Domaine personnalisé**
```bash
# Avec un VPS (5€/mois)
WEBHOOK_ENDPOINT_URL="https://yourdomain.com/api/webhooks/outlook"
```

## 🔧 **Commands de debugging**

### **Tester le statut**
```bash
# API de statut
curl http://localhost:3000/api/tracking/status

# Réponse exemple :
{
  "mode": "sync",
  "webhookHealthy": false,
  "recommendations": [...]
}
```

### **Tester l'endpoint webhook**
```bash
# Avec ngrok actif
curl https://abc123.ngrok-free.app/api/webhooks/outlook

# Réponse attendue :
{"status":"healthy","endpoint":"/api/webhooks/outlook"}
```

### **Forcer une vérification**
```bash
# Via API
curl -X POST http://localhost:3000/api/tracking/status

# Via interface : bouton "Vérifier" dans le dashboard
```

## ⚠️ **FAQ et dépannage**

### **Q: Le statut reste "Webhook indisponible"**
**R:** Vérifier :
1. ngrok est démarré : `ngrok http 3000`
2. URL correcte dans `.env.local`
3. Serveur redémarré : `npm run dev`

### **Q: Notifications pas reçues malgré webhook actif**  
**R:** Vérifier :
1. Interface ngrok : `http://127.0.0.1:4040` (voir les requêtes)
2. Subscription créée dans `/dashboard/webhooks`
3. Logs console Next.js

### **Q: Basculement automatique ne fonctionne pas**
**R:** Le système vérifie toutes les 30 minutes. Pour forcer :
- Cliquer "Vérifier" dans le dashboard
- Ou redémarrer le serveur

### **Q: Mode sync trop lent**
**R:** Réduire l'intervalle :
```env
SYNC_INTERVAL_MINUTES="5"    # Sync toutes les 5 minutes
```

## 🎯 **Workflow recommandé**

### **Phase 1 : Setup initial (1 fois)**
1. Configurer avec `WEBHOOK_ENABLED="false"`
2. Tester le mode synchronisation
3. Vérifier que les emails sont bien trackés

### **Phase 2 : Mode développement**
1. Démarrer ngrok quand vous développez
2. Activer `WEBHOOK_ENABLED="true"`  
3. Profiter du temps réel !

### **Phase 3 : Déploiement production**
1. Déployer sur Vercel/cloud
2. URL fixe → webhooks permanent
3. Système optimal 24/7 ! 🚀

## 💡 **Bonnes pratiques**

1. **Ne jamais désactiver** `SYNC_FALLBACK_ENABLED` (sécurité)
2. **Intervalle sync** : 10-15 min en dev, 30-60 min en prod
3. **Monitoring** : Consulter le dashboard régulièrement
4. **Logs** : Garder la console ouverte pour debugging
5. **Backup** : Toujours avoir une stratégie de fallback

---

**🎉 Résultat final :** Un système robuste qui fonctionne toujours, avec ou sans ngrok !