// Community scam reports, stored in Cloud Firestore.
//
// Layout:  reports/{targetId}/reporters/{uid}
//   targetId = a_<chainId>_<address>  or  s_<site host>
//   one document per reporter, so each anonymous user counts once per target.
// The count shown to users is a server-side aggregation (getCountFromServer).
// Privacy: only the reported site / counterparty address is stored, never the user's wallet.

import { getFirestore, collection, doc, setDoc, deleteDoc, getDoc, getCountFromServer, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth/web-extension';
import { getNumber, getBoolean } from 'firebase/remote-config';
import { app, rc, rcReady } from './firebase.js';
import { lookupTargets, reportTargets, flagsFromCounts } from './community-rules.js';

const db = getFirestore(app);
const auth = getAuth(app);

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function settings() {
  await rcReady;
  return {
    enabled: getBoolean(rc, 'community_reports_enabled'),
    warnAt: getNumber(rc, 'community_warn_at') || 1,
    dangerAt: getNumber(rc, 'community_danger_at') || 3,
  };
}

/**
 * Look up report counts for the site and addresses in this request.
 * localLevel is the decoder's risk level; reports only escalate to high risk when it is warn or danger.
 */
export async function checkCommunity(deep, localLevel = 'ok') {
  const s = await settings();
  if (!s.enabled) return { enabled: false, flags: [], results: [] };
  const targets = lookupTargets(deep);
  const results = await withTimeout(Promise.all(targets.map(async (target) => {
    const snap = await getCountFromServer(collection(db, 'reports', target.id, 'reporters'));
    return { target, count: snap.data().count };
  })), 6000);
  return { enabled: true, results, flags: flagsFromCounts(results, { ...s, localLevel }), alreadyReported: await hasReported(deep) };
}

async function currentUid() {
  await auth.authStateReady();
  return auth.currentUser?.uid || null;
}

async function hasReported(deep) {
  const uid = await currentUid();
  const first = reportTargets(deep)[0];
  if (!uid || !first) return false;
  return (await getDoc(doc(db, 'reports', first.id, 'reporters', uid))).exists();
}

/** File a report against the site and counterparty. Signs in anonymously on first use. */
export async function reportScam(deep, reason) {
  const targets = reportTargets(deep);
  if (!targets.length) throw new Error('Nothing reportable in this request.');
  const uid = (await currentUid()) || (await signInAnonymously(auth)).user.uid;
  await Promise.all(targets.map((t) => setDoc(doc(db, 'reports', t.id, 'reporters', uid), {
    reason,
    kind: t.kind,
    value: t.value,
    chainId: t.kind === 'address' ? Number(deep.chainId) : null,
    createdAt: serverTimestamp(),
  })));
  return targets.length;
}

/** Remove this user's reports for the request. */
export async function undoReport(deep) {
  const uid = await currentUid();
  if (!uid) return;
  await Promise.all(reportTargets(deep).map((t) => deleteDoc(doc(db, 'reports', t.id, 'reporters', uid))));
}
