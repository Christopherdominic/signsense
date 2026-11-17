# SignSense: understand it before you sign it

**SignSense is a Chrome extension that explains crypto wallet requests in plain English before you sign them.** It runs privately on your own computer with Gemini Nano, and falls back to Gemini in the cloud when the local model isn't available. It's built with the **Firebase AI Logic hybrid inference SDK** for the #BuildHybridAI hackathon.

> Platform: **Web (Chrome extension)** · License: Apache-2.0

## The problem

Wallet drainers don't hack wallets. They trick people into signing. One "free mint" or "claim your airdrop" signature can be an unlimited token approval, a gasless `Permit`, or an NFT listing priced at zero. Wallets show hex and long addresses, which most people can't read, so they click **Confirm** anyway.

## What SignSense does

When a website asks your wallet to sign something, SignSense pauses the request and opens a review window that has:

1. **Local risk checks** (deterministic, no AI): it decodes approvals, `setApprovalForAll`, EIP-2612 permits, Permit2, Seaport listings, Sign-In with Ethereum and `eth_sign`, and flags known drainer patterns.
2. **A plain-English explanation** from Firebase AI Logic in hybrid mode. The badge shows whether it ran **⚡ on-device (Gemini Nano)** or **☁ in the cloud (Gemini)**.
3. **Community scam reports** stored in **Cloud Firestore**. If other SignSense users have reported the site or the spender, you see it in the risk checks, and three or more reports mark the request high risk *if the local checks also found a risk*. Reports on their own can only warn, so fake reports can't turn a harmless request or a legitimate site red. One click lets you report a scam yourself.
4. **An optional deep check**, cloud only, that you start yourself. Gemini uses **Grounding with Google Search** to look for public scam reports about the site and the contracts involved.
5. **Reject / Continue.** For high-risk requests, you have to tick "I understand the risk" before you can continue.

## Why hybrid matters here

| | On-device (Gemini Nano) | Cloud (Gemini) |
|---|---|---|
| Used for | The explanation for every request | Fallback when Nano isn't available; deep check on request |
| Privacy | Nothing leaves your computer | Gets a **redacted** summary only: no wallet addresses, no balances |
| Works offline | Yes | No |
| Cost | Free | Free tier / paid quota |
| Extra power | n/a | Google Search grounding (cloud only) |

Signing requests are among the most privacy-sensitive data a person has: they tie a wallet to a browsing session. Explaining them **on-device by default** is the right design, not a gimmick. The cloud is used only when it adds something: reaching users without Nano, and searching the web for scam reports.

**Safety rule:** the deterministic checks set a minimum risk level. The AI can *raise* a warning but can never mark a dangerous request as safe.

## How Firebase AI Logic is used

The code is in [`src/lib/ai.js`](src/lib/ai.js).

- `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, inCloudParams, onDeviceParams })`: the hybrid model for quick explanations.
- **Structured output** in both paths: `responseSchema` (cloud) and `responseConstraint` (on-device) return `{ verdict, headline, explanation, checks }`.
- `response.inferenceSource` drives the ⚡ / ☁ badge shown to the user.
- `model.initializeDeviceModel(progress)` lets the user download Gemini Nano from the popup or the review window.
- A separate cloud-only model with `tools: [{ googleSearch: {} }]` powers the deep check. The required Google Search suggestions are rendered.
- Three privacy modes (Balanced / Strict on-device / Cloud only) map to `InferenceMode` values.

Other Firebase products:

- **App Check** protects the Gemini API. MV3 extensions can't load reCAPTCHA, so this build uses a **debug token**, which the hackathon rules accept.
- **Remote Config** sets the default inference mode, the cloud model names, the deep-check switch and the community-report thresholds without shipping a new build.
- **Cloud Firestore** holds community scam reports at `reports/{target}/reporters/{uid}`: one document per reporter, counted with a server-side aggregation (`getCountFromServer`). Only the site and counterparty address are stored, never the user's wallet. Security rules are in [`firestore.rules`](firestore.rules).
- **Authentication (anonymous)** gives each reporter a stable ID, so a person counts once per target and can undo their report. It uses `firebase/auth/web-extension`, which is the MV3-safe build.

