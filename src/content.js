// Isolated-world bridge: page (inject.js) <-> extension (review window).
// The request is parked in chrome.storage.local; the review window writes the decision back.

window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.source !== 'signsense-page' || e.data.type !== 'review') return;
  const { id, payload } = e.data;
  const reqKey = `req:${id}`;
  const decKey = `dec:${id}`;

  const finish = (approved) => {
    // chrome.* throws once the extension has been reloaded ("Extension context invalidated").
    // Clean-up is best effort; the page must always get an answer or the dapp request hangs.
    try {
      chrome.storage.onChanged.removeListener(onChange);
      chrome.storage.local.remove([reqKey, decKey]).catch(() => {});
    } catch { /* extension context gone */ }
    window.postMessage({ source: 'signsense-content', type: 'decision', id, approved }, window.location.origin);
  };
  const onChange = (changes, area) => {
    if (area === 'local' && changes[decKey]?.newValue) finish(changes[decKey].newValue.approved === true);
  };

  try {
    chrome.storage.onChanged.addListener(onChange);
    await chrome.storage.local.set({ [reqKey]: payload });
    await chrome.runtime.sendMessage({ type: 'open-review', id });
  } catch (err) {
    // Fail closed: if the user cannot see a review, the request is rejected.
    if (/context invalidated/i.test(String(err?.message))) {
      console.warn('[SignSense] The extension was updated or reloaded. Refresh this page to re-enable SignSense. The request was rejected for safety.');
    } else {
      console.warn('[SignSense] could not open review window', err);
    }
    finish(false);
  }
});
