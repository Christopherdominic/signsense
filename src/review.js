import { decodeRequest } from './lib/decoder.js';
import { SAMPLES } from './lib/samples.js';
import { checkCommunity, reportScam, undoReport } from './lib/community.js';
import { REASONS, reportTargets } from './lib/community-rules.js';
import { explainQuick, deepCheck, deviceAvailability, downloadDeviceModel, getSettings, InferenceMode } from './lib/ai.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};
const RANK = { ok: 0, warn: 1, danger: 2 };
const VERDICT_LEVEL = { looks_safe: 'ok', be_careful: 'warn', likely_scam: 'danger' };
const KICKER = { ok: 'Looks normal', warn: 'Be careful', danger: 'High risk: likely a scam' };

const params = new URLSearchParams(location.search);
const id = params.get('id');
const demoKey = params.get('demo');

let decoded;
let level = 'ok';
let communityFlags = [];

async function loadRequest() {
  if (demoKey) return SAMPLES[demoKey]?.request;
  const key = `req:${id}`;
  return (await chrome.storage.local.get(key))[key];
}

function setLevel(next) {
  level = next;
  $('banner').className = `banner ${level}`;
  $('kicker').textContent = KICKER[level];
  document.body.className = `level-${level}`;
  $('ack-wrap').hidden = level !== 'danger';
  $('approve').disabled = level === 'danger' && !$('ack').checked;
  $('approve').textContent = level === 'danger' ? 'Continue anyway' : 'Continue to wallet';
}

function renderDecoded(d) {
  $('site').textContent = d.facts.find((f) => f.label === 'Site')?.value || '';
  $('title').textContent = d.title;
  $('facts').replaceChildren(...d.facts.flatMap((f) => [el('dt', { textContent: f.label }), el('dd', { textContent: f.value })]));
  renderFlags();
  setLevel(d.level);
}

function renderFlags() {
  const all = [...communityFlags, ...decoded.flags];
  $('flags').replaceChildren(
    ...(all.length ? all.map((f) => el('li', { className: f.level, textContent: f.text })) : [el('li', { className: 'none', textContent: 'No known risk patterns found.' })]),
  );
}

// ---------- Community reports (Firestore) ----------

async function runCommunity() {
  const status = $('community-status');
  try {
    const r = await checkCommunity(decoded.deep, decoded.level);
    if (!r.enabled) { $('community-card').hidden = true; return r; }
    communityFlags = r.flags;
    renderFlags();
    for (const f of r.flags) if (RANK[f.level] > RANK[level]) setLevel(f.level);
    const total = r.results.filter((x) => !x.target.known).reduce((n, x) => n + x.count, 0);
    status.textContent = total
      ? `${total} community report${total === 1 ? '' : 's'} match this request.`
      : `No SignSense user has reported this site or address (${r.results.length} checked).`;
    renderReportControls(r.alreadyReported);
    return r;
  } catch (e) {
    console.warn('[SignSense] community check failed', e);
    status.textContent = 'Community reports are unavailable right now (offline?). Local checks still apply.';
    renderReportControls(false);
    return null;
  }
}

function renderReportControls(alreadyReported) {
  const box = $('community-actions');
  if (!reportTargets(decoded.deep).length) { box.replaceChildren(el('p', { className: 'muted small', textContent: 'Nothing here can be reported (only well-known tokens or protocols).' })); return; }
  if (alreadyReported) {
    const undo = el('button', { className: 'btn secondary', textContent: 'Undo my report' });
    undo.onclick = async () => { undo.disabled = true; await undoReport(decoded.deep).catch(() => {}); runCommunity(); };
    box.replaceChildren(el('p', { className: 'small', textContent: '✓ You reported this as a scam. Thank you.' }), undo);
    return;
  }
  const select = el('select', { className: 'select' }, Object.entries(REASONS).map(([value, label]) => el('option', { value, textContent: label })));
  const btn = el('button', { className: 'btn secondary', textContent: 'Report as scam' });
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Reporting…';
    try {
      await reportScam(decoded.deep, select.value);
      await runCommunity();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Report as scam';
      $('community-status').textContent = `Could not send the report: ${String(e.message).slice(0, 120)}`;
    }
  };
  box.replaceChildren(el('div', { className: 'row' }, select, btn),
    el('p', { className: 'muted small', textContent: 'Shares only the site and the counterparty address, never your wallet address.' }));
}

function sourceBadge(source, extra = '') {
  const b = $('source-badge');
  b.hidden = false;
  if (source === 'on_device') { b.className = 'badge device'; b.textContent = `⚡ On-device · Gemini Nano${extra}`; }
  else { b.className = 'badge cloud'; b.textContent = `☁ Cloud · Gemini${extra}`; }
}

