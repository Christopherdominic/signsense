# Submission kit (#BuildHybridAI)

## Checklist
- [ ] Public GitHub repo, Apache-2.0 license visible in the About section
- [ ] Firebase AI Logic imported and called at runtime (`src/lib/ai.js`)
- [ ] App Check enabled (debug token) + Remote Config parameters created
- [ ] Firestore created with `firestore.rules` published; Anonymous Auth enabled
- [ ] Demo video under 3 minutes, in English, public on YouTube
- [ ] Platform selected: **Web (Chrome)**
- [ ] Optional: packaged `.zip` (`npm run zip`) or Chrome Web Store unlisted link so judges can test

## Demo video script (about 2:45)
1. **0:00–0:20, Hook.** "Wallet drainers don't hack you. They get you to sign." Show a fake airdrop site.
2. **0:20–0:55, Real interception.** Click "Claim" on a testnet dapp. SignSense opens before MetaMask. Show the red banner, the "Unlimited approval" check, and the ⚡ On-device badge with the plain-English explanation.
3. **0:55–1:25, Hybrid in action.** Turn on airplane mode and open another request: it still explains on-device. Switch the popup to Cloud only: the ☁ badge appears and the meta line says "redacted summary".
4. **1:25–1:55, Deep check.** Click Deep check. Gemini in the cloud searches the web and returns sources plus a bottom line.
5. **1:55–2:25, Safety design.** The local rules set a minimum risk level that the AI can't lower. Show the "I understand the risk" gate. Show `npm test` confirming no addresses are sent to a model.
6. **2:25–2:45, Community + close.** Click **Report as scam**, then show the report count appear on the next request from that site. Close on why on-device matters for wallet privacy.

## Text description (starting point)
SignSense is a Chrome extension that explains crypto wallet requests in plain English before you sign them.
Firebase AI Logic's hybrid SDK runs the explanation on Gemini Nano on-device by default, so signing data never
leaves the user's computer, and falls back to Gemini in the cloud using a redacted summary when Nano isn't available.
A user-initiated deep check uses cloud-only Grounding with Google Search to look for scam reports. Deterministic
decoders for approvals, permits, Permit2, Seaport listings and SIWE set a risk floor that the AI can raise but never lower.
Users can report scams to a community list in Cloud Firestore (anonymous Auth, one report per user, server-side counts), which warns everyone who meets the same site or address. Reports can only escalate a request to high risk when the local checks agree, so fake reports can't turn a legitimate site red.
Uses Firebase AI Logic (hybrid inference, structured output, Google Search grounding), App Check, Remote Config, Cloud Firestore and Authentication.
