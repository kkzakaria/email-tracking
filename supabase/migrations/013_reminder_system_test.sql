-- ====================================================================================================
-- MIGRATION 013: Système de relances automatiques - MODE TEST ISOLÉ
-- ====================================================================================================
-- Description: Tables et fonctions pour relances automatiques avec mode test sécurisé
-- Date: 2025-01-12
-- Mode: Test isolé pour debugging sans impact sur production
-- ====================================================================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================================================
-- TABLE: test_reminder_settings (Configuration des relances en mode test)
-- ====================================================================================================
CREATE TABLE test_reminder_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Configuration délais
    default_delay_hours INTEGER DEFAULT 48, -- 48h par défaut avant première relance
    reminder_interval_hours INTEGER DEFAULT 72, -- 72h entre chaque relance
    max_reminders_per_email INTEGER DEFAULT 4, -- Maximum 4 relances
    
    -- Heures de travail
    work_hours_start TIME DEFAULT '08:00:00',
    work_hours_end TIME DEFAULT '18:00:00',
    work_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone TEXT DEFAULT 'Europe/Paris',
    
    -- Configuration globale
    reminder_enabled BOOLEAN DEFAULT false, -- Désactivé par défaut en mode test
    test_mode BOOLEAN DEFAULT true, -- Mode test activé
    
    -- Template par défaut
    default_template TEXT DEFAULT 'Bonjour {{recipient_name}},

J''espère que vous allez bien. Je reviens vers vous concernant mon message du {{sent_date}} au sujet de "{{original_subject}}".

N''ayant pas eu de retour de votre part depuis {{days_elapsed}} jours, je souhaitais m''assurer que vous avez bien reçu mon message et savoir si vous avez besoin d''informations complémentaires.

Merci de votre attention.

Cordialement,
{{sender_name}}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT fk_test_reminder_settings_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(user_id) -- Un seul setting par utilisateur
);

-- Index pour performance
CREATE INDEX idx_test_reminder_settings_user ON test_reminder_settings(user_id);
CREATE INDEX idx_test_reminder_settings_enabled ON test_reminder_settings(reminder_enabled, test_mode);

-- ====================================================================================================
-- TABLE: test_email_reminders (Historique et planning des relances en mode test)
-- ====================================================================================================
CREATE TABLE test_email_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_email_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Informations de relance
    reminder_count INTEGER DEFAULT 0, -- Nombre de relances déjà envoyées
    max_reminders INTEGER DEFAULT 4, -- Limite pour cet email spécifique
    
    -- Planning
    next_reminder_due_at TIMESTAMPTZ, -- Quand envoyer la prochaine relance
    last_reminder_sent_at TIMESTAMPTZ, -- Dernière relance envoyée
    
    -- Status
    status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'COMPLETED')),
    
    -- Template utilisé
    template_content TEXT NOT NULL,
    
    -- Mode test et debug
    test_mode BOOLEAN DEFAULT true,
    debug_logs JSONB DEFAULT '[]'::jsonb, -- Logs détaillés pour debugging
    dry_run BOOLEAN DEFAULT false, -- Simulation sans envoi réel
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT fk_test_email_reminders_tracked_email FOREIGN KEY (tracked_email_id) REFERENCES tracked_emails(id) ON DELETE CASCADE,
    CONSTRAINT fk_test_email_reminders_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes pour performance et queries
CREATE INDEX idx_test_email_reminders_tracked_email ON test_email_reminders(tracked_email_id);
CREATE INDEX idx_test_email_reminders_user ON test_email_reminders(user_id);
CREATE INDEX idx_test_email_reminders_due ON test_email_reminders(next_reminder_due_at) WHERE status = 'SCHEDULED';
CREATE INDEX idx_test_email_reminders_test_mode ON test_email_reminders(test_mode, status);

-- ====================================================================================================
-- TABLE: test_reminder_templates (Templates personnalisés pour relances en mode test)
-- ====================================================================================================
CREATE TABLE test_reminder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Template info
    name TEXT NOT NULL, -- Nom du template (ex: "Relance polie", "Relance urgente")
    template_content TEXT NOT NULL,
    
    -- Configuration
    is_default BOOLEAN DEFAULT false, -- Template par défaut pour l'utilisateur
    is_active BOOLEAN DEFAULT true,
    
    -- Variables disponibles (documentation)
    available_variables TEXT[] DEFAULT ARRAY[
        '{{recipient_name}}',
        '{{sender_name}}',
        '{{original_subject}}',
        '{{sent_date}}',
        '{{days_elapsed}}',
        '{{reminder_count}}'
    ],
    
    -- Mode test
    test_mode BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT fk_test_reminder_templates_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index pour templates
CREATE INDEX idx_test_reminder_templates_user ON test_reminder_templates(user_id);
CREATE INDEX idx_test_reminder_templates_default ON test_reminder_templates(user_id, is_default) WHERE is_default = true;

-- ====================================================================================================
-- FUNCTIONS: Utilitaires pour le système de relances en mode test
-- ====================================================================================================