## Architecture

```
dapp page ──request()──► inject.js (MAIN world, wraps window.ethereum + EIP-6963 providers)
                              │ postMessage
                         content.js ──chrome.storage──► review window (review.js)
                              ▲                              │ decoder.js  (local rules)
                              │ decision (approve/reject)    │ ai.js       (Firebase AI Logic hybrid)
                              └──────────────────────────────┘
background.js opens the review window; closing it counts as Reject.
```

## Setup

**Requirements:** Chrome desktop 139+ and Node 18+.

1. **Firebase project.** In the [Firebase console](https://console.firebase.google.com), create a project, go to **AI Services → AI Logic → Get started**, and choose the **Gemini Developer API**. Then add a **Web app**.
2. **App Check.** Go to **App Check → Apps → your web app**, register a provider (reCAPTCHA Enterprise is fine; the extension doesn't use it), then open **Manage debug tokens → Add debug token**. Copy the token.
3. **Config.**
   ```bash
   cp src/config.example.js src/config.js   # paste firebaseConfig + debug token
   npm install
   npm run build
   ```
4. **Load the extension.** Open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select `dist/`.
5. **Enable Gemini Nano** (for on-device mode). Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, set it to **Enabled**, and restart Chrome. Then click **Download Gemini Nano** in the SignSense popup.
6. **Firestore + Auth** (for community reports).
   - **Build → Firestore Database → Create database** (production mode, any region). Open the **Rules** tab, paste in [`firestore.rules`](firestore.rules) and click **Publish**. If you use the Firebase CLI, run `firebase deploy --only firestore:rules` instead.
   - **Build → Authentication → Get started → Sign-in method →** enable **Anonymous**.
   - **App Check → APIs → Cloud Firestore → Enforce**, so only requests carrying a valid App Check token can read or write reports.
7. *(Optional)* **Remote Config.** Add any of `quick_mode`, `quick_cloud_model`, `deep_cloud_model`, `deep_check_enabled`, `community_reports_enabled`, `community_warn_at` and `community_danger_at` to override the defaults in [`src/lib/firebase.js`](src/lib/firebase.js).

## Try it

- **No wallet needed:** open the SignSense popup and click any **demo request**: unlimited USDC approval, NFT `setApprovalForAll`, gasless permit, zero-price listing, phishing sign-in, `eth_sign`, or a normal transfer.
- **With a wallet:** install MetaMask (or any EIP-1193/6963 wallet), switch to a testnet, and use any dapp. SignSense opens before your wallet does.
- **See the hybrid switch:** open a demo with Gemini Nano downloaded (⚡ badge), then turn on airplane mode and run it again. It still works. Switch to **Cloud only** to compare.

## Tests

```bash
npm test
```

The tests cover the decoder's risk rules and the community-report rules. They also check that **nothing sent to a model contains a full wallet address**, and that the deep-check context never includes the user's own address.

## Limitations / roadmap

- Only the outer call of batched calls (`multicall`, Universal Router) is decoded.
- The token and protocol lists are small and built in.
- Anonymous accounts can be recreated, so a determined person could inflate report counts. Two defenses are in place today:
  - **Reports can't escalate on their own.** Reports alone only produce a warning; high risk needs a matching local risk check.
  - **App Check is enforced on Firestore**, so the database rejects scripts that skip the extension. The debug token ships with the extension, so this is a speed bump, not a lock.

  Next steps: require Google sign-in to *file* a report (one vote per Google account), and move report writes into a Cloud Function that rate-limits per user and IP, ignores brand-new accounts, weights reporters by reputation and lets reports expire.
- Wallets that freeze their provider object can't be wrapped. Demo mode always works.

## License

[Apache 2.0](LICENSE)
