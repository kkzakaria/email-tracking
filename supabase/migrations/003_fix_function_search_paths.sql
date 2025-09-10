-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - FUNCTION SECURITY FIX
-- ====================================================================================================
-- Migration 003: Correction des search_path pour sécuriser les fonctions PostgreSQL
-- Created: 2025-01-08
-- Description: Fixe les avertissements de sécurité "Function Search Path Mutable"
-- ====================================================================================================

-- ====================================================================================================
-- PROBLÈME DE SÉCURITÉ
-- ====================================================================================================
-- Les fonctions sans search_path explicite peuvent être vulnérables à des attaques par injection
-- où un attaqueur pourrait créer des objets dans un schéma avec un nom malveillant.
-- La solution est de définir explicitement search_path='public' pour chaque fonction.

-- ====================================================================================================
-- RECRÉATION DES FONCTIONS AVEC SEARCH_PATH SÉCURISÉ
-- ====================================================================================================

-- 1. Fonction de mise à jour des timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER 
   SET search_path = 'public';

-- 2. Fonction de détection automatique des réponses (FONCTION CRITIQUE)
CREATE OR REPLACE FUNCTION detect_email_replies()
RETURNS TRIGGER AS $$
DECLARE
    tracked_email RECORD;
    reply_count INTEGER;
BEGIN
    -- Ne traiter que les messages avec conversation_id
    IF NEW.conversation_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Marquer comme traité immédiatement
    NEW.processed_at = NOW();

    -- Chercher les emails trackés dans cette conversation
    FOR tracked_email IN 
        SELECT te.id, te.subject, te.sent_at
        FROM tracked_emails te
        WHERE te.conversation_id = NEW.conversation_id
        AND te.status = 'PENDING'
        AND NEW.received_at > te.sent_at -- Message reçu après envoi
    LOOP
        
        -- Vérifier s'il n'y a pas déjà une réponse enregistrée
        SELECT COUNT(*) INTO reply_count
        FROM received_messages rm
        WHERE rm.conversation_id = NEW.conversation_id
        AND rm.received_at > tracked_email.sent_at
        AND rm.received_at < NEW.received_at;

        -- Si c'est la première réponse après l'envoi
        IF reply_count = 0 THEN
            -- Mettre à jour le statut de l'email tracké
            UPDATE tracked_emails 
            SET 
                status = 'REPLIED',
                reply_received_at = NEW.received_at,
                reply_detection_method = 'supabase_trigger',
                updated_at = NOW()
            WHERE id = tracked_email.id;

            -- Log de succès
            RAISE NOTICE 'Reply detected for email % in conversation %', 
                tracked_email.id, NEW.conversation_id;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER 
   SET search_path = 'public';

-- 3. Fonction pour enregistrer un message reçu
CREATE OR REPLACE FUNCTION log_received_message(
    p_graph_message_id TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_from_email TEXT DEFAULT NULL,
    p_to_email TEXT DEFAULT NULL,
    p_body_preview TEXT DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO received_messages (
        graph_message_id,
        internet_message_id,
        conversation_id,
        subject,
        from_email,
        to_email,
        body_preview,
        received_at
    ) VALUES (
        p_graph_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_from_email,
        p_to_email,
        p_body_preview,
        p_received_at
    )
    ON CONFLICT (graph_message_id) DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        from_email = EXCLUDED.from_email,
        to_email = EXCLUDED.to_email,
        body_preview = EXCLUDED.body_preview,
        received_at = EXCLUDED.received_at
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER 
   SET search_path = 'public';

-- 4. Fonction pour enregistrer un email tracké
CREATE OR REPLACE FUNCTION log_tracked_email(
    p_message_id TEXT,
    p_subject TEXT,
    p_recipient_email TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_sender_email TEXT DEFAULT NULL,
    p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO tracked_emails (
        message_id,
        internet_message_id,
        conversation_id,
        subject,
        recipient_email,
        sender_email,
        sent_at
    ) VALUES (
        p_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_recipient_email,
        p_sender_email,
        p_sent_at
    )
    ON CONFLICT (message_id) DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        recipient_email = EXCLUDED.recipient_email,
        sender_email = EXCLUDED.sender_email,
        sent_at = EXCLUDED.sent_at
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER 
   SET search_path = 'public';

-- ====================================================================================================
-- RECRÉATION DES TRIGGERS AVEC FONCTIONS SÉCURISÉES
-- ====================================================================================================

-- Les triggers utilisent déjà les bonnes fonctions, mais on s'assure qu'ils pointent vers les versions sécurisées

-- Trigger de mise à jour des timestamps (déjà existants)
-- CREATE TRIGGER update_tracked_emails_updated_at 
--     BEFORE UPDATE ON tracked_emails 
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_subscriptions_updated_at 
--     BEFORE UPDATE ON graph_subscriptions 
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_updated_at_column();

-- Trigger de détection des réponses (déjà existant)
-- CREATE TRIGGER detect_replies_on_message_received
--     BEFORE INSERT ON received_messages
--     FOR EACH ROW
--     EXECUTE FUNCTION detect_email_replies();

-- ====================================================================================================
-- VÉRIFICATION DE LA SÉCURITÉ
-- ====================================================================================================

-- Vérifier que toutes les fonctions ont un search_path défini
DO $$
DECLARE
    func_record RECORD;
    insecure_count INTEGER := 0;
BEGIN
    -- Compter les fonctions sans search_path sécurisé
    FOR func_record IN
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments,
            COALESCE(array_to_string(p.proconfig, ', '), 'NO CONFIG') as config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname IN ('update_updated_at_column', 'detect_email_replies', 'log_received_message', 'log_tracked_email')
    LOOP
        IF func_record.config NOT LIKE '%search_path=public%' THEN
            RAISE WARNING '⚠️ Fonction % n''a pas de search_path sécurisé: %', func_record.function_name, func_record.config;
            insecure_count := insecure_count + 1;
        ELSE
            RAISE NOTICE '✅ Fonction % sécurisée avec search_path=public', func_record.function_name;
        END IF;
    END LOOP;

    IF insecure_count = 0 THEN
        RAISE NOTICE '🔒 Toutes les fonctions sont maintenant sécurisées avec search_path=public';
    ELSE
        RAISE WARNING '⚠️ % fonctions nécessitent encore une correction du search_path', insecure_count;
    END IF;
END $$;

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON FUNCTION update_updated_at_column() IS 
    'Fonction trigger sécurisée pour mise à jour automatique des timestamps - search_path=public';

COMMENT ON FUNCTION detect_email_replies() IS 
    'Fonction critique de détection des réponses via triggers - sécurisée avec search_path=public';

COMMENT ON FUNCTION log_received_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS 
    'Fonction utilitaire Edge Functions pour enregistrement messages - sécurisée avec search_path=public';

COMMENT ON FUNCTION log_tracked_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS 
    'Fonction utilitaire Edge Functions pour enregistrement emails trackés - sécurisée avec search_path=public';

-- ====================================================================================================
-- END OF MIGRATION 003
-- ====================================================================================================