-- Fonction pour appliquer updated_at automatiquement aux nouvelles tables
CREATE TRIGGER update_test_reminder_settings_updated_at 
    BEFORE UPDATE ON test_reminder_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_email_reminders_updated_at 
    BEFORE UPDATE ON test_email_reminders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_reminder_templates_updated_at 
    BEFORE UPDATE ON test_reminder_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================================================
-- FUNCTION: Identifier les emails candidats pour relances (MODE TEST)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION get_test_emails_for_reminders(
    p_user_id UUID,
    p_test_email_ids UUID[] DEFAULT NULL -- IDs spécifiques pour test isolé
)
RETURNS TABLE(
    tracked_email_id UUID,
    message_id TEXT,
    subject TEXT,
    recipient_email TEXT,
    sent_at TIMESTAMPTZ,
    days_elapsed INTEGER,
    current_reminder_count INTEGER,
    max_reminders INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id as tracked_email_id,
        te.message_id,
        te.subject,
        te.recipient_email,
        te.sent_at,
        EXTRACT(DAY FROM (NOW() - te.sent_at))::INTEGER as days_elapsed,
        COALESCE(ter.reminder_count, 0) as current_reminder_count,
        COALESCE(ter.max_reminders, 4) as max_reminders
    FROM tracked_emails te
    LEFT JOIN test_email_reminders ter ON ter.tracked_email_id = te.id
    LEFT JOIN test_reminder_settings trs ON trs.user_id = p_user_id
    WHERE 
        te.status = 'PENDING'
        AND (p_test_email_ids IS NULL OR te.id = ANY(p_test_email_ids)) -- Filtrage pour test isolé
        AND (ter.reminder_count IS NULL OR ter.reminder_count < COALESCE(ter.max_reminders, trs.max_reminders_per_email, 4))
        AND te.sent_at < (NOW() - INTERVAL '1 hour' * COALESCE(trs.default_delay_hours, 48))
    ORDER BY te.sent_at ASC;
END;
$$;

-- ====================================================================================================
-- FUNCTION: Vérifier si nous sommes dans les heures de travail (MODE TEST)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION is_test_working_hours(
    p_user_id UUID,
    p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_settings RECORD;
    v_local_time TIMESTAMPTZ;
    v_current_day TEXT;
    v_current_time TIME;
BEGIN
    -- Récupérer les paramètres utilisateur
    SELECT work_hours_start, work_hours_end, work_days, timezone
    INTO v_settings
    FROM test_reminder_settings 
    WHERE user_id = p_user_id;
    
    -- Si pas de settings, utiliser les valeurs par défaut
    IF v_settings IS NULL THEN
        v_settings.work_hours_start := '08:00:00'::TIME;
        v_settings.work_hours_end := '18:00:00'::TIME;
        v_settings.work_days := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        v_settings.timezone := 'Europe/Paris';
    END IF;
    
    -- Convertir vers le timezone utilisateur
    v_local_time := p_check_time AT TIME ZONE v_settings.timezone;
    
    -- Obtenir le jour de la semaine
    v_current_day := LOWER(TO_CHAR(v_local_time, 'Day'));
    v_current_day := TRIM(v_current_day);
    
    -- Vérifier si c'est un jour de travail
    IF NOT (v_current_day = ANY(v_settings.work_days)) THEN
        RETURN FALSE;
    END IF;
    
    -- Obtenir l'heure actuelle
    v_current_time := v_local_time::TIME;
    
    -- Vérifier si c'est dans les heures de travail
    RETURN v_current_time BETWEEN v_settings.work_hours_start AND v_settings.work_hours_end;
END;
$$;

-- ====================================================================================================
-- FUNCTION: Créer ou mettre à jour une relance programmée (MODE TEST)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION schedule_test_reminder(
    p_user_id UUID,
    p_tracked_email_id UUID,
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_reminder_id UUID;
    v_settings RECORD;
    v_email RECORD;
    v_next_due_at TIMESTAMPTZ;
    v_template_content TEXT;
BEGIN
    -- Récupérer les paramètres utilisateur
    SELECT * INTO v_settings 
    FROM test_reminder_settings 
    WHERE user_id = p_user_id;
    
    -- Si pas de settings, créer avec valeurs par défaut
    IF v_settings IS NULL THEN
        INSERT INTO test_reminder_settings (user_id) 
        VALUES (p_user_id) 
        RETURNING * INTO v_settings;
    END IF;
    
    -- Récupérer les informations de l'email
    SELECT te.*, COALESCE(ter.reminder_count, 0) as current_count
    INTO v_email
    FROM tracked_emails te
    LEFT JOIN test_email_reminders ter ON ter.tracked_email_id = te.id
    WHERE te.id = p_tracked_email_id;
    
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Email tracké non trouvé: %', p_tracked_email_id;
    END IF;
    
    -- Calculer la prochaine date de relance
    IF v_email.current_count = 0 THEN
        -- Première relance : sent_at + default_delay_hours
        v_next_due_at := v_email.sent_at + INTERVAL '1 hour' * v_settings.default_delay_hours;
    ELSE
        -- Relances suivantes : dernière relance + interval
        v_next_due_at := NOW() + INTERVAL '1 hour' * v_settings.reminder_interval_hours;
    END IF;
    
    -- Template content
    v_template_content := v_settings.default_template;
    
    -- Insérer ou mettre à jour la relance
    INSERT INTO test_email_reminders (
        tracked_email_id,
        user_id,
        reminder_count,
        max_reminders,
        next_reminder_due_at,
        template_content,
        test_mode,
        dry_run,
        debug_logs
    ) VALUES (
        p_tracked_email_id,
        p_user_id,
        v_email.current_count,
        v_settings.max_reminders_per_email,
        v_next_due_at,
        v_template_content,
        true, -- Mode test toujours activé
        p_dry_run,
        jsonb_build_array(
            jsonb_build_object(
                'action', 'scheduled',
                'timestamp', NOW(),
                'next_due_at', v_next_due_at,
                'dry_run', p_dry_run
            )
        )
    )
    ON CONFLICT (tracked_email_id) DO UPDATE SET
        next_reminder_due_at = EXCLUDED.next_reminder_due_at,
        template_content = EXCLUDED.template_content,
        dry_run = EXCLUDED.dry_run,
        debug_logs = test_email_reminders.debug_logs || EXCLUDED.debug_logs,
        updated_at = NOW()
    RETURNING id INTO v_reminder_id;
    
    RETURN v_reminder_id;
END;
$$;

-- ====================================================================================================
-- VIEWS: Monitoring et debugging pour le mode test
-- ====================================================================================================

-- Vue des relances de test planifiées
CREATE OR REPLACE VIEW test_reminder_queue AS
SELECT 
    ter.id,
    ter.tracked_email_id,
    te.subject,
    te.recipient_email,
    te.sent_at,
    ter.reminder_count,
    ter.max_reminders,
    ter.next_reminder_due_at,
    ter.status,
    ter.dry_run,
    ter.test_mode,
    EXTRACT(EPOCH FROM (ter.next_reminder_due_at - NOW()))/3600 as hours_until_due
FROM test_email_reminders ter
JOIN tracked_emails te ON te.id = ter.tracked_email_id
WHERE ter.status = 'SCHEDULED'
ORDER BY ter.next_reminder_due_at ASC;

-- Vue des statistiques de test
CREATE OR REPLACE VIEW test_reminder_stats AS
SELECT 
    COUNT(*) as total_reminders,
    COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
    COUNT(CASE WHEN dry_run = true THEN 1 END) as dry_runs,
    COUNT(CASE WHEN test_mode = true THEN 1 END) as test_mode_count
FROM test_email_reminders;

-- ====================================================================================================
-- GRANTS: Permissions pour les Edge Functions en mode test
-- ====================================================================================================

-- Grant permissions pour le service role (Edge Functions)
GRANT ALL ON test_reminder_settings TO service_role;
GRANT ALL ON test_email_reminders TO service_role;
GRANT ALL ON test_reminder_templates TO service_role;
GRANT EXECUTE ON FUNCTION get_test_emails_for_reminders TO service_role;
GRANT EXECUTE ON FUNCTION is_test_working_hours TO service_role;
GRANT EXECUTE ON FUNCTION schedule_test_reminder TO service_role;

-- Grant permissions pour authenticated role (utilisateurs connectés)
GRANT SELECT, INSERT, UPDATE ON test_reminder_settings TO authenticated;
GRANT SELECT ON test_email_reminders TO authenticated;
GRANT SELECT ON test_reminder_templates TO authenticated;
GRANT SELECT ON test_reminder_queue TO authenticated;
GRANT SELECT ON test_reminder_stats TO authenticated;

-- ====================================================================================================
-- COMMENTS: Documentation du système de test
-- ====================================================================================================

COMMENT ON TABLE test_reminder_settings IS 'Configuration des relances automatiques en mode test isolé';
COMMENT ON TABLE test_email_reminders IS 'Historique et planning des relances en mode test avec debugging';
COMMENT ON TABLE test_reminder_templates IS 'Templates personnalisés pour relances en mode test';

COMMENT ON FUNCTION get_test_emails_for_reminders IS 'Identifie les emails candidats pour relances en mode test isolé';
COMMENT ON FUNCTION is_test_working_hours IS 'Vérifie si nous sommes dans les heures de travail configurées';
COMMENT ON FUNCTION schedule_test_reminder IS 'Programme une relance en mode test avec options dry-run';

COMMENT ON VIEW test_reminder_queue IS 'Vue des relances planifiées pour debugging';
COMMENT ON VIEW test_reminder_stats IS 'Statistiques des relances en mode test';

-- ====================================================================================================
-- END OF MIGRATION 013 - TEST MODE
-- ====================================================================================================