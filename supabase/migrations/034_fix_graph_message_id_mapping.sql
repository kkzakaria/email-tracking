-- ====================================================================================================
-- FIX GRAPH MESSAGE ID MAPPING IN TRIGGERS
-- ====================================================================================================
-- Migration 034: Corriger le mapping des graph_message_id dans les triggers
-- Created: 2025-09-16
-- Description: Assure que graph_message_id est correctement rempli dans tracked_emails
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- 1. CORRIGER LE TRIGGER detect_sent_emails() POUR REMPLIR graph_message_id
-- ====================================================================================================
CREATE OR REPLACE FUNCTION detect_sent_emails()
RETURNS TRIGGER AS $$
DECLARE
    existing_tracked RECORD;
    new_tracked_id UUID;
BEGIN
    -- Ne traiter que les messages avec les données essentielles
    IF NEW.conversation_id IS NULL OR NEW.to_email IS NULL THEN
        -- Marquer comme traité même sans conversation_id
        NEW.processed_at = NOW();
        RETURN NEW;
    END IF;

    -- Marquer comme traité immédiatement
    NEW.processed_at = NOW();

    -- Vérifier s'il y a déjà un email tracké pour cette conversation
    SELECT id, message_id, subject INTO existing_tracked
    FROM tracked_emails
    WHERE conversation_id = NEW.conversation_id
    AND (message_id = NEW.graph_message_id OR graph_message_id = NEW.graph_message_id);

    -- Si l'email n'est pas déjà tracké, l'ajouter automatiquement
    IF NOT FOUND THEN
        INSERT INTO tracked_emails (
            message_id,
            graph_message_id,
            internet_message_id,
            conversation_id,
            subject,
            recipient_email,
            sender_email,
            sent_at,
            status
        ) VALUES (
            NEW.graph_message_id,
            NEW.graph_message_id,
            NEW.internet_message_id,
            NEW.conversation_id,
            NEW.subject,
            NEW.to_email,
            NEW.from_email,
            COALESCE(NEW.sent_at, NOW()),
            'PENDING'
        ) RETURNING id INTO new_tracked_id;

        -- Log de succès
        RAISE NOTICE 'Auto-tracked sent email % in conversation % with graph_message_id %',
            new_tracked_id, NEW.conversation_id, NEW.graph_message_id;
    ELSE
        -- Mettre à jour les informations si nécessaire
        UPDATE tracked_emails
        SET
            graph_message_id = COALESCE(NEW.graph_message_id, graph_message_id),
            internet_message_id = COALESCE(NEW.internet_message_id, internet_message_id),
            subject = COALESCE(NEW.subject, subject),
            sender_email = COALESCE(NEW.from_email, sender_email),
            sent_at = COALESCE(NEW.sent_at, sent_at),
            updated_at = NOW()
        WHERE id = existing_tracked.id;

        RAISE NOTICE 'Updated existing tracked email % in conversation % with graph_message_id %',
            existing_tracked.id, NEW.conversation_id, NEW.graph_message_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- 2. METTRE À JOUR LES EMAILS EXISTANTS AVEC graph_message_id MANQUANT
-- ====================================================================================================

-- Mettre à jour les emails où graph_message_id est null mais message_id existe (legacy)
-- En évitant les conflits avec les emails qui ont déjà ce graph_message_id
UPDATE tracked_emails
SET graph_message_id = message_id
WHERE graph_message_id IS NULL
AND message_id IS NOT NULL
AND message_id LIKE 'AAMkAG%' -- Pattern des IDs Microsoft Graph
AND NOT EXISTS (
    SELECT 1 FROM tracked_emails t2
    WHERE t2.graph_message_id = tracked_emails.message_id
    AND t2.id != tracked_emails.id
);

-- ====================================================================================================
-- 3. VALIDATION ET LOGS
-- ====================================================================================================

DO $$
DECLARE
    updated_count INTEGER;
    null_graph_id_count INTEGER;
    null_message_id_count INTEGER;
BEGIN
    -- Compter les mises à jour
    SELECT COUNT(*) INTO updated_count
    FROM tracked_emails
    WHERE graph_message_id IS NOT NULL AND message_id IS NOT NULL;

    SELECT COUNT(*) INTO null_graph_id_count
    FROM tracked_emails
    WHERE graph_message_id IS NULL;

    SELECT COUNT(*) INTO null_message_id_count
    FROM tracked_emails
    WHERE message_id IS NULL;

    RAISE NOTICE 'Migration 034 completed:';
    RAISE NOTICE '  - Emails with both graph_message_id and message_id: %', updated_count;
    RAISE NOTICE '  - Emails with null graph_message_id: %', null_graph_id_count;
    RAISE NOTICE '  - Emails with null message_id: %', null_message_id_count;

    -- Vérifier que le trigger est en place
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'detect_sent_emails_on_message_sent'
    ) THEN
        RAISE EXCEPTION 'Migration failed: trigger detect_sent_emails_on_message_sent not found';
    END IF;

    RAISE NOTICE 'Trigger detect_sent_emails() updated successfully - graph_message_id mapping fixed';
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 034
-- ====================================================================================================