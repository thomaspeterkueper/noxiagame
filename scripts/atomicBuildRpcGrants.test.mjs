import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260910081500_atomic_game_commands.sql', import.meta.url),
  'utf8',
).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase();

test('build completion RPC is revoked from browser roles and granted to service_role', () => {
  const signature = 'public.noxia_complete_build(uuid,boolean)';
  const revoke = new RegExp(
    'revoke\\s+all\\s+on\\s+function\\s+' +
      signature.replace(/[().]/g, '\\$&') +
      '\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;',
  );
  const grant = new RegExp(
    'grant\\s+execute\\s+on\\s+function\\s+' +
      signature.replace(/[().]/g, '\\$&') +
      '\\s+to\\s+service_role\\s*;',
  );
  assert.match(migration, revoke);
  assert.match(migration, grant);
});
