-- ====================================================================================================
-- EMAIL REMINDERS SYSTEM - INTEGRATED ARCHITECTURE
-- ====================================================================================================
-- Migration 027: Système de relances intégré dans l'architecture Supabase-centric existante
-- Created: 2025-01-16
-- Description: Architecture simple et cohérente avec l'existant (RLS, multi-utilisateurs, triggers)
-- ====================================================================================================

-- ====================================================================================================
-- STEP 1: Ajouter user_id à tracked_emails pour multi-utilisateurs
-- ====================================================================================================

-- Ajouter la colonne user_id à tracked_emails si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracked_emails'
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE tracked_emails ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        CREATE INDEX idx_tracked_emails_user_id ON tracked_emails(user_id);
        RAISE NOTICE '✅ Colonne user_id ajoutée à tracked_emails';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne user_id existe déjà dans tracked_emails';
    END IF;
END $$;

-- ====================================================================================================
-- STEP 2: Étendre user_profiles avec configuration relances
-- ====================================================================================================

-- Ajouter la colonne reminder_config à user_profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'reminder_config'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN reminder_config JSONB DEFAULT '{
          "enabled": true,
          "delays": [
            {"value": 2, "unit": "days", "label": "2 jours"},
            {"value": 1, "unit": "weeks", "label": "1 semaine"},
            {"value": 2, "unit": "weeks", "label": "2 semaines"}
          ],
          "templates": {
            "1": "Bonjour {{nom}},\n\nJ''espère que vous allez bien. Je reviens vers vous concernant mon message du {{date_envoi}} au sujet de \"{{sujet}}\".\n\nN''ayant pas eu de retour de votre part depuis {{jours_ecoules}} jours, je souhaitais m''assurer que vous avez bien reçu mon message.\n\nMerci de votre attention.\n\nCordialement",
            "2": "Bonjour {{nom}},\n\nJe me permets de relancer concernant mon email du {{date_envoi}} sur \"{{sujet}}\".\n\nSi vous avez besoin d''informations complémentaires, n''hésitez pas à me le faire savoir.\n\nCordialement",
            "final": "Bonjour {{nom}},\n\nDernière relance concernant \"{{sujet}}\".\n\nSi ce message ne vous concerne pas ou si vous préférez ne pas donner suite, merci de me le faire savoir.\n\nCordialement"
          },
          "work_hours": {
            "start": "09:00",
            "end": "18:00"
          },
          "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
          "max_reminders": 3
        }'::jsonb;

        RAISE NOTICE '✅ Colonne reminder_config ajoutée à user_profiles';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne reminder_config existe déjà dans user_profiles';
    END IF;
END $$;

-- ====================================================================================================
-- STEP 3: Table email_reminders simplifiée
-- ====================================================================================================

CREATE TABLE IF NOT EXISTS email_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    tracked_email_id UUID NOT NULL REFERENCES tracked_emails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Planning des relances
    reminder_number INTEGER NOT NULL DEFAULT 1, -- 1ère, 2ème, 3ème relance...
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,

    -- Template compilé au moment de l'envoi (évite les recompilations)
    compiled_message TEXT,

    -- Statut simple
    status TEXT NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte : une seule relance par numéro par email
    UNIQUE(tracked_email_id, reminder_number)
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_email_reminders_tracked_email ON email_reminders(tracked_email_id);
CREATE INDEX IF NOT EXISTS idx_email_reminders_user ON email_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_email_reminders_scheduled ON email_reminders(scheduled_for)
    WHERE status = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_email_reminders_status ON email_reminders(status, scheduled_for);

-- Trigger pour updated_at
CREATE TRIGGER update_email_reminders_updated_at
    BEFORE UPDATE ON email_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================================================
-- STEP 4: Fonction pour calculer la date de la prochaine relance
-- ====================================================================================================

