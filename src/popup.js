import { SAMPLES } from './lib/samples.js';
import { decodeRequest } from './lib/decoder.js';
import { deviceAvailability, downloadDeviceModel, getSettings } from './lib/ai.js';

const $ = (id) => document.getElementById(id);
const NOTES = {
  prefer_on_device: 'Explanations run on Gemini Nano when it is ready, otherwise on Gemini in the cloud (redacted summary only).',
  only_on_device: 'Nothing is ever sent to the cloud for explanations. Deep checks still need your click.',
  only_in_cloud: 'Always uses Gemini in the cloud. Useful for comparing quality.',
};

// Chrome's LanguageModel.availability() values -> readable status.
const AVAIL = {
  available: ['Ready', 'ok'],
  downloadable: ['Not downloaded', ''],
  downloading: ['Downloading…', 'device'],
  unavailable: ['Unavailable', 'warn'],
  unsupported: ['Not supported', 'warn'],
};
function setAvail(label, tone = '') {
  $('avail').textContent = label;
  $('avail').className = `badge ${tone}`.trim();
}

async function refreshAvailability() {
  const a = await deviceAvailability();
  const [label, tone] = AVAIL[a] || [a, ''];
  setAvail(label, tone);
  $('download').hidden = !(a === 'downloadable' || a === 'downloading');
}

(async () => {
  const s = await getSettings();
  $('mode').value = s.mode;
  $('mode-note').textContent = NOTES[s.mode] || '';
  refreshAvailability();
})();

$('mode').onchange = async (e) => {
  await chrome.storage.local.set({ mode: e.target.value });
  $('mode-note').textContent = NOTES[e.target.value];
};

$('download').onclick = async () => {
  $('download').disabled = true; $('bar').hidden = false;
  try {
    await downloadDeviceModel((p) => { $('bar').firstChild.style.width = `${Math.round(p * 100)}%`; });
  } catch (e) { setAvail('Download failed', 'danger'); console.error('[SignSense] download failed', e); }
  $('download').disabled = false;
  refreshAvailability();
};

for (const [key, s] of Object.entries(SAMPLES)) {
  let level = '';
  try { level = decodeRequest(s.request).level; } catch { /* show without a risk dot */ }
  const b = Object.assign(document.createElement('button'), { className: 'demo', title: s.label });
  const dot = Object.assign(document.createElement('span'), { className: `dot ${level}` });
  const label = Object.assign(document.createElement('span'), { className: 'label', textContent: s.label });
  const chev = Object.assign(document.createElement('i'), { className: 'ico i-chevron' });
  b.append(dot, label, chev);
  b.onclick = () => chrome.windows.create({ url: chrome.runtime.getURL(`review.html?demo=${key}`), type: 'popup', width: 440, height: 720 });
  $('demos').append(b);
}
