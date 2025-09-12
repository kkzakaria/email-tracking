-- ====================================================================================================
-- MIGRATION 017: Fix fonction schedule_test_reminder sans ON CONFLICT
-- ====================================================================================================
-- Description: Remplace ON CONFLICT par logique IF EXISTS pour éviter l'erreur de contrainte
-- Date: 2025-01-12
-- Bug fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- ====================================================================================================

SET search_path = 'public';

-- Supprimer d'abord l'ancienne fonction pour éviter l'erreur de signature
DROP FUNCTION IF EXISTS schedule_test_reminder(uuid, uuid, boolean);

-- Recrée la fonction schedule_test_reminder sans ON CONFLICT
CREATE OR REPLACE FUNCTION schedule_test_reminder(
    p_tracked_email_id UUID,
    p_user_id UUID,
    p_dry_run BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
    v_settings test_reminder_settings%ROWTYPE;
    v_email RECORD;
    v_next_due_at TIMESTAMPTZ;
    v_template_content TEXT;
    v_reminder_id UUID;
    v_existing_id UUID;
BEGIN
    -- Récupérer les settings utilisateur
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
    
    -- Vérifier si une entrée existe déjà
    SELECT id INTO v_existing_id
    FROM test_email_reminders
    WHERE tracked_email_id = p_tracked_email_id;
    
    IF v_existing_id IS NOT NULL THEN
        -- Mettre à jour l'entrée existante
        UPDATE test_email_reminders SET
            next_reminder_due_at = v_next_due_at,
            template_content = v_template_content,
            dry_run = p_dry_run,
            debug_logs = debug_logs || jsonb_build_array(
                jsonb_build_object(
                    'action', 'updated',
                    'timestamp', NOW(),
                    'next_due_at', v_next_due_at,
                    'dry_run', p_dry_run
                )
            ),
            updated_at = NOW()
        WHERE id = v_existing_id;
        
        v_reminder_id := v_existing_id;
    ELSE
        -- Insérer nouvelle entrée
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
        ) RETURNING id INTO v_reminder_id;
    END IF;
    
    RETURN v_reminder_id;
END;
$$;

-- Validation
DO $$
BEGIN
    RAISE NOTICE 'Migration 017: ✅ Fonction schedule_test_reminder mise à jour sans ON CONFLICT';
END
$$;