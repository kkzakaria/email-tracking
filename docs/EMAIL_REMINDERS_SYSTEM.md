# Système de Relances Automatiques - Architecture Intégrée

## 🎯 Vue d'ensemble

Le système de relances automatiques a été complètement réimplémenté avec une architecture intégrée dans l'écosystème Supabase existant. Il suit les mêmes patterns que les autres composants du système (authentification, RLS, Edge Functions, jobs cron).

## 🏗️ Architecture

### Base de données
- **`email_reminders`** - Table principale des relances programmées
- **`user_profiles.reminder_config`** - Configuration JSON dynamique par utilisateur
- **`tracked_emails.user_id`** - Colonne ajoutée pour multi-utilisateurs

### Edge Function
- **`email-reminder`** - Function unique avec actions : `schedule`, `send`, `status`, `test`

### Frontend
- **`ReminderConfiguration`** - Interface de configuration dynamique dans les paramètres
- **`ReminderStatsCard`** - Card de monitoring pour le dashboard

### Automatisation
- **Jobs cron** - Toutes les 4 heures à 30 minutes (réutilise l'infrastructure existante)
- **Triggers PostgreSQL** - Programmation et annulation automatiques

## ⚙️ Configuration Dynamique

La configuration se fait entièrement via l'interface utilisateur, sans modification de code :

```json
{
  "enabled": true,
  "delays": [
    {"value": 2, "unit": "days", "label": "2 jours"},
    {"value": 1, "unit": "weeks", "label": "1 semaine"}
  ],
  "templates": {
    "1": "Bonjour {{nom}}, je reviens vers vous...",
    "final": "Dernière relance concernant {{sujet}}..."
  },
  "work_hours": {"start": "09:00", "end": "18:00"},
  "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "max_reminders": 3
}
```

### Variables disponibles dans les templates
- `{{nom}}` - Nom du destinataire (extrait de l'email)
- `{{sujet}}` - Sujet de l'email original
- `{{date_envoi}}` - Date d'envoi formatée (DD/MM/YYYY)
- `{{jours_ecoules}}` - Nombre de jours écoulés
- `{{numero_relance}}` - Numéro de la relance (1, 2, 3...)
- `{{expediteur}}` - Nom de l'expéditeur

## 🔄 Flux Automatique

1. **Email envoyé** → `tracked_emails` avec `status = 'PENDING'` et `user_id`
2. **Trigger PostgreSQL** → Lit la config utilisateur → Crée `email_reminders`
3. **Job cron (4h)** → Appelle Edge Function `email-reminder?action=send`
4. **Edge Function** → Vérifie heures de travail → Compile templates → Envoie
5. **Email reçu** → Webhook existant → `status = 'REPLIED'` → Annule relances

## 📊 Monitoring et Statistiques

### Fonctions de monitoring
```sql
-- Statut du job cron
SELECT * FROM check_email_reminders_job_status();

-- Statistiques complètes
SELECT get_email_reminders_dashboard_stats();

-- Relances à venir
SELECT * FROM upcoming_reminders LIMIT 10;
```

### Interface dashboard
- Statistiques temps réel
- Prochaines relances dues
- Taux de réussite
- Monitoring du job cron

## 🚀 Déploiement et Tests

### 1. Activation du système
```sql
-- Activer le job cron
SELECT activate_email_reminders_cron();

-- Vérifier le statut
SELECT * FROM check_email_reminders_job_status();
```

### 2. Tests manuels
```bash
# Test complet du système
./scripts/test-reminders-system.sh

# Test avec emails spécifiques
curl -X POST "$SUPABASE_URL/functions/v1/email-reminder" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"action": "test", "target_email_ids": ["uuid1", "uuid2"]}'
```

### 3. Configuration utilisateur
1. Aller sur `/dashboard/settings`
2. Onglet "Relances"
3. Configurer délais, templates, heures de travail
4. Tester avec des emails spécifiques

## 🔧 Administration

### Gestion du job cron
```sql
-- Activer
SELECT activate_email_reminders_cron();

-- Désactiver
SELECT deactivate_email_reminders_cron();

-- Déclencher manuellement
SELECT trigger_email_reminders_manually();
```

### Logs et debugging
```sql
-- Historique des exécutions cron
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'email-reminders-processor')
ORDER BY start_time DESC LIMIT 10;

-- Logs centralisés dans webhook_events
SELECT * FROM webhook_events
WHERE subscription_id = 'email-reminder'
ORDER BY created_at DESC LIMIT 20;
```

## 🛡️ Sécurité et RLS

### Politiques RLS
- Les utilisateurs ne voient que leurs propres relances
- `service_role` a accès complet pour l'automatisation
- Même niveau de sécurité que le reste du système

### Isolation des données
- Chaque utilisateur a sa configuration séparée
- Pas de fuite de données entre utilisateurs
- Templates et délais personnalisés par utilisateur

## 🔄 Migration depuis l'ancien système

L'ancien système complexe (tables `test_*`, scripts multiples, composants dispersés) a été entièrement supprimé et remplacé par cette architecture intégrée :

### Supprimé ✅
- Edge Function `reminder-manager` (812 lignes)
- 5 migrations de test (`013`, `014`, `016`, `017`, `018`)
- 6 scripts de test redondants
- 4 composants frontend dispersés
- Tables `test_*` parallèles

### Nouveau ✅
- 1 Edge Function `email-reminder` (<200 lignes)
- 2 migrations intégrées (`027`, `028`)
- 1 script de test unifié
- 2 composants frontend cohérents
- Architecture unifiée avec RLS

## 📈 Avantages de la nouvelle architecture

### Simplicité
- **3x moins de code** à maintenir
- **Configuration 100% dynamique** via interface
- **Patterns cohérents** avec le reste du système

### Fiabilité
- **RLS natif** Supabase
- **Triggers PostgreSQL** pour la logique critique
- **Jobs cron** éprouvés (même infra que subscriptions)

### Évolutivité
- **Multi-utilisateurs** natif
- **Configuration par utilisateur** illimitée
- **Templates personnalisables** sans limite

### Performance
- **Indexes optimisés** sur les colonnes critiques
- **Calculs côté base** de données (triggers)
- **Cache Supabase** automatique

## 🎯 Prochaines améliorations possibles

1. **Templates HTML** - Support du formatage riche
2. **A/B Testing** - Multiples templates par relance
3. **Analytics avancées** - Taux de clic, conversion
4. **Intégrations** - Calendrier, CRM externe
5. **IA** - Génération automatique de templates
6. **Multilingue** - Templates selon la langue détectée

---

## 📞 Support

Pour toute question sur le système de relances :

1. **Logs** : Vérifier `cron.job_run_details` et `webhook_events`
2. **Status** : Appeler `check_email_reminders_job_status()`
3. **Test** : Utiliser `./scripts/test-reminders-system.sh`
4. **Dashboard** : Interface `/dashboard/settings?tab=reminders`

Le système est conçu pour être autonome et auto-diagnostique. Les erreurs sont loggées automatiquement et les statistiques sont disponibles en temps réel.