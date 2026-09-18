alter table public.scanner_discoveries
  drop constraint if exists scanner_discoveries_confidence_check;

alter table public.scanner_discoveries
  add constraint scanner_discoveries_confidence_check
  check (confidence = any(array['low'::text,'medium'::text,'high'::text]));
