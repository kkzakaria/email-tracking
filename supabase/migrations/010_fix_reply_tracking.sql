-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - FIX REPLY TRACKING
-- ====================================================================================================
-- Migration 010: Correction du tracking des réponses
-- Created: 2025-01-10  
-- Description: Empêche les réponses d'être trackées comme nouveaux emails
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- FUNCTION: Détection améliorée des emails envoyés (sans tracker les réponses)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION detect_sent_emails()
RETURNS TRIGGER AS $$
DECLARE
    existing_tracked RECORD;
    existing_replies INTEGER;
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
    AND message_id = NEW.graph_message_id;

    -- Si l'email n'est pas déjà tracké
    IF NOT FOUND THEN
        
        -- NOUVELLE LOGIQUE: Vérifier s'il existe déjà des emails trackés dans cette conversation
        -- Si oui, ce message est probablement une réponse et ne doit PAS être tracké
        SELECT COUNT(*) INTO existing_replies
        FROM tracked_emails te
        WHERE te.conversation_id = NEW.conversation_id
        AND te.sent_at < COALESCE(NEW.sent_at, NOW()); -- Messages envoyés avant ce message
        
        -- Si il n'y a pas d'emails précédents dans cette conversation, c'est un nouveau thread
        IF existing_replies = 0 THEN
            INSERT INTO tracked_emails (
                message_id,
                internet_message_id,
                conversation_id,
                subject,
                recipient_email,
                sender_email,
                sent_at,
                status
            ) VALUES (
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
            RAISE NOTICE 'Auto-tracked NEW sent email % in conversation %', 
                new_tracked_id, NEW.conversation_id;
        ELSE
            -- C'est probablement une réponse, ne pas tracker
            RAISE NOTICE 'Skipped tracking reply email in conversation % (% existing tracked emails)', 
                NEW.conversation_id, existing_replies;
        END IF;
        
    ELSE
        -- Mettre à jour les informations si nécessaire (email déjà tracké)
        UPDATE tracked_emails 
        SET 
            internet_message_id = COALESCE(NEW.internet_message_id, internet_message_id),
            subject = COALESCE(NEW.subject, subject),
            sender_email = COALESCE(NEW.from_email, sender_email),
            sent_at = COALESCE(NEW.sent_at, sent_at),
            updated_at = NOW()
        WHERE id = existing_tracked.id;

        RAISE NOTICE 'Updated existing tracked email % in conversation %', 
            existing_tracked.id, NEW.conversation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le trigger existe déjà, pas besoin de le recréer
-- Il va automatiquement utiliser la nouvelle version de la fonction

-- Migration 010 completed: Reply tracking fix applied
