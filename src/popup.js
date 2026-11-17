import { SAMPLES } from './lib/samples.js';
import { deviceAvailability, downloadDeviceModel, getSettings } from './lib/ai.js';

const $ = (id) => document.getElementById(id);
const NOTES = {
  prefer_on_device: 'Explanations run on Gemini Nano when it is ready, otherwise on Gemini in the cloud (redacted summary only).',
  only_on_device: 'Nothing is ever sent to the cloud for explanations. Deep checks still need your click.',
  only_in_cloud: 'Always uses Gemini in the cloud. Useful for comparing quality.',
};

async function refreshAvailability() {
  const a = await deviceAvailability();
  $('avail').textContent = a;
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
  } catch (e) { $('avail').textContent = `error: ${e.message}`; }
  $('download').disabled = false;
  refreshAvailability();
};

for (const [key, s] of Object.entries(SAMPLES)) {
  const b = Object.assign(document.createElement('button'), { className: 'btn secondary demo', textContent: s.label });
  b.onclick = () => chrome.windows.create({ url: chrome.runtime.getURL(`review.html?demo=${key}`), type: 'popup', width: 440, height: 720 });
  $('demos').append(b);
}
