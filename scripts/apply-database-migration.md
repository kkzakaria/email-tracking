# Instructions pour Appliquer la Migration 007

## Méthode 1: Via l'interface Supabase Dashboard

1. **Aller sur le Dashboard Supabase** : https://supabase.com/dashboard/project/ystzjenlqgaclfjtszft
2. **Naviguer vers "SQL Editor"**
3. **Créer une nouvelle query**
4. **Copier le contenu de** `supabase/migrations/007_database_reply_detection.sql`
5. **Exécuter la query**

## Méthode 2: Via API (si problème réseau)

Exécuter directement les commandes SQL suivantes dans l'ordre :

```sql
-- 1. Créer la table received_messages
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
    UNIQUE(user_id, message_id)
);

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS idx_received_messages_conversation ON received_messages(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_messages_user_received ON received_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_tracking_conversation_pending ON email_tracking(conversation_id, status) WHERE status = 'PENDING' AND conversation_id IS NOT NULL;

-- 3. Créer la fonction de détection
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

-- 4. Créer le trigger
DROP TRIGGER IF EXISTS trigger_detect_replies ON received_messages;
CREATE TRIGGER trigger_detect_replies
    AFTER INSERT ON received_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_email_replies();

-- 5. Créer les fonctions utilitaires
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
    INSERT INTO received_messages (
        user_id, message_id, internet_message_id, conversation_id,
        subject, from_email, to_email, received_at, body_preview, is_read
    ) VALUES (
        p_user_id, p_message_id, p_internet_message_id, p_conversation_id,
        p_subject, p_from_email, p_to_email, COALESCE(p_received_at, NOW()),
        p_body_preview, p_is_read
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

-- 6. Activer RLS
ALTER TABLE received_messages ENABLE ROW LEVEL SECURITY;

-- 7. Créer la politique RLS
CREATE POLICY "Users can access their own received messages"
ON received_messages FOR ALL
USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- 8. Accorder permissions
GRANT ALL ON received_messages TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_received_message TO authenticated, service_role;
```

## Vérification après Migration

Exécuter pour vérifier :

```sql
-- Vérifier que la table existe
SELECT COUNT(*) FROM received_messages;

-- Vérifier que le trigger est créé
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_detect_replies';

-- Vérifier que les fonctions existent
SELECT proname FROM pg_proc WHERE proname IN ('detect_email_replies', 'sync_received_message');
```

## Test de la Migration

```sql
-- Test d'insertion d'un message fictif
SELECT sync_received_message(
    auth.uid(),
    'test-message-123',
    'test-internet-id',
    'test-conversation-456',
    'Test Subject',
    'sender@test.com',
    'recipient@test.com',
    NOW(),
    'Test body preview',
    false
);
```