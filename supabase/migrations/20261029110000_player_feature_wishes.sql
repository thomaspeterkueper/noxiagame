-- Spielerwünsche aus Gesprächen: Hinweise sammeln, prüfen, erst dann umsetzen.
-- Wunsch Thomas (29.10.2026): „Die Gespräche … sollen helfen, NOXIA besser zu machen –
-- automatische Auswertung und aus den Gesprächen neue Möglichkeiten erzeugen. Wenn jemand
-- sagt, ich kann dies oder das nicht machen, ist es ein Hinweis, dass vielleicht eine
-- Funktion fehlt.“ Und: „Nicht alles, was ein Spieler will, wird umgesetzt. Es muss zur
-- Spielidee passen, ethisch vertretbar sein, nichts, was das Spiel pervertiert … hilft es
-- selbst oder anderen beim Werden, oder schränkt es ein.“
--
-- * npc_conversation_log bekommt den erkannten Hinweis (lib/game/cognition/featureWish.ts).
-- * player_feature_wish_reviews hält die Prüfung je Wunsch (Spielidee, Ethik, Spielraum
--   nach NOXIA-OMNI-0001 und NOXIA-ETHICS-0001). Die tägliche Auswertung empfiehlt
--   (recommendation); umgesetzt wird nur, was Thomas entscheidet (decision, decided_by).
-- * Sicht player_feature_wishes: Wünsche gebündelt, mit Prüfstand.
-- Prüfweg: docs/reviews/spielerwuensche.md

set search_path to public;

alter table public.npc_conversation_log
  add column if not exists wish_kind text check (wish_kind is null or wish_kind in ('blocked', 'missing', 'wish', 'seeking', 'how_to')),
  add column if not exists wish_object text,
  add column if not exists wish_npc_denied boolean;

create index if not exists npc_conversation_log_wish_idx on public.npc_conversation_log(wish_object) where wish_object is not null;

