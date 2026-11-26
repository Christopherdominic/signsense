# SignSense demo video guide

A shot list and narration script for recording the SignSense demo. It runs about 2:50, so it fits the usual 3-minute limit for hackathon videos.

## What SignSense is

SignSense is a Chrome extension that explains crypto wallet requests in plain English before you sign them.

When a website asks your wallet (MetaMask, Rabby, Coinbase Wallet or any injected wallet) to send a transaction or sign a message, SignSense steps in first. It opens a review window showing:

- **A risk verdict**: Looks safe, Be careful, or Likely scam.
- **A plain-English explanation** from Gemini, for example "this site could take all your USDC, at any time".
- **Risk checks**: rules that run locally and catch the usual drainer tricks. These include unlimited token approvals, `setApprovalForAll`, gasless permit signatures, fake NFT listings, sign-in messages for a different website, and blind `eth_sign`.
- **Community reports**: how many SignSense users have reported this site or contract as a scam.
- **An optional deep check**: cloud Gemini with Google Search looks for scam reports about the site and contract.

You then choose **Reject** or **Continue to wallet**. Only if you continue does the request reach your wallet. For high-risk requests, Continue stays locked until you tick "I understand the risk".

### How the hybrid AI works

SignSense uses **Firebase AI Logic** hybrid inference:

- **Gemini Nano** runs inside Chrome, so most explanations never leave your device.
- **Cloud Gemini** steps in when Nano isn't available.
- The popup lets you choose a mode:
  - **Balanced**: on-device first, cloud fallback.
  - **Strict privacy**: on-device only.
  - **Cloud only**.

Other Firebase products:

| Product | Used for |
|---|---|
| Firestore + Anonymous Auth | Community reports, one per user |
| App Check | Protects the Gemini quota |
| Remote Config | Model names and thresholds |

The safety rule is that AI and community reports can raise the risk level but never lower it. Reports alone can only warn. A request turns red only when the local risk checks agree, so nobody can mob a legitimate site.

## Where MetaMask fits in

SignSense sits **between the website and MetaMask**:

```
Website request → SignSense review window → (Continue to wallet) → MetaMask → (Confirm) → sent
                                          → (Reject)            → MetaMask never opens
```

Not every request goes through SignSense:

- **Guarded requests**: sending transactions (`eth_sendTransaction`) and signatures (`personal_sign`, `eth_signTypedData_v3/v4`, `eth_sign`).
- **Connecting a wallet** is not guarded, so MetaMask's **Connect** prompt appears directly.
- **Popup demo requests** don't use MetaMask at all. They open the same review window with a sample request, and nothing reaches your wallet.

### MetaMask button labels

| You want to | Button in MetaMask |
|---|---|
| Connect your wallet to the dapp | **Connect** (if asked to pick an account first: **Next**, then **Connect**) |
| Approve a transaction or sign a message | **Confirm** |
| Turn it down | **Cancel** |

Older MetaMask versions use **Approve** or **Sign** instead of **Confirm**, and **Reject** instead of **Cancel**.

## Before you record

### Prepare the browser

- Reload SignSense in `chrome://extensions`, then refresh every dapp tab. A tab that isn't refreshed rejects requests with "Extension context invalidated".
- Open the popup and check that **Gemini Nano** shows **Ready**.
- In MetaMask, switch to a **testnet** such as Sepolia, using a test account with a little test ETH.
- Set the browser zoom to 110–125% so text is readable at 1080p.
- Choose light or dark mode and keep it for the whole video.
- Close unrelated tabs, hide bookmarks, and turn on Do Not Disturb.

### Keep secrets off screen

- Never show `src/config.js`, `.env` or the App Check page in the Firebase console.
- Keep DevTools closed. The App Check debug token can appear in the console.
- Never show a wallet that holds real funds. Never reveal a seed phrase or private key.

### Check the cloud first

