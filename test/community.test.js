import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRequest } from '../src/lib/decoder.js';
import { SAMPLES } from '../src/lib/samples.js';
import { lookupTargets, reportTargets, flagsFromCounts } from '../src/lib/community-rules.js';

const USER = '0x1111111111111111111111111111111111111111';
const deepOf = (k) => decodeRequest(SAMPLES[k].request).deep;

test('lookup covers the site and the spender', () => {
  const ids = lookupTargets(deepOf('unlimited_usdc')).map((t) => t.id);
  assert.ok(ids.includes('s_claim-usdc-rewards.xyz'));
  assert.ok(ids.includes('a_1_0x9d3c1e5a7b2f4e6d8c0a1b3d5f7e9a2c4b6d8f01'));
});

test('well-known tokens are never reportable', () => {
  const values = reportTargets(deepOf('unlimited_usdc')).map((t) => t.value);
  assert.ok(!values.includes('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), 'USDC must not be reportable');
});

test("reports never target the user's own address", () => {
  for (const k of Object.keys(SAMPLES)) {
    assert.ok(!reportTargets(deepOf(k)).some((t) => t.value === USER), k);
  }
});

test('ids match the Firestore rules pattern', () => {
  const re = /^(a_[0-9]{1,12}_0x[0-9a-f]{40}|s_[a-z0-9.-]{1,253}(:[0-9]{1,5})?)$/;
  for (const k of Object.keys(SAMPLES)) for (const t of lookupTargets(deepOf(k))) assert.match(t.id, re, `${k}: ${t.id}`);
});

test('report counts become warn / danger flags', () => {
  const target = { label: 'Spender 0x9d3c…8f01', known: false };
  const risky = { localLevel: 'danger' };
  assert.deepEqual(flagsFromCounts([{ target, count: 0 }], risky), []);
  assert.equal(flagsFromCounts([{ target, count: 1 }], risky)[0].level, 'warn');
  assert.equal(flagsFromCounts([{ target, count: 3 }], risky)[0].level, 'danger');
  assert.equal(flagsFromCounts([{ target, count: 3 }], { localLevel: 'warn' })[0].level, 'danger');
  assert.deepEqual(flagsFromCounts([{ target: { ...target, known: true }, count: 9 }], risky), []);
});

test('reports alone never mark a request high risk', () => {
  const target = { label: 'Site example.com', known: false };
  for (const localLevel of ['ok', 'info', undefined]) {
    const flags = flagsFromCounts([{ target, count: 500 }], { localLevel });
    assert.equal(flags.length, 1);
    assert.equal(flags[0].level, 'warn', `localLevel=${localLevel}`);
  }
});

test('a real drainer demo still turns red with enough reports', () => {
  const d = decodeRequest(SAMPLES.unlimited_usdc.request);
  const results = lookupTargets(d.deep).map((t) => ({ target: t, count: 3 }));
  assert.ok(flagsFromCounts(results, { localLevel: d.level }).some((f) => f.level === 'danger'));
});
