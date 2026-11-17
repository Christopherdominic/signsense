// Isolated-world bridge: page (inject.js) <-> extension (review window).
// The request is parked in chrome.storage.local; the review window writes the decision back.

window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.source !== 'signsense-page' || e.data.type !== 'review') return;
  const { id, payload } = e.data;
  const reqKey = `req:${id}`;
  const decKey = `dec:${id}`;

  const finish = (approved) => {
    chrome.storage.onChanged.removeListener(onChange);
    chrome.storage.local.remove([reqKey, decKey]);
    window.postMessage({ source: 'signsense-content', type: 'decision', id, approved }, window.location.origin);
  };
  const onChange = (changes, area) => {
    if (area === 'local' && changes[decKey]?.newValue) finish(changes[decKey].newValue.approved === true);
  };
  chrome.storage.onChanged.addListener(onChange);

  try {
    await chrome.storage.local.set({ [reqKey]: payload });
    await chrome.runtime.sendMessage({ type: 'open-review', id });
  } catch (err) {
    // Extension was reloaded or unavailable: fail closed only if the user cannot see a review.
    console.warn('[SignSense] could not open review window', err);
    finish(false);
  }
});
