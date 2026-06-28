create table if not exists player_learning_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  module_id text not null,
  progress_percent integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  knowledge_awarded integer not null default 0,
  unlock_awarded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, module_id)
);

alter table player_learning_progress enable row level security;

drop policy if exists player_learning_progress_select_own on player_learning_progress;
create policy player_learning_progress_select_own
on player_learning_progress for select
using (auth.uid() = profile_id);

drop policy if exists player_learning_progress_insert_own on player_learning_progress;
create policy player_learning_progress_insert_own
on player_learning_progress for insert
with check (auth.uid() = profile_id);

drop policy if exists player_learning_progress_update_own on player_learning_progress;
create policy player_learning_progress_update_own
on player_learning_progress for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);
