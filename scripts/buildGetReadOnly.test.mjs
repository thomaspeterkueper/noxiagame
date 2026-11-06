import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Regression gate for #615. Intentionally red until GET mutations are migrated.
// Keep this separate from the stacked city chronicle PRs.
const route = readFileSync(new URL('../app/api/game/build/route.ts', import.meta.url), 'utf8');

function getHandlerBody(source) {
  const start = source.indexOf('export async function GET(');
  assert.notEqual(start, -1, 'GET handler must exist');
  const end = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test('GET building endpoint rejects legacy state-changing actions', () => {
  const get = getHandlerBody(route);
  for (const action of ['start', 'cancel', 'sell']) {
    assert.doesNotMatch(
      get,
      new RegExp("action\\s*===\\s*['\\\"]" + action + "['\\\"]"),
      'GET?action=' + action + ' must not mutate game state; migrate callers to authenticated POST/Core first',
    );
  }
});

test('GET building endpoint does not write directly to game tables', () => {
  const get = getHandlerBody(route);
  assert.doesNotMatch(
    get,
    /\.from\(['"](?:profiles|tile_entities|player_builds)['"]\)[\s\S]{0,250}?\.(?:insert|update|delete|upsert)\(/,
    'GET must not directly mutate credits, entities, or build orders',
  );
});

test('GET handler extraction stops before subsequent exported handlers', () => {
  const sample = [
    'export async function GET() { return 1 }',
    'export async function POST() { return 2 }',
  ].join('\n');
  assert.doesNotMatch(getHandlerBody(sample), /POST/);
});

test('GET keeps read-only build snapshot and sale quotation', () => {
  const get = getHandlerBody(route);
  assert.match(get, /if \(!action\)/, 'existing build snapshot must remain available');
  assert.match(get, /action\s*===\s*['"]sellQuote['"]/, 'read-only sale quote must remain available');
});