create table if not exists public.player_feature_wish_reviews (
  wish_key        text primary key,            -- Bündel, z. B. 'toilette'
  title           text not null,               -- „Toilette im Lokal“
  matches         text[] not null default '{}',-- wish_object-Muster (ILIKE), die dazugehören
  recommendation  text not null check (recommendation in (
                    'umsetzen',      -- passt, vertretbar, eröffnet Spielraum
                    'vorhanden',     -- gibt es schon; Spieler finden es nicht (Hinweis verbessern)
                    'später',        -- passt, aber nicht jetzt
                    'passt_nicht',   -- passt nicht zur Spielidee
                    'abgelehnt')),   -- ethisch nicht vertretbar oder pervertiert das Spiel
  decision        text check (decision is null or decision in ('umsetzen', 'vorhanden', 'später', 'passt_nicht', 'abgelehnt')),
  game_fit        text,                         -- passt es zur Spielidee? warum
  ethics          text,                         -- ethisch vertretbar? (NOXIA-ETHICS-0001)
  spielraum       jsonb not null default '{}'::jsonb, -- {eigen, fremd, folge, gemein}: eröffnet|bewahrt|verengt|neutral
  becoming        text,                         -- hilft es selbst oder anderen beim Werden, oder schränkt es ein?
  proposal        text,                         -- was konkret gebaut würde
  owner           text,                         -- zuständiges Teilprojekt
  request_ref     text,                         -- Request, sobald freigegeben (z. B. 'population-economy R-22')
  proposed_by     text not null default 'auswertung',
  decided_by      text,                         -- 'thomas'; nur dann gilt decision
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.player_feature_wish_reviews enable row level security;
revoke all on public.player_feature_wish_reviews from anon, authenticated;
grant select, insert, update, delete on public.player_feature_wish_reviews to service_role;

create or replace view public.player_feature_wishes as
with hits as (
  select l.*, r.wish_key
    from public.npc_conversation_log l
    left join lateral (
      select r.wish_key from public.player_feature_wish_reviews r
       where exists (select 1 from unnest(r.matches) m where l.wish_object ilike m)
       order by r.wish_key limit 1
    ) r on true
   where l.wish_object is not null
)
select coalesce(h.wish_key, h.wish_object)                    as wish,
       h.wish_key is not null                                 as reviewed,
       rv.recommendation, rv.decision, rv.title,
       count(*)                                               as mentions,
       count(distinct h.player_profile_id)                    as players,
       count(*) filter (where h.wish_npc_denied)              as npc_denied,
       count(*) filter (where h.topic = 'provocation')        as provocations,
       array_agg(distinct h.wish_kind)                        as kinds,
       (array_agg(left(h.player_text, 140) order by h.created_at desc))[1:3] as examples,
       array_agg(distinct h.location_name) filter (where h.location_name is not null) as places,
       min(h.created_at) as first_at, max(h.created_at) as last_at
  from hits h
  left join public.player_feature_wish_reviews rv on rv.wish_key = h.wish_key
 group by 1, 2, 3, 4, 5
 order by reviewed, players desc, mentions desc, last_at desc;

revoke all on public.player_feature_wishes from anon, authenticated;
grant select on public.player_feature_wishes to service_role;

-- Erste Prüfungen aus den Gesprächen der Testphase. Entschieden ist nur die Toilette
-- (Thomas, 29.10.2026: „hier war es sinnvoll, Toiletten zu ergänzen“); der Rest ist
-- Empfehlung der Auswertung.
insert into public.player_feature_wish_reviews
  (wish_key, title, matches, recommendation, decision, game_fit, ethics, spielraum, becoming, proposal, owner, request_ref, proposed_by, decided_by, decided_at)
values
  ('toilette', 'Toilette im Lokal', array['%toilet%', '%klo%', '%pinkeln%', '%wc%'], 'vorhanden', 'umsetzen',
   'Alltag in einem Haus; gehört zur Lebenswelt, die NOXIA ernst nimmt (Hunger, Durst, Ruhe).',
   'Unbedenklich, solange es Alltag bleibt und nicht zum Witz über Körper wird.',
   '{"eigen":"eröffnet","fremd":"neutral","folge":"neutral","gemein":"eröffnet"}'::jsonb,
   'Hilft beim Werden im Kleinen: Man kann bleiben, statt gehen zu müssen; ein Lokal wird zum Ort, an dem man Zeit verbringt.',
   'Umgesetzt 28.10.2026 als Dienst je Haus (venue_services, R-18). Offen: Spieler finden sie nicht immer – Hinweis im Innenraum.',
   'Gastronomie', 'population-economy R-18', 'auswertung', 'thomas', '2026-10-28'),
  ('cafe-eroeffnen', 'Eigenes Lokal eröffnen', array['%café%eröffn%', '%cafe%eröffn%', '%cafee%', '%lokal%eröffn%', '%bar%eröffn%'], 'vorhanden', null,
   'Kern der Spielidee: Spieler bauen und betreiben Häuser.',
   'Unbedenklich.',
   '{"eigen":"eröffnet","fremd":"eröffnet","folge":"eröffnet","gemein":"eröffnet"}'::jsonb,
   'Eröffnet Arbeit für Bewohner (Personal) und einen Ort der Begegnung.',
   'Gibt es (Bauen, Kauf und Umbau, R-13). Die Figur sollte den Weg nennen können.',
   'Gastronomie', null, 'auswertung', null, null),
  ('raumhafen', 'Zum Raumhafen und ins All', array['%raumhafen%', '%weltraum%', '%mond%fliegen%', '%mars%fliegen%'], 'umsetzen', null,
   'Kern der Spielidee (Kolonisierung). Der Einstieg dorthin ist für Neue schwer zu finden.',
   'Unbedenklich.',
   '{"eigen":"eröffnet","fremd":"neutral","folge":"eröffnet","gemein":"neutral"}'::jsonb,
   'Eröffnet den Weg nach draußen; Hürde ist heute Orientierung, nicht Funktion.',
   'Vorschlag: Mitflug auf Handelsschiffen als Einstieg (R-21 Punkt 4), Figuren nennen Raumhafen und Reisebüro.',
   'Handel/Schiffe', null, 'auswertung', null, null),
  ('kinder-machen', 'Sexuelle Inhalte', array['%kinder mach%', '%sex%'], 'abgelehnt', null,
   'Familie und Nachwuchs der Bewohner sind Teil der Simulation (person_life_state), aber nicht als Spielerhandlung.',
   'Nicht vertretbar als Spielinhalt; das Gespräch war ein Grenztest (provocation) und endet nach drei Versuchen.',
   '{"eigen":"neutral","fremd":"verengt","folge":"verengt","gemein":"verengt"}'::jsonb,
   'Schränkt ein: macht Figuren zu Objekten und das Gespräch zum Grenztest.',
   'Nichts bauen. Die Figur weist respektvoll zurück (bestehender Abbruch beim dritten Grenztest).',
   null, null, 'auswertung', null, null)
on conflict (wish_key) do nothing;

-- Weitere Prüfungen nach dem Nachtrag der Hinweise aus den bisherigen Gesprächen
-- (lib/game/cognition/featureWish.ts über die 67 Spielerzüge der Testphase).
insert into public.player_feature_wish_reviews (wish_key, title, matches, recommendation, game_fit, ethics, spielraum, becoming, proposal, owner)
values
 ('tanz', 'Tanzen sehen oder tanzen', array['%tanz%'], 'vorhanden',
  'Gehört in den Nachtclub (R-19), nicht in die Bücherei. Gewünscht wurde, dass die Bibliothekarin für den Spieler tanzt.',
  'Vertretbar als Ort zum Tanzen. Nicht vertretbar als Vorführung auf Verlangen: Eine Figur ist keine Darbietung für den Spieler.',
  '{"eigen":"eröffnet","fremd":"bewahrt","folge":"neutral","gemein":"eröffnet"}'::jsonb,
  'Tanzen mit anderen eröffnet Begegnung; jemanden zum Tanzen für sich zu drängen verengt den Raum der anderen.',
  'Nichts Neues bauen. Die Figur nennt den Nachtclub; sie lehnt Vorführungen für den Spieler weiter respektvoll ab.',
  'Gastronomie'),
 ('mehr-leute', 'Mehr Menschen am Ort', array['%leute%', '%menschen%', '%einwohner%'], 'umsetzen',
  'Passt: Belebte Orte sind Teil der Spielidee; Mond und Sauerland wirken leer.',
  'Unbedenklich, solange neue Menschen aus der Simulation kommen (Zuzug, Personal) und nicht auf Zuruf erscheinen.',
  '{"eigen":"eröffnet","fremd":"eröffnet","folge":"eröffnet","gemein":"eröffnet"}'::jsonb,
  'Mehr Menschen heißt mehr Beziehungen und mehr Orte, an die man sich wenden kann – der Beziehungsanteil des Spielraums wächst.',
  'Zuzug nach Arbeit und Wohnraum (Personal für Häuser läuft schon, z. B. Akademie und Agentur seit 29.10.2026); Stimmen am Ort, wie viele wohnen.',
  'Bevölkerung und Ökonomie'),
 ('buch', 'Bücher lesen', array['%buch%', '%bücher%', '%lesen%'], 'vorhanden',
  'Gibt es (Bücherei mit Leseecke).', 'Unbedenklich.',
  '{"eigen":"eröffnet","fremd":"neutral","folge":"eröffnet","gemein":"neutral"}'::jsonb,
  'Lesen eröffnet Wissen und Gesprächsstoff.', 'Nichts zu tun.', 'Gastronomie'),
 ('akademie', 'Akademie finden', array['akademie%'], 'vorhanden',
  'Gibt es; Figuren verweisen oft dorthin.', 'Unbedenklich.',
  '{"eigen":"eröffnet","fremd":"neutral","folge":"eröffnet","gemein":"neutral"}'::jsonb,
  'Lernen eröffnet Freischaltungen und jetzt auch eine Prämie.', 'Prüfen, ob der Weg dorthin auf der Karte klar ist (Laufwege der Verhaltensaufzeichnung).', 'Erdkarte')
on conflict (wish_key) do nothing;