- Gemini cloud models can return quota (429) or "high demand" (500) errors. Do a dry run of the cloud scenes right before you record.
- If the cloud is failing, record those scenes later and splice them in.

## Shot list

| Time | On screen | You press |
|---|---|---|
| 0:00–0:15 | Gallery slide 1, or a dapp page | Nothing (hook) |
| 0:15–0:25 | Testnet dapp | Dapp's **Connect wallet** → MetaMask **Connect** |
| 0:25–0:55 | Dapp triggers a sign or send request | SignSense opens first → **Continue to wallet** → MetaMask opens → **Confirm** |
| 0:55–1:25 | Popup → **Unlimited USDC approval (unknown spender)** | Read the red **Likely scam** screen → **Reject** (MetaMask never opens) |
| 1:25–1:40 | Popup → **Normal: send 0.05 ETH to a friend** | Green **Looks safe** → **Continue to wallet** |
| 1:40–2:10 | Popup: AI mode **Strict privacy: on-device only**, Wi-Fi off, run a demo | Point at the **On-device · Gemini Nano** badge |
| 2:10–2:25 | Wi-Fi on, same review window | **Run deep check** |
| 2:25–2:40 | Same review window | **Report as scam** → close → reopen the same demo |
| 2:40–2:50 | Gallery slide 5, then the repo URL | Nothing (close) |

The popup demos send nothing to MetaMask. When you press **Continue to wallet** on a demo, the window just closes.

## Narration script

**0:00 — Hook**

> Most crypto drains don't start with a hack. They start with a signature: a pop-up full of hex that nobody can read. SignSense is a Chrome extension that reads it for you, in plain English, before you sign.

**0:15 — Connect**

> Here's a dapp on the Sepolia testnet. I'll connect MetaMask as usual. Connecting is harmless, so SignSense lets it straight through.

**0:25 — Live interception**

> Now the dapp asks for a signature. Before MetaMask even opens, SignSense steps in, decodes the request and explains it. This one's fine, so I'll press Continue to wallet, and now MetaMask shows it. I'll press Confirm.

**0:55 — Scam demo**

> Here's what a drainer looks like. This request asks for unlimited USDC for an unknown spender. Local rules flag the unlimited approval. Gemini explains it: this site could take all my USDC, at any time. Because it's high risk, Continue stays locked until I confirm I understand. I'll press Reject, and MetaMask never sees it.

**1:25 — Safe demo**

> A normal send looks like this: green, one sentence, one click. SignSense only slows you down when it matters.

**1:40 — On-device AI**

> This is the hybrid part. With Firebase AI Logic, explanations run on Gemini Nano inside Chrome. I'll switch to strict privacy and turn off Wi-Fi, and it still works. The request never left my laptop.

**2:10 — Deep check**

> When I want more, the deep check uses cloud Gemini with Google Search to look for scam reports about this site and contract. My wallet address is never sent.

**2:25 — Community reports**

> If I spot a scam, I can report it. Reports are stored in Firestore under anonymous sign-in, one report per user. Reports alone can only warn. A request turns red only when the risk checks agree, so nobody can mob a legitimate site.

**2:40 — Close**

> Rules hold the line, AI explains, people warn. SignSense: understand it before you sign it.

## Recording tips

- Record at 1080p with OBS or your system screen recorder (on GNOME: Ctrl+Shift+Alt+R).
- MetaMask opens in its own small window. Record the whole screen, not just the Chrome tab, so it's captured.
- Record each scene as its own clip, so a cloud error doesn't ruin a full take.
- Cloud explanations can take 15–20 seconds. Cut the wait, or label the clip as sped up. On-device runs are quick.
- For the live scene, a message signature (`personal_sign`) is safest, because confirming it moves no funds. A small testnet send also works.
- After recording, click **Undo** on your test report so the community count goes back to 0.
- End on the repository URL for 2–3 seconds: <https://github.com/Christopherdominic/signsense>
