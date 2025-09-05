-- Migration pour améliorer la détection des réponses avec conversation tracking

-- Ajouter conversation_id à email_tracking pour un matching plus précis
ALTER TABLE email_tracking 
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS internet_message_id TEXT;

-- Créer des index pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_email_tracking_conversation_id ON email_tracking(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_internet_message_id ON email_tracking(internet_message_id);

-- Ajouter des colonnes pour améliorer le tracking des réponses
ALTER TABLE email_tracking
ADD COLUMN IF NOT EXISTS reply_detection_method TEXT DEFAULT 'subject_matching',
ADD COLUMN IF NOT EXISTS last_sync_check TIMESTAMPTZ DEFAULT NOW();

-- Commenter les nouvelles colonnes
COMMENT ON COLUMN email_tracking.conversation_id IS 'Microsoft Graph conversation ID for precise reply detection';
COMMENT ON COLUMN email_tracking.internet_message_id IS 'Internet Message-ID for cross-platform email matching';
COMMENT ON COLUMN email_tracking.reply_detection_method IS 'Method used to detect reply: subject_matching, conversation_id, sync_check';
COMMENT ON COLUMN email_tracking.last_sync_check IS 'Last time this email was checked during synchronization';

-- Créer une fonction pour nettoyer les anciens enregistrements
CREATE OR REPLACE FUNCTION cleanup_old_email_tracking(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_tracking 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old
    AND status IN ('REPLIED', 'STOPPED', 'EXPIRED');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Créer une fonction pour détecter les réponses par conversation
CREATE OR REPLACE FUNCTION detect_replies_by_conversation()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER := 0;
    tracking_record email_tracking%ROWTYPE;
BEGIN
    -- Parcourir tous les emails en PENDING qui ont un conversation_id
    FOR tracking_record IN
        SELECT * FROM email_tracking
        WHERE status = 'PENDING'
        AND conversation_id IS NOT NULL
        AND conversation_id != ''
    LOOP
        -- Vérifier s'il y a des réponses dans webhook_events
        -- Cette logique sera implémentée côté application
        -- pour accéder aux données Microsoft Graph
        NULL;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Ajouter des permissions
GRANT EXECUTE ON FUNCTION cleanup_old_email_tracking(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_replies_by_conversation() TO authenticated;

-- Mise à jour des RLS policies pour inclure les nouvelles colonnes
-- (Les policies existantes couvrent déjà ces colonnes via SELECT *)

-- Ajouter une vue pour le monitoring des réponses
CREATE OR REPLACE VIEW email_tracking_with_reply_stats AS
SELECT 
    et.*,
    CASE 
        WHEN et.status = 'REPLIED' THEN 'Réponse reçue'
        WHEN et.status = 'PENDING' AND et.created_at < NOW() - INTERVAL '7 days' THEN 'Pas de réponse (>7j)'
        WHEN et.status = 'PENDING' THEN 'En attente de réponse'
        ELSE et.status
    END as reply_status_description,
    CASE 
        WHEN et.reply_received_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (et.reply_received_at::timestamp - et.sent_at::timestamp)) / 3600
        ELSE NULL
    END as response_time_hours
FROM email_tracking et;

-- Permissions pour la vue
GRANT SELECT ON email_tracking_with_reply_stats TO authenticated;

-- Créer un index composé pour les requêtes de synchronisation
CREATE INDEX IF NOT EXISTS idx_email_tracking_sync_status 
ON email_tracking(status, last_sync_check, conversation_id) 
WHERE status = 'PENDING';

-- Documentation
COMMENT ON FUNCTION cleanup_old_email_tracking(INTEGER) IS 'Nettoie les anciens emails trackés répondus/arrêtés après X jours';
COMMENT ON FUNCTION detect_replies_by_conversation() IS 'Détecte les réponses en utilisant les conversation IDs (implémentation côté app)';
COMMENT ON VIEW email_tracking_with_reply_stats IS 'Vue enrichie avec statistiques de réponse et temps de réaction';