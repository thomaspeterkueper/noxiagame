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

test('build completion RPC is not re-granted to browser roles in this migration', () => {
  const signature = 'public.noxia_complete_build\\(uuid,boolean\\)';
  const grants = [...migration.matchAll(
    new RegExp('grant\\s+execute\\s+on\\s+function\\s+' + signature +
      '\\s+to\\s+([^;]+);', 'g'),
  )];
  assert.ok(grants.length > 0, 'expected an explicit EXECUTE grant');
  for (const [, recipients] of grants) {
    const roles = recipients.split(',').map((role) => role.trim().replace(/"/g, ''));
    assert.ok(
      roles.every((role) => role === 'service_role'),
      'noxia_complete_build must not grant EXECUTE to browser roles or PUBLIC',
    );
  }
});

test('build completion wrapper remains server-only and uses the privileged service client', () => {
  const commands = readFileSync(
    new URL('../lib/game/core/commands.ts', import.meta.url),
    'utf8',
  );
  assert.match(commands, /^import ['"]server-only['"]/m);
  assert.match(commands, /import\s*\{\s*createServiceClient\s*\}\s*from\s*['"]@\/lib\/supabase\/service['"]/);
  const completion = commands.match(
    /export async function completeBuildCommand\([^]*?(?=\nexport (?:async )?function |$)/,
  )?.[0];
  assert.ok(completion, 'expected completeBuildCommand wrapper');
  assert.match(completion, /const supabase = createServiceClient\(\)/);
  assert.match(completion, /supabase\.rpc\(['"]noxia_complete_build['"]/);
});