CREATE OR REPLACE FUNCTION calculate_next_reminder_date(
    p_user_id UUID,
    p_reminder_number INTEGER,
    p_base_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_config JSONB;
    v_delays JSONB;
    v_delay JSONB;
    v_work_hours JSONB;
    v_work_days JSONB;
    v_target_date TIMESTAMPTZ;
    v_delay_value INTEGER;
    v_delay_unit TEXT;
BEGIN
    -- Récupérer la configuration utilisateur
    SELECT reminder_config INTO v_config
    FROM user_profiles
    WHERE auth_user_id = p_user_id;

    -- Si pas de config, utiliser les valeurs par défaut
    IF v_config IS NULL THEN
        v_config := '{
            "delays": [
                {"value": 2, "unit": "days"},
                {"value": 1, "unit": "weeks"},
                {"value": 2, "unit": "weeks"}
            ],
            "work_hours": {"start": "09:00", "end": "18:00"},
            "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
        }'::jsonb;
    END IF;

    -- Extraire les délais
    v_delays := v_config->'delays';
    v_work_hours := v_config->'work_hours';
    v_work_days := v_config->'work_days';

    -- Récupérer le délai pour ce numéro de relance (index 0-based)
    v_delay := v_delays->(p_reminder_number - 1);

    -- Si pas de délai pour ce numéro, utiliser le dernier délai disponible
    IF v_delay IS NULL AND jsonb_array_length(v_delays) > 0 THEN
        v_delay := v_delays->(jsonb_array_length(v_delays) - 1);
    END IF;

    -- Si toujours pas de délai, utiliser 1 semaine par défaut
    IF v_delay IS NULL THEN
        v_delay := '{"value": 1, "unit": "weeks"}'::jsonb;
    END IF;

    -- Extraire valeur et unité
    v_delay_value := (v_delay->>'value')::integer;
    v_delay_unit := v_delay->>'unit';

    -- Calculer la date cible selon l'unité
    CASE v_delay_unit
        WHEN 'hours' THEN
            v_target_date := p_base_date + (v_delay_value || ' hours')::interval;
        WHEN 'days' THEN
            v_target_date := p_base_date + (v_delay_value || ' days')::interval;
        WHEN 'weeks' THEN
            v_target_date := p_base_date + (v_delay_value || ' weeks')::interval;
        ELSE
            -- Par défaut : jours
            v_target_date := p_base_date + (v_delay_value || ' days')::interval;
    END CASE;

    -- Ajuster selon les heures de travail (simple : si hors heures, décaler au début des heures de travail)
    -- On peut améliorer cette logique plus tard si nécessaire
    IF EXTRACT(hour FROM v_target_date) < (v_work_hours->>'start')::time::integer THEN
        v_target_date := date_trunc('day', v_target_date) + (v_work_hours->>'start')::time;
    ELSIF EXTRACT(hour FROM v_target_date) > (v_work_hours->>'end')::time::integer THEN
        v_target_date := date_trunc('day', v_target_date) + interval '1 day' + (v_work_hours->>'start')::time;
    END IF;

    RETURN v_target_date;
END;
$$;

-- ====================================================================================================
-- STEP 5: Fonction pour compiler les templates
-- ====================================================================================================

