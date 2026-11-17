// Runs in the PAGE's JavaScript world (MAIN). It wraps the wallet provider so that
// risky requests pause until the user has reviewed them in the SignSense window.
// It never sees private keys; it only sees what the dapp asks the wallet to sign.
(() => {
  if (window.__signsenseInstalled) return;
  window.__signsenseInstalled = true;

  const GUARDED = new Set(['eth_sendTransaction', 'eth_signTypedData_v4', 'eth_signTypedData_v3', 'personal_sign', 'eth_sign']);
  const pending = new Map();
  const wrapped = new WeakSet();

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== 'signsense-content' || e.data.type !== 'decision') return;
    const resolve = pending.get(e.data.id);
    if (resolve) { pending.delete(e.data.id); resolve(e.data.approved); }
  });

  function askUser(payload) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      window.postMessage({ source: 'signsense-page', type: 'review', id, payload }, window.location.origin);
    });
  }

  function wrap(provider) {
    if (!provider || typeof provider.request !== 'function' || wrapped.has(provider)) return;
    wrapped.add(provider);
    const original = provider.request.bind(provider);

    const guardedRequest = async (args) => {
      if (!args || !GUARDED.has(args.method)) return original(args);
      let chainId = 1; let toIsContract;
      try { chainId = parseInt(await original({ method: 'eth_chainId' }), 16); } catch {}
      if (args.method === 'eth_sendTransaction' && args.params?.[0]?.to) {
        try { toIsContract = (await original({ method: 'eth_getCode', params: [args.params[0].to, 'latest'] })) !== '0x'; } catch {}
      }
      const approved = await askUser({
        method: args.method,
        params: JSON.parse(JSON.stringify(args.params || [])),
        origin: window.location.origin,
        chainId,
        toIsContract,
      });
      if (!approved) {
        const err = new Error('User rejected the request in SignSense.');
        err.code = 4001; // EIP-1193 "user rejected"
        throw err;
      }
      return original(args);
    };

    try {
      provider.request = guardedRequest;
    } catch {
      // Some providers are frozen; fall back to a proxy on window.ethereum.
      if (window.ethereum === provider) {
        try {
          Object.defineProperty(window, 'ethereum', {
            value: new Proxy(provider, { get: (t, k) => (k === 'request' ? guardedRequest : Reflect.get(t, k)) }),
            configurable: true,
          });
        } catch {}
      }
    }
  }

  // 1. Provider already injected
  wrap(window.ethereum);

  // 2. Provider injected later (legacy pattern)
  if (!window.ethereum) {
    let current;
    try {
      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        get: () => current,
        set: (v) => { current = v; wrap(v); },
      });
    } catch {}
  }
  window.addEventListener('ethereum#initialized', () => wrap(window.ethereum), { once: true });

  // 3. EIP-6963 multi-wallet discovery
  window.addEventListener('eip6963:announceProvider', (e) => wrap(e.detail?.provider));
  window.dispatchEvent(new Event('eip6963:requestProvider'));
})();