function renderExplanation(x) {
  sourceBadge(x.source);
  const vLevel = VERDICT_LEVEL[x.verdict] || 'warn';
  // Deterministic rules set the floor: the model can raise the risk level, never lower it.
  if (RANK[vLevel] > RANK[level]) setLevel(vLevel);
  $('ai-body').replaceChildren(
    el('span', { className: `verdict ${x.verdict}`, textContent: x.verdict.replace('_', ' ').toUpperCase() }),
    el('div', { className: 'headline', textContent: x.headline }),
    el('p', { textContent: x.explanation, style: 'margin:0' }),
    x.checks?.length ? el('ul', { className: 'checks' }, x.checks.slice(0, 3).map((c) => el('li', { textContent: c }))) : '',
    el('div', {
      className: 'meta',
      textContent: x.source === 'on_device'
        ? `Generated on this device in ${x.ms} ms. Nothing left your computer.`
        : `Generated in the cloud in ${x.ms} ms from a redacted summary (no wallet addresses).`,
    }),
  );
}

async function runExplain(modeOverride) {
  $('ai-body').replaceChildren(el('p', { className: 'muted shimmer', textContent: modeOverride === InferenceMode.ONLY_IN_CLOUD ? 'Asking Gemini in the cloud…' : 'Thinking privately on your device…' }));
  try {
    renderExplanation(await explainQuick(decoded.ai, modeOverride));
  } catch (err) {
    console.error('[SignSense] explanation failed', err);
    await renderModelHelp(err);
  }
}

async function renderModelHelp(err) {
  const avail = await deviceAvailability();
  const { mode } = await getSettings();
  const bar = el('div', { className: 'progress', hidden: true }, el('div'));
  const dl = el('button', { className: 'btn secondary', textContent: 'Download on-device model' });
  const cloud = el('button', { className: 'btn secondary', textContent: 'Explain in the cloud instead' });
  dl.onclick = async () => {
    dl.disabled = true; bar.hidden = false;
    try {
      await downloadDeviceModel((p) => { bar.firstChild.style.width = `${Math.round(p * 100)}%`; });
      runExplain();
    } catch (e) { dl.textContent = `Download failed: ${e.message}`; }
  };
  cloud.onclick = () => runExplain(InferenceMode.ONLY_IN_CLOUD);
  const why = mode === InferenceMode.ONLY_ON_DEVICE
    ? `Strict privacy mode is on and the on-device model is "${avail}".`
    : `Could not get an explanation: ${String(err.message).slice(0, 140)}`;
  $('ai-body').replaceChildren(
    el('p', { className: 'muted', textContent: why }),
    el('div', { className: 'row' }, avail === 'downloadable' || avail === 'downloading' ? dl : '', cloud),
    bar,
    el('p', { className: 'muted small', textContent: 'The risk checks below were computed locally and are still valid.' }),
  );
}

$('deep-btn').onclick = async () => {
  const btn = $('deep-btn');
  btn.disabled = true; btn.textContent = 'Searching…';
  try {
    const r = await deepCheck(decoded.deep);
    const widget = el('div');
    if (r.searchWidget) widget.attachShadow({ mode: 'open' }).innerHTML = r.searchWidget; // required Google Search suggestions
    $('deep-body').replaceChildren(
      el('div', { className: 'meta', textContent: `☁ ${r.model}${r.fellBack ? ' (fallback: main model out of quota)' : ''}` }),
      el('div', { className: 'deep-text', textContent: r.text }),
      r.sources.length ? el('ol', { className: 'sources' }, r.sources.map((s) => el('li', {}, el('a', { href: s.uri, target: '_blank', rel: 'noopener', textContent: s.title || s.uri })))) : '',
      widget,
    );
    if (/bottom line:.*(scam|drain|phish|malicious|fraud)/i.test(r.text) && level !== 'danger') setLevel('danger');
    btn.textContent = 'Run again';
  } catch (e) {
    $('deep-body').replaceChildren(el('p', { className: 'muted', textContent: `Deep check failed: ${e.message}` }));
    btn.textContent = 'Try again';
  } finally { btn.disabled = false; }
};

$('ack').onchange = () => { $('approve').disabled = level === 'danger' && !$('ack').checked; };

async function decide(approved) {
  if (!demoKey) await chrome.storage.local.set({ [`dec:${id}`]: { approved } });
  window.close();
}
$('approve').onclick = () => decide(true);
$('reject').onclick = () => decide(false);

(async () => {
  const req = await loadRequest();
  if (!req) { $('title').textContent = 'Request not found (it may have expired).'; return; }
  decoded = decodeRequest(req);
  renderDecoded(decoded);
  const { deepCheckEnabled } = await getSettings();
  $('deep-card').hidden = !deepCheckEnabled;
  // Give the community lookup a moment so its findings can feed the explanation, but never block on it.
  const community = runCommunity();
  const r = await Promise.race([community, new Promise((res) => setTimeout(() => res(null), 1500))]);
  if (r?.flags?.length) decoded.ai.risk_flags = [...r.flags.map((f) => `${f.level.toUpperCase()}: ${f.text}`), ...decoded.ai.risk_flags];
  runExplain();
})();