CREATE OR REPLACE FUNCTION compile_reminder_template(
    p_user_id UUID,
    p_reminder_number INTEGER,
    p_tracked_email_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_config JSONB;
    v_templates JSONB;
    v_template TEXT;
    v_email RECORD;
    v_profile RECORD;
    v_compiled TEXT;
    v_template_key TEXT;
BEGIN
    -- Récupérer la configuration utilisateur
    SELECT reminder_config INTO v_config
    FROM user_profiles
    WHERE auth_user_id = p_user_id;

    -- Récupérer les infos de l'email
    SELECT subject, recipient_email, sent_at INTO v_email
    FROM tracked_emails
    WHERE id = p_tracked_email_id;

    -- Récupérer le profil utilisateur
    SELECT full_name INTO v_profile
    FROM user_profiles
    WHERE auth_user_id = p_user_id;

    -- Extraire les templates
    v_templates := v_config->'templates';

    -- Déterminer la clé du template
    v_template_key := p_reminder_number::text;

    -- Si c'est la dernière relance ou si pas de template pour ce numéro, utiliser "final"
    IF v_templates->v_template_key IS NULL OR
       p_reminder_number >= (v_config->>'max_reminders')::integer THEN
        v_template_key := 'final';
    END IF;

    -- Récupérer le template
    v_template := v_templates->>v_template_key;

    -- Template par défaut si pas trouvé
    IF v_template IS NULL THEN
        v_template := 'Bonjour,\n\nJe reviens vers vous concernant mon message du {{date_envoi}} au sujet de "{{sujet}}".\n\nCordialement';
    END IF;

    -- Compiler le template en remplaçant les variables
    v_compiled := v_template;

    -- Remplacements des variables
    v_compiled := REPLACE(v_compiled, '{{nom}}', split_part(v_email.recipient_email, '@', 1));
    v_compiled := REPLACE(v_compiled, '{{sujet}}', COALESCE(v_email.subject, 'votre demande'));
    v_compiled := REPLACE(v_compiled, '{{date_envoi}}', to_char(v_email.sent_at, 'DD/MM/YYYY'));
    v_compiled := REPLACE(v_compiled, '{{jours_ecoules}}', EXTRACT(DAY FROM (NOW() - v_email.sent_at))::text);
    v_compiled := REPLACE(v_compiled, '{{numero_relance}}', p_reminder_number::text);
    v_compiled := REPLACE(v_compiled, '{{expediteur}}', COALESCE(v_profile.full_name, 'Expéditeur'));

    RETURN v_compiled;
END;
$$;

-- ====================================================================================================
-- STEP 6: Triggers pour automatiser les relances
-- ====================================================================================================

-- Trigger pour créer automatiquement la première relance lors de l'insertion d'un email PENDING
CREATE OR REPLACE FUNCTION auto_schedule_first_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_next_date TIMESTAMPTZ;
    v_config JSONB;
BEGIN
    -- Ne traiter que les nouveaux emails PENDING avec user_id
    IF NEW.status = 'PENDING' AND NEW.user_id IS NOT NULL THEN

        -- Vérifier que l'utilisateur a les relances activées
        SELECT reminder_config INTO v_config
        FROM user_profiles
        WHERE auth_user_id = NEW.user_id;

        -- Si les relances sont activées
        IF v_config IS NOT NULL AND (v_config->>'enabled')::boolean = true THEN

            -- Calculer la date de la première relance
            v_next_date := calculate_next_reminder_date(NEW.user_id, 1, NEW.sent_at);

            -- Programmer la première relance
            INSERT INTO email_reminders (
                tracked_email_id,
                user_id,
                reminder_number,
                scheduled_for,
                status
            ) VALUES (
                NEW.id,
                NEW.user_id,
                1,
                v_next_date,
                'SCHEDULED'
            );

            RAISE NOTICE 'Première relance programmée pour % à %', NEW.subject, v_next_date;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_schedule_first_reminder_on_insert
    AFTER INSERT ON tracked_emails
    FOR EACH ROW
    EXECUTE FUNCTION auto_schedule_first_reminder();

-- Trigger pour annuler les relances lors du passage à REPLIED
CREATE OR REPLACE FUNCTION cancel_reminders_on_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Si le statut passe à REPLIED, annuler toutes les relances programmées
    IF OLD.status = 'PENDING' AND NEW.status = 'REPLIED' THEN

        UPDATE email_reminders
        SET
            status = 'CANCELLED',
            updated_at = NOW()
        WHERE
            tracked_email_id = NEW.id
            AND status = 'SCHEDULED';

        RAISE NOTICE 'Relances annulées pour email % (passage à REPLIED)', NEW.subject;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER cancel_reminders_on_reply_trigger
    AFTER UPDATE ON tracked_emails
    FOR EACH ROW
    EXECUTE FUNCTION cancel_reminders_on_reply();

-- ====================================================================================================
-- STEP 7: Politiques RLS pour email_reminders
-- ====================================================================================================

-- Activer RLS sur email_reminders
ALTER TABLE email_reminders ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs ne voient que leurs propres relances
CREATE POLICY "users_own_reminders" ON email_reminders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politique pour service_role (Edge Functions)
CREATE POLICY "service_role_all_reminders" ON email_reminders
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ====================================================================================================
-- STEP 8: Politiques RLS pour tracked_emails avec user_id
-- ====================================================================================================

-- Supprimer l'ancienne politique générale de lecture
DROP POLICY IF EXISTS "tracked_emails_select_policy" ON tracked_emails;

-- Nouvelle politique : Les utilisateurs ne voient que leurs emails
CREATE POLICY "users_own_tracked_emails" ON tracked_emails
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role peut tout voir
CREATE POLICY "service_role_all_tracked_emails" ON tracked_emails
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ====================================================================================================
-- STEP 9: Vues pour monitoring
-- ====================================================================================================

-- Vue des relances programmées
CREATE OR REPLACE VIEW upcoming_reminders AS
SELECT
    er.id,
    er.reminder_number,
    er.scheduled_for,
    er.status,
    te.subject,
    te.recipient_email,
    te.sent_at,
    up.full_name as sender_name,
    EXTRACT(EPOCH FROM (er.scheduled_for - NOW()))/3600 as hours_until_due
FROM email_reminders er
JOIN tracked_emails te ON te.id = er.tracked_email_id
JOIN user_profiles up ON up.auth_user_id = er.user_id
WHERE er.status = 'SCHEDULED'
ORDER BY er.scheduled_for ASC;

-- Mise à jour de la vue email_stats pour inclure les relances
DROP VIEW IF EXISTS email_stats;
CREATE OR REPLACE VIEW email_stats AS
SELECT
    COUNT(te.*) as total_emails,
    COUNT(CASE WHEN te.status = 'PENDING' THEN 1 END) as pending_emails,
    COUNT(CASE WHEN te.status = 'REPLIED' THEN 1 END) as replied_emails,
    COUNT(CASE WHEN te.status = 'FAILED' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN te.status = 'EXPIRED' THEN 1 END) as expired_emails,
    COUNT(CASE WHEN te.conversation_id IS NOT NULL THEN 1 END) as emails_with_conversation_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (te.reply_received_at - te.sent_at))/3600), 2) as avg_reply_time_hours,

    -- Nouvelles stats des relances
    COUNT(er.*) as total_reminders,
    COUNT(CASE WHEN er.status = 'SCHEDULED' THEN 1 END) as scheduled_reminders,
    COUNT(CASE WHEN er.status = 'SENT' THEN 1 END) as sent_reminders,
    COUNT(CASE WHEN er.status = 'CANCELLED' THEN 1 END) as cancelled_reminders
