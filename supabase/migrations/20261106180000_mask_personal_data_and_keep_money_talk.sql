-- 20261106180000_mask_personal_data_and_keep_money_talk.sql
-- Thomas, 06.11.2026:
--  * „Persönliche Daten von Spielern sollten möglichst überall geixxt sein,
--    genauso E-Mail-Adressen oder anderes, was zu leicht auf Herkunft schließen lässt.“
--  * „Gespräche über echte Währungen oder Krypto sollten zumindest verwahrt bleiben.“
--
-- 1. mask_personal_data(text): E-Mail, Links/Domains, IBAN, Kartennummern,
--    Telefonnummern, @-Namen → „xxx“. Gleiche Regeln wie lib/game/safety/personalData.ts
--    (dort zusätzlich Selbstauskünfte zu Adresse, Geburtsdatum, echtem Namen, Schule, PLZ).
-- 2. Trigger auf allen Feldern, die andere Spieler sehen – auch dort, wo Spieler
--    direkt in die Datenbank schreiben können (Spielername, Freundes-Chat).
--    Thomas (06.11.2026, später): „Es reicht, wenn die Daten nur im sichtbaren Chat
--    geschwärzt sind“; für gesicherte Verdachtsfälle gilt eine Ausnahme. Deshalb:
--    Raum-Chat speichert das Original in `text` (nur Server), geschwärzt ist
--    `shown_text`; der Freundes-Chat ist für Spieler direkt lesbar, sein Original
--    liegt in chat_message_originals (nur Server). Beides fällt unter die
--    14-Tage-Löschung bzw. die Verwahrung von Geldgesprächen.
-- 3. retain_until: Gespräche mit echter Währung, Bezahldiensten oder Krypto werden
--    von der 14-Tage-Löschung ausgenommen und ein Jahr verwahrt (nicht lesbar im
--    Adminbereich, wie alle Spielergespräche).

set search_path to public;

create or replace function public.mask_personal_data(t text)
returns text
language sql
immutable
as $$
  select case when t is null then null else
  regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', 'xxx', 'g'),
    '(https?://|www\.)[^[:space:]]+', 'xxx', 'gi'),
    '\m[[:alnum:]-]+\.(com|de|net|org|io|me|app|gg|ly|tv|at|ch|eu|info|biz|ru|tr|pl|fr|es|it|nl|uk|co)\M(/[^[:space:]]*)?', 'xxx', 'gi'),
    '\m[A-Za-z]{2}[0-9]{2}( ?[A-Za-z0-9]{4}){3,7}( ?[A-Za-z0-9]{1,3})?\M', 'xxx', 'g'),
    '\m([0-9]{4}[ -]?){3}[0-9]{1,7}\M', 'xxx', 'g'),
    '(\+|\m00)[0-9][0-9 /().-]{6,}[0-9]', 'xxx', 'g'),
    '\m0[0-9]{2,5}[ /.-]?[0-9]{3,}([ .-]?[0-9]+)*', 'xxx', 'g'),
    '(^|[[:space:]])@[[:alnum:]_.]{2,}', '\1@xxx', 'g')
  end
$$;

-- Maskiert die als Trigger-Argumente genannten Spalten.
create or replace function public.mask_personal_columns()
returns trigger
language plpgsql
as $$
declare
  j jsonb := to_jsonb(new);
  col text;
begin
  foreach col in array tg_argv loop
    if j ? col and jsonb_typeof(j -> col) = 'string' then
      j := jsonb_set(j, array[col], to_jsonb(public.mask_personal_data(j ->> col)));
    end if;
  end loop;
  new := jsonb_populate_record(new, j);
  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('profiles',              array['username']),
      ('locations',             array['name', 'description']),
      ('ships',                 array['name']),
      ('tile_entities',         array['display_name']),
      ('player_journeys',       array['title']),
      ('venue_events',          array['title', 'note']),
      ('wishes',                array['text']),
      ('service_cases',         array['text']),
      ('credit_transfers',      array['note']),
      ('chat_messages',         array['content']),
      ('player_room_messages',  array['shown_text']),
      ('npc_conversation_log',  array['player_text']),
      ('conversation_reports',  array['comment']),
      ('player_memorials',      array['name', 'place_name']),
      ('npc_player_knowledge',  array['known_player_name'])
    ) as v(tbl, cols)
  loop
    if to_regclass('public.' || spec.tbl) is null then continue; end if;
    execute format('drop trigger if exists mask_personal_data on public.%I', spec.tbl);
    execute format(
      'create trigger mask_personal_data before insert or update on public.%I for each row execute function public.mask_personal_columns(%s)',
      spec.tbl, (select string_agg(quote_literal(c), ', ') from unnest(spec.cols) c));
  end loop;
end;
$$;

-- Originale des Freundes-Chats: nur Server, nur für Schutzfilter und Verdachtsfälle.
create table if not exists public.chat_message_originals (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  content text not null,
  retain_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.chat_message_originals enable row level security;
revoke all on public.chat_message_originals from public, anon, authenticated;
grant select, insert, update, delete on public.chat_message_originals to service_role;

-- 3. Gespräche über echtes Geld verwahren ------------------------------------
alter table public.npc_conversation_log add column if not exists retain_until timestamptz;
alter table public.player_room_messages add column if not exists retain_until timestamptz;

create or replace function public.purge_conversation_raw_text(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
  npc_rows integer;
  room_rows integer;
  report_rows integer;
  claim_rows integer;
begin
  update public.npc_conversation_log l
     set player_text = '', player_norm = '', npc_reply = null, text_purged_at = now()
   where l.created_at < cutoff
     and l.text_purged_at is null
     and (l.retain_until is null or l.retain_until < now())
     and not exists (select 1 from public.admin_profiles a where a.profile_id = l.player_profile_id);
  get diagnostics npc_rows = row_count;

  delete from public.player_room_messages m
   where m.created_at < cutoff
     and (m.retain_until is null or m.retain_until < now())
     and not exists (select 1 from public.admin_profiles a where a.profile_id = m.sender_id);
  get diagnostics room_rows = row_count;

  delete from public.chat_message_originals o
   where o.created_at < cutoff and (o.retain_until is null or o.retain_until < now());

  delete from public.conversation_reports r where r.expires_at < now();
  get diagnostics report_rows = row_count;

  delete from public.npc_learned_claims c
   where not c.established and c.last_heard_at < now() - interval '180 days';
  get diagnostics claim_rows = row_count;

  return jsonb_build_object('npc_turns_purged', npc_rows, 'room_messages_deleted', room_rows,
                            'reports_expired', report_rows, 'claims_forgotten', claim_rows, 'cutoff', cutoff);
end;
$$;
revoke all on function public.purge_conversation_raw_text(integer) from public, anon, authenticated;
grant execute on function public.purge_conversation_raw_text(integer) to service_role;
