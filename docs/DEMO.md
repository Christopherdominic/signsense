# SignSense demo video guide

A shot list and narration script for recording the SignSense demo. It runs about 2:45, so it fits the usual 3-minute limit for hackathon videos.

## Before you record

### Prepare the browser

- Reload SignSense in `chrome://extensions`, then refresh every dapp tab. A tab that isn't refreshed rejects requests with "Extension context invalidated".
- Open the popup and check that **Gemini Nano** shows **Ready**.
- Set the browser zoom to 110–125% so text is readable at 1080p.
- Choose light or dark mode and keep it for the whole video.
- Close unrelated tabs, hide bookmarks, and turn on Do Not Disturb.

### Keep secrets off screen

- Never show `src/config.js`, `.env` or the App Check page in the Firebase console.
- Keep DevTools closed. The App Check debug token can appear in the console.
- Use a test wallet on a testnet. Never show a wallet that holds real funds.

### Check the cloud first

- Gemini cloud models can return quota (429) or "high demand" (500) errors. Do a dry run of the cloud scenes right before you record.
- If the cloud is failing, record those scenes later and splice them in.

## Shot list

| Time | On screen | Action |
|---|---|---|
| 0:00–0:15 | Gallery slide 1, or a dapp page | Hook |
| 0:15–0:45 | Dapp with a test wallet | Trigger a real approve or sign request. The SignSense window opens before the wallet does. |
| 0:45–1:20 | Popup → **Unlimited USDC** demo | Red **Likely scam** banner, AI explanation, risk checks, the **I understand the risk** lock, then **Reject** |
| 1:20–1:35 | Popup → **Send 0.05 ETH** demo | Green **Looks safe**, then **Continue to wallet** in one click |
| 1:35–2:05 | Popup: **Strict privacy: on-device only**, Wi-Fi off, run a demo | The **On-device · Gemini Nano** badge still appears offline |
| 2:05–2:25 | Wi-Fi on → **Run deep check** | Cloud Gemini with web search |
| 2:25–2:40 | **Report as scam** → reopen the same demo | The community line now shows the report |
| 2:40–2:50 | Gallery slide 5, then the repo URL | Architecture and close |

## Narration script

**0:00 — Hook**

> Most crypto drains don't start with a hack. They start with a signature: a pop-up full of hex that nobody can read. SignSense reads it for you before you sign.

**0:15 — Live interception**

> Here's a real dapp. When it asks my wallet for a signature, SignSense steps in first. The wallet doesn't see the request until I've reviewed it.

**0:45 — Scam demo**

> This one asks for unlimited USDC. Built-in rules decode it and flag the unlimited approval. Gemini explains it in plain English: this site could take all my USDC, at any time. Because it's high risk, Continue stays locked until I confirm I understand. I'll reject it.

**1:20 — Safe demo**

> A normal send looks like this: green, one sentence, one click. SignSense only slows you down when it matters.

**1:35 — On-device AI**

> This is the hybrid part. With Firebase AI Logic, explanations run on Gemini Nano inside Chrome. I'll switch to strict privacy and turn off Wi-Fi, and it still works. The request never left my laptop.

**2:05 — Deep check**

> When I want more, the deep check uses cloud Gemini with Google Search to look for scam reports about this site and contract. My wallet address is never sent.

**2:25 — Community reports**

> If I spot a scam, I can report it. Reports are stored in Firestore under anonymous sign-in, one report per user. Reports alone can only warn. A request turns red only when the risk checks agree, so nobody can mob a legitimate site.

**2:40 — Close**

> Rules hold the line, AI explains, people warn. SignSense: understand it before you sign it.

## Recording tips

- Record at 1080p with OBS or your system screen recorder (on GNOME: Ctrl+Shift+Alt+R).
- Record each scene as its own clip, so a cloud error doesn't ruin a full take.
- Cloud explanations can take 15–20 seconds. Cut the wait, or label the clip as sped up. On-device runs are quick.
- After recording, click **Undo** on your test report so the community count goes back to 0.
- End on the repository URL for 2–3 seconds: <https://github.com/Christopherdominic/signsense>