FROM tracked_emails te
LEFT JOIN email_reminders er ON er.tracked_email_id = te.id;

-- ====================================================================================================
-- STEP 10: Permissions
-- ====================================================================================================

-- Grants pour service_role
GRANT ALL ON email_reminders TO service_role;
GRANT SELECT ON upcoming_reminders TO service_role;
GRANT EXECUTE ON FUNCTION calculate_next_reminder_date TO service_role;
GRANT EXECUTE ON FUNCTION compile_reminder_template TO service_role;

-- Grants pour authenticated users (lecture seule via RLS)
GRANT SELECT ON email_reminders TO authenticated;
GRANT SELECT ON upcoming_reminders TO authenticated;

-- ====================================================================================================
-- STEP 11: Commentaires pour documentation
-- ====================================================================================================

COMMENT ON TABLE email_reminders IS 'Système de relances intégré - Architecture Supabase-centric cohérente';
COMMENT ON COLUMN email_reminders.reminder_number IS 'Numéro de la relance (1, 2, 3...)';
COMMENT ON COLUMN email_reminders.scheduled_for IS 'Date programmée pour l''envoi, calculée dynamiquement';
COMMENT ON COLUMN email_reminders.compiled_message IS 'Template compilé avec variables remplacées';

COMMENT ON COLUMN user_profiles.reminder_config IS 'Configuration JSON des relances (délais, templates, heures de travail)';

COMMENT ON FUNCTION calculate_next_reminder_date IS 'Calcule la prochaine date de relance selon la config utilisateur';
COMMENT ON FUNCTION compile_reminder_template IS 'Compile un template avec les variables de l''email';

COMMENT ON VIEW upcoming_reminders IS 'Vue des relances programmées pour monitoring';

-- ====================================================================================================
-- STEP 12: Vérifications finales
-- ====================================================================================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Vérifier les tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN ('email_reminders') AND table_schema = 'public';

    -- Vérifier les fonctions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name IN ('calculate_next_reminder_date', 'compile_reminder_template')
    AND routine_schema = 'public';

    -- Vérifier les triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name IN ('auto_schedule_first_reminder_on_insert', 'cancel_reminders_on_reply_trigger');

    IF table_count >= 1 AND function_count >= 2 AND trigger_count >= 2 THEN
        RAISE NOTICE '✅ Système de relances intégré installé avec succès';
        RAISE NOTICE '📊 Tables: %, Fonctions: %, Triggers: %', table_count, function_count, trigger_count;
        RAISE NOTICE '🔒 RLS activé avec politiques utilisateur et service_role';
        RAISE NOTICE '⚙️ Configuration dynamique via user_profiles.reminder_config';
        RAISE NOTICE '🤖 Programmation automatique via triggers PostgreSQL';
    ELSE
        RAISE WARNING '⚠️ Installation incomplète - Tables: %, Fonctions: %, Triggers: %',
            table_count, function_count, trigger_count;
    END IF;
END $$;

-- ====================================================================================================
-- END OF MIGRATION 027 - EMAIL REMINDERS INTEGRATED
-- ====================================================================================================