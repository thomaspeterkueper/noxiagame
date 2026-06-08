-- supabase/migrations/004_onboarding.sql
-- Onboarding: Avatar + Flag, persönliche Aufträge (Erstauftrag)

-- 1) Profil-Erweiterung
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Bestehende Accounts (du selbst) überspringen das Onboarding:
UPDATE profiles SET onboarded = true WHERE username IS NOT NULL AND username <> '';
-- Falls dein Account danach trotzdem onboarded=false ist (username leer),
-- entweder so lassen (du siehst das Onboarding einmal selbst — guter Test!)
-- oder manuell: UPDATE profiles SET onboarded = true WHERE id = '<deine-id>';

-- 2) Persönliche Aufträge: NULL = öffentlich (alle), sonst nur dieser Spieler
ALTER TABLE trade_orders
  ADD COLUMN IF NOT EXISTS for_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

COMMENT ON COLUMN trade_orders.for_profile_id IS
  'NULL = öffentlicher Auftrag. Gesetzt = persönlicher Auftrag (z.B. Onboarding-Erstauftrag).';

-- 3) Kontrolle
SELECT id, username, avatar, onboarded FROM profiles;
