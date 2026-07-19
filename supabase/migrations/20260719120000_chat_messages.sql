-- supabase/migrations/20260719120000_chat_messages.sql
-- Direktnachrichten zwischen Spielern
-- Erstellt: 19.07.2026

SET search_path TO public;

-- ── chat_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index für schnelles Laden der Konversation zwischen zwei Spielern
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages (
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id),
    created_at DESC
  );

-- Index für ungelesene Nachrichten
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON chat_messages (receiver_id, read_at)
  WHERE read_at IS NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Nur eigene Nachrichten lesen (gesendet oder empfangen)
DROP POLICY IF EXISTS "chat_select_own" ON chat_messages;
CREATE POLICY "chat_select_own"
  ON chat_messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Nur als sich selbst senden
DROP POLICY IF EXISTS "chat_insert_own" ON chat_messages;
CREATE POLICY "chat_insert_own"
  ON chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Nur eigene empfangene Nachrichten als gelesen markieren
DROP POLICY IF EXISTS "chat_update_read" ON chat_messages;
CREATE POLICY "chat_update_read"
  ON chat_messages FOR UPDATE
  USING (receiver_id = auth.uid());

-- Service Role darf alles
DROP POLICY IF EXISTS "chat_service_all" ON chat_messages;
CREATE POLICY "chat_service_all"
  ON chat_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── GRANTS ─────────────────────────────────────────────────────────────────
GRANT ALL ON chat_messages TO service_role;
GRANT ALL ON chat_messages TO authenticated;

-- Kontrolle
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chat_messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;
