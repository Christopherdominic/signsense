import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRequest } from '../src/lib/decoder.js';
import { SAMPLES } from '../src/lib/samples.js';

const run = (k) => decodeRequest(SAMPLES[k].request);
const codes = (r) => r.flags.map((f) => f.code);

test('unlimited approval to unknown spender is danger', () => {
  const r = run('unlimited_usdc');
  assert.equal(r.level, 'danger');
  assert.ok(codes(r).includes('UNLIMITED_APPROVAL'));
  assert.equal(r.ai.token, 'USDC');
});

test('setApprovalForAll is flagged', () => assert.ok(codes(run('nft_all')).includes('APPROVAL_FOR_ALL')));
test('EIP-2612 permit is recognised as an approval', () => assert.ok(codes(run('permit')).includes('GASLESS_PERMIT')));
test('zero-price Seaport listing is danger', () => assert.ok(codes(run('zero_listing')).includes('ZERO_PRICE_LISTING')));
test('SIWE domain mismatch is danger', () => assert.ok(codes(run('siwe_phish')).includes('SIWE_DOMAIN_MISMATCH')));
test('eth_sign is danger', () => assert.equal(run('blind').level, 'danger'));
test('plain send is ok', () => assert.equal(run('safe_send').level, 'ok'));

test('revoke (approve 0) is treated as safe', () => {
  const r = decodeRequest({ method: 'eth_sendTransaction', chainId: 1, origin: 'https://revoke.cash',
    params: [{ to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', data: '0x095ea7b3' + '0'.repeat(24) + '9d3c1e5a7b2f4e6d8c0a1b3d5f7e9a2c4b6d8f01' + '0'.repeat(64) }] });
  assert.equal(r.kind, 'revoke');
  assert.equal(r.level, 'ok');
});

test('known spender downgrades unlimited approval to warn', () => {
  const r = decodeRequest({ method: 'eth_sendTransaction', chainId: 1, origin: 'https://app.uniswap.org',
    params: [{ to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', data: '0x095ea7b3' + '0'.repeat(24) + '000000000022d473030f116ddee9f6b43ac78ba3' + 'f'.repeat(64) }] });
  assert.equal(r.level, 'warn');
});

test('nothing sent to AI contains a full wallet address', () => {
  for (const k of Object.keys(SAMPLES)) {
    assert.doesNotMatch(JSON.stringify(run(k).ai), /0x[a-fA-F0-9]{40}/, `sample ${k} leaks an address to the quick model`);
  }
});

test('deep-check context never includes the user address', () => {
  const user = '0x1111111111111111111111111111111111111111';
  for (const k of Object.keys(SAMPLES)) assert.ok(!JSON.stringify(run(k).deep).toLowerCase().includes(user), k);
});
