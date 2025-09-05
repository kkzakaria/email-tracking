-- Migration 007: Détection automatique des réponses au niveau base de données
-- Créé le: 2025-09-05
-- Description: Triggers et fonctions pour détecter automatiquement les réponses

-- Table pour stocker les messages reçus depuis Microsoft Graph
CREATE TABLE IF NOT EXISTS received_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    internet_message_id TEXT,
    conversation_id TEXT,
    subject TEXT,
    from_email TEXT,
    to_email TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    body_preview TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index pour performance
    UNIQUE(user_id, message_id)
);

-- Index pour optimiser les requêtes de détection
CREATE INDEX IF NOT EXISTS idx_received_messages_conversation ON received_messages(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_messages_user_received ON received_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_tracking_conversation_pending ON email_tracking(conversation_id, status) WHERE status = 'PENDING' AND conversation_id IS NOT NULL;

-- Fonction pour détecter automatiquement les réponses
CREATE OR REPLACE FUNCTION detect_email_replies()
RETURNS TRIGGER AS $$
DECLARE
    tracked_email RECORD;
    reply_count INTEGER;
BEGIN
    -- Ne traiter que les nouveaux messages avec conversation_id
    IF NEW.conversation_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Chercher les emails trackés dans cette conversation
    FOR tracked_email IN 
        SELECT et.id, et.subject, et.sent_at, et.user_id
        FROM email_tracking et
        WHERE et.conversation_id = NEW.conversation_id
        AND et.status = 'PENDING'
        AND et.user_id = NEW.user_id
        AND NEW.received_at > et.sent_at -- Message reçu après envoi
    LOOP
        
        -- Vérifier s'il n'y a pas déjà une réponse enregistrée pour cet email
        SELECT COUNT(*) INTO reply_count
        FROM received_messages rm
        WHERE rm.conversation_id = NEW.conversation_id
        AND rm.user_id = NEW.user_id
        AND rm.received_at > tracked_email.sent_at
        AND rm.received_at < NEW.received_at;

        -- Si c'est la première réponse après l'envoi
        IF reply_count = 0 THEN
            -- Mettre à jour le statut de l'email tracké
            UPDATE email_tracking 
            SET 
                status = 'REPLIED',
                reply_received_at = NEW.received_at,
                reply_detection_method = 'database_trigger',
                updated_at = NOW()
            WHERE id = tracked_email.id;

            -- Log de la détection
            RAISE NOTICE 'Reply detected for email % (%) - conversation %', 
                tracked_email.id, tracked_email.subject, NEW.conversation_id;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour détecter automatiquement les réponses
DROP TRIGGER IF EXISTS trigger_detect_replies ON received_messages;
CREATE TRIGGER trigger_detect_replies
    AFTER INSERT ON received_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_email_replies();

-- Fonction pour synchroniser les messages depuis Microsoft Graph
CREATE OR REPLACE FUNCTION sync_received_message(
    p_user_id UUID,
    p_message_id TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_from_email TEXT DEFAULT NULL,
    p_to_email TEXT DEFAULT NULL,
    p_received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_body_preview TEXT DEFAULT NULL,
    p_is_read BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    -- Insérer ou mettre à jour le message reçu
    INSERT INTO received_messages (
        user_id,
        message_id,
        internet_message_id,
        conversation_id,
        subject,
        from_email,
        to_email,
        received_at,
        body_preview,
        is_read
    ) VALUES (
        p_user_id,
        p_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_from_email,
        p_to_email,
        COALESCE(p_received_at, NOW()),
        p_body_preview,
        p_is_read
    )
    ON CONFLICT (user_id, message_id) 
    DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        from_email = EXCLUDED.from_email,
        to_email = EXCLUDED.to_email,
        received_at = EXCLUDED.received_at,
        body_preview = EXCLUDED.body_preview,
        is_read = EXCLUDED.is_read,
        updated_at = NOW()
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour traitement batch des messages
CREATE OR REPLACE FUNCTION batch_sync_received_messages(
    p_user_id UUID,
    p_messages JSONB
)
RETURNS TABLE(processed_count INTEGER, replied_count INTEGER) AS $$
DECLARE
    message_data JSONB;
    initial_replied_count INTEGER;
    final_replied_count INTEGER;
    processed INTEGER := 0;
BEGIN
    -- Compter les réponses initiales
    SELECT COUNT(*) INTO initial_replied_count
    FROM email_tracking 
    WHERE user_id = p_user_id AND status = 'REPLIED';

    -- Traiter chaque message
    FOR message_data IN SELECT * FROM jsonb_array_elements(p_messages)
    LOOP
        PERFORM sync_received_message(
            p_user_id,
            message_data->>'message_id',
            message_data->>'internet_message_id',
            message_data->>'conversation_id',
            message_data->>'subject',
            message_data->>'from_email',
            message_data->>'to_email',
            (message_data->>'received_at')::TIMESTAMP WITH TIME ZONE,
            message_data->>'body_preview',
            (message_data->>'is_read')::BOOLEAN
        );
        processed := processed + 1;
    END LOOP;

    -- Compter les réponses après traitement
    SELECT COUNT(*) INTO final_replied_count
    FROM email_tracking 
    WHERE user_id = p_user_id AND status = 'REPLIED';

    RETURN QUERY SELECT processed, final_replied_count - initial_replied_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour les statistiques de détection
CREATE OR REPLACE VIEW email_detection_stats AS
SELECT 
    et.user_id,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN et.status = 'REPLIED' THEN 1 END) as replied_emails,
    COUNT(CASE WHEN et.status = 'PENDING' THEN 1 END) as pending_emails,
    COUNT(CASE WHEN et.conversation_id IS NOT NULL THEN 1 END) as with_conversation_id,
    COUNT(CASE WHEN et.reply_detection_method = 'database_trigger' THEN 1 END) as detected_by_trigger,
    AVG(EXTRACT(EPOCH FROM (et.reply_received_at - et.sent_at))/3600) as avg_reply_time_hours
FROM email_tracking et
GROUP BY et.user_id;

-- Fonction de diagnostic pour un utilisateur
CREATE OR REPLACE FUNCTION diagnose_user_tracking(p_user_id UUID)
RETURNS TABLE(
    metric TEXT,
    value BIGINT,
    description TEXT
) AS $$
BEGIN
    -- Emails totaux
    RETURN QUERY 
    SELECT 
        'total_emails'::TEXT,
        COUNT(*)::BIGINT,
        'Nombre total d''emails trackés'::TEXT
    FROM email_tracking WHERE user_id = p_user_id;

    -- Emails avec conversation_id
    RETURN QUERY
    SELECT 
        'with_conversation_id'::TEXT,
        COUNT(*)::BIGINT,
        'Emails avec conversation_id (requis pour détection)'::TEXT
    FROM email_tracking 
    WHERE user_id = p_user_id AND conversation_id IS NOT NULL;

    -- Réponses détectées par trigger
    RETURN QUERY
    SELECT 
        'detected_by_trigger'::TEXT,
        COUNT(*)::BIGINT,
        'Réponses détectées automatiquement par la DB'::TEXT
    FROM email_tracking 
    WHERE user_id = p_user_id AND reply_detection_method = 'database_trigger';

    -- Messages reçus synchronisés
    RETURN QUERY
    SELECT 
        'received_messages'::TEXT,
        COUNT(*)::BIGINT,
        'Messages reçus synchronisés dans la DB'::TEXT
    FROM received_messages WHERE user_id = p_user_id;

    -- Conversations actives
    RETURN QUERY
    SELECT 
        'active_conversations'::TEXT,
        COUNT(DISTINCT conversation_id)::BIGINT,
        'Conversations avec emails en attente'::TEXT
    FROM email_tracking 
    WHERE user_id = p_user_id 
    AND status = 'PENDING' 
    AND conversation_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activer RLS sur la nouvelle table
ALTER TABLE received_messages ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour received_messages
CREATE POLICY "Users can access their own received messages"
ON received_messages
FOR ALL
USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
);

-- Permissions pour les fonctions
GRANT EXECUTE ON FUNCTION sync_received_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION batch_sync_received_messages(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION diagnose_user_tracking(UUID) TO authenticated, service_role;

-- Permissions sur les tables
GRANT ALL ON received_messages TO authenticated, service_role;
GRANT SELECT ON email_detection_stats TO authenticated, service_role;

-- Commentaires pour documentation
COMMENT ON TABLE received_messages IS 'Messages reçus synchronisés depuis Microsoft Graph pour détection automatique des réponses';
COMMENT ON FUNCTION detect_email_replies() IS 'Trigger function qui détecte automatiquement les réponses et met à jour email_tracking';
COMMENT ON FUNCTION sync_received_message IS 'Fonction pour synchroniser un message reçu depuis Microsoft Graph';
COMMENT ON FUNCTION batch_sync_received_messages IS 'Fonction pour synchroniser plusieurs messages en batch avec comptage des réponses détectées';
COMMENT ON VIEW email_detection_stats IS 'Vue avec statistiques de détection des réponses par utilisateur';