// Pure helpers for community scam reports (no Firebase here, so they are unit-tested).
import { isKnownAddress, short } from './decoder.js';

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const HOST = /^[a-z0-9.-]{1,253}(:[0-9]{1,5})?$/;
export const REASONS = {
  drainer: 'Wallet drainer / stole funds',
  phishing: 'Phishing / fake website',
  fake_airdrop: 'Fake airdrop or mint',
  other: 'Other scam',
};

export const addressId = (chainId, a) => `a_${Number(chainId)}_${a.toLowerCase()}`;
export const siteId = (host) => `s_${host.toLowerCase()}`;

/** Everything worth looking up for this request: the site plus any counterparty addresses. */
export function lookupTargets(deep) {
  const out = [];
  const host = String(deep.site || '').toLowerCase();
  if (HOST.test(host)) out.push({ id: siteId(host), kind: 'site', value: host, label: `Site ${host}` });
  const seen = new Set();
  for (const [role, a] of [['spender', deep.spender], ['contract', deep.contract], ['contract', deep.verifyingContract]]) {
    if (!a || !ADDR.test(a) || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push({ id: addressId(deep.chainId, a), kind: 'address', role, value: a.toLowerCase(), label: `${role === 'spender' ? 'Spender' : 'Address'} ${short(a)}`, known: isKnownAddress(deep.chainId, a) });
  }
  return out;
}

/** What a user's report is filed against: the site and the counterparty, never well-known tokens/protocols. */
export function reportTargets(deep) {
  return lookupTargets(deep).filter((t) => !t.known);
}

/**
 * Turn report counts into risk flags.
 *
 * Anonymous accounts are cheap, so reports alone can only ever warn. A request is
 * raised to high risk only when the reports agree with a local risk check
 * (localLevel 'warn' or 'danger', e.g. an unlimited approval or an unknown spender).
 * That way fake reports can't push a harmless request, or a legitimate site, to red.
 */
export function flagsFromCounts(results, { warnAt = 1, dangerAt = 3, localLevel = 'ok' } = {}) {
  const corroborated = localLevel === 'warn' || localLevel === 'danger';
  return results
    .filter((r) => r.count >= warnAt && !r.target.known)
    .map((r) => {
      const n = `${r.count} SignSense user${r.count === 1 ? '' : 's'}`;
      const danger = r.count >= dangerAt && corroborated;
      return {
        level: danger ? 'danger' : 'warn',
        code: 'COMMUNITY_REPORTED',
        text: danger
          ? `${r.target.label} has been reported as a scam by ${n}, and the risk checks above agree.`
          : `${r.target.label} has been reported as a scam by ${n}.`,
      };
    });
}
