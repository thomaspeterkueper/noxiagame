-- Schriften im Spiel (Thomas, 05.11.2026): Der Wortlaut kommt nur aus buecherwelten;
-- hier steht, was davon wo lesbar ist. Gepflegt im Adminbereich (/admin/buecher).
-- mode: hidden (nicht im Spiel), full (frei lesbar), sample (Leseprobe: die ersten
-- sample_chapters Kapitel, danach Bezugshinweis), teaser (nur Klappentext + Bezugshinweis).
create table if not exists public.reading_releases (
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  kind text not null check (kind in ('text', 'work')),
  place text not null default 'resonance' check (place in ('resonance')),
  mode text not null default 'hidden' check (mode in ('hidden', 'full', 'sample', 'teaser')),
  rubric text check (rubric is null or rubric in ('omnizedenz', 'bewusstsein', 'ethik', 'theologie', 'tiefenwoerter', 'stille')),
  sample_chapters integer not null default 1 check (sample_chapters between 0 and 99),
  sort integer not null default 100,
  purchase_note text check (purchase_note is null or char_length(purchase_note) <= 280),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (place, kind, slug)
);
alter table public.reading_releases enable row level security;
-- Kein direkter Zugriff aus dem Browser: Spiel und Adminbereich lesen über die Server-Routen.
grant all on public.reading_releases to service_role;

-- Erstbestückung: alle vollständigen philosophischen und theologischen Texte und die
-- bisher lesbaren Bücher, nach Fächern; Kurzgeschichte und Brückentext vorerst nicht.
insert into public.reading_releases (slug, kind, place, mode, rubric, sample_chapters, sort) values
  ('philosophie-der-omnizedenz', 'work', 'resonance', 'full', 'omnizedenz', 1, 10),
  ('gott-ist-eine-wolke', 'work', 'resonance', 'full', 'omnizedenz', 1, 20),
  ('partitur-des-ganzen', 'text', 'resonance', 'full', 'omnizedenz', 1, 30),
  ('das-goettliche-spiel-des-bewusstseins', 'text', 'resonance', 'full', 'omnizedenz', 1, 40),
  ('der-erhellte-blick', 'text', 'resonance', 'full', 'omnizedenz', 1, 50),
  ('machiavelli-grenzfall-omnizedenz', 'text', 'resonance', 'full', 'omnizedenz', 1, 60),
  ('die-physik-des-ich', 'work', 'resonance', 'full', 'bewusstsein', 1, 10),
  ('die-verkoerperte-seele', 'work', 'resonance', 'full', 'bewusstsein', 1, 20),
  ('architektur-der-stille', 'text', 'resonance', 'full', 'bewusstsein', 1, 30),
  ('was-bleibt-wenn-alles-zerfallt', 'text', 'resonance', 'full', 'bewusstsein', 1, 40),
  ('wenn-ich-spiele', 'text', 'resonance', 'full', 'bewusstsein', 1, 50),
  ('flanieren', 'text', 'resonance', 'full', 'bewusstsein', 1, 60),
  ('paradoxie-der-ordnung', 'text', 'resonance', 'full', 'ethik', 1, 10),
  ('paradoxon-kreuzende-wege', 'text', 'resonance', 'full', 'ethik', 1, 20),
  ('verdichtung-des-widersachers', 'text', 'resonance', 'full', 'ethik', 1, 30),
  ('tarnfarben', 'text', 'resonance', 'full', 'ethik', 1, 40),
  ('unterdrueckte-stimme', 'text', 'resonance', 'full', 'ethik', 1, 50),
  ('rotkaeppchen', 'text', 'resonance', 'full', 'ethik', 1, 60),
  ('ueber-den-selbstwert', 'text', 'resonance', 'full', 'ethik', 1, 70),
  ('ueber-die-liebe', 'text', 'resonance', 'full', 'ethik', 1, 80),
  ('ueber-niveau', 'text', 'resonance', 'full', 'ethik', 1, 90),
  ('gottesdienst', 'text', 'resonance', 'full', 'theologie', 1, 10),
  ('isaak', 'text', 'resonance', 'full', 'theologie', 1, 20),
  ('was-ist-durch-dich-geschehen', 'text', 'resonance', 'full', 'theologie', 1, 30),
  ('ueber-die-sanftmut', 'text', 'resonance', 'full', 'theologie', 1, 40),
  ('kinder-gottes', 'text', 'resonance', 'full', 'theologie', 1, 50),
  ('agurs-worte-neu-gehoert', 'text', 'resonance', 'full', 'theologie', 1, 60),
  ('han-tiefenwoerter', 'text', 'resonance', 'full', 'tiefenwoerter', 1, 10),
  ('mono-no-aware', 'text', 'resonance', 'full', 'tiefenwoerter', 1, 20),
  ('selbstwert', 'text', 'resonance', 'full', 'tiefenwoerter', 1, 30),
  ('zikkaron', 'text', 'resonance', 'full', 'tiefenwoerter', 1, 40),
  ('erhebe-dich-seele', 'text', 'resonance', 'full', 'stille', 1, 10),
  ('in-deinem-licht', 'text', 'resonance', 'full', 'stille', 1, 20),
  ('die-andere-seite-der-stille', 'text', 'resonance', 'full', 'stille', 1, 30),
  ('ich-erinnere-mich', 'text', 'resonance', 'full', 'stille', 1, 40),
  ('lass-deine-taten-fuer-dich-sprechen', 'text', 'resonance', 'full', 'stille', 1, 50),
  ('der-kreis-der-siegel', 'text', 'resonance', 'full', 'stille', 1, 60),
  ('auv-pa-il', 'text', 'resonance', 'full', 'stille', 1, 70),
  ('aufmerksamkeit', 'text', 'resonance', 'hidden', null, 1, 100),
  ('gedaechtnis-als-zugriffsproblem', 'text', 'resonance', 'hidden', null, 1, 100)
on conflict (place, kind, slug) do nothing;
