// Service worker: opens one review window per request and treats a closed window as "reject".

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'open-review') return;
  (async () => {
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL(`review.html?id=${encodeURIComponent(msg.id)}`),
      type: 'popup', width: 440, height: 720, focused: true,
    });
    const { windows = {} } = await chrome.storage.session.get('windows');
    windows[win.id] = msg.id;
    await chrome.storage.session.set({ windows });
    sendResponse({ ok: true });
  })();
  return true;
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { windows = {} } = await chrome.storage.session.get('windows');
  const id = windows[windowId];
  if (!id) return;
  delete windows[windowId];
  await chrome.storage.session.set({ windows });
  const decKey = `dec:${id}`;
  const reqKey = `req:${id}`;
  const existing = await chrome.storage.local.get([decKey, reqKey]);
  // Only reject if the request is still waiting (no decision written yet).
  if (existing[reqKey] && !existing[decKey]) await chrome.storage.local.set({ [decKey]: { approved: false, reason: 'window_closed' } });
});
