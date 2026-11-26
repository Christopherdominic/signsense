# SignSense demo video guide

A shot list and narration script for recording the SignSense demo against the **MetaMask Test Dapp** (<https://metamask.github.io/test-dapp/>). It runs about 2:50, so it fits the usual 3-minute limit for hackathon videos.

## What SignSense is

SignSense is a Chrome extension that explains crypto wallet requests in plain English before you sign them.

When a website asks your wallet (MetaMask, Rabby, Coinbase Wallet or any injected wallet) to send a transaction or sign a message, SignSense steps in first. It opens a review window showing:

- **A risk level**: Looks normal, Be careful, or High risk: likely a scam.
- **A plain-English explanation** from Gemini, with its own verdict (Looks safe, Be careful, Likely scam).
- **Risk checks**: rules that run locally and catch the usual drainer tricks. These include unlimited token approvals, `setApprovalForAll`, gasless permit signatures, fake NFT listings, sign-in messages for a different website, and blind `eth_sign`.
- **Community reports**: how many SignSense users have reported this site or contract as a scam.
- **An optional deep check**: cloud Gemini with Google Search looks for scam reports about the site and contract.

You then choose **Reject** or **Continue to wallet**. Only if you continue does the request reach your wallet. For high-risk requests, the button becomes **Continue anyway** and stays locked until you tick "I understand the risk and still want to continue".

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
Test dapp button → SignSense review window → Continue to wallet → MetaMask → Confirm → signed / sent
                                           → Reject             → MetaMask never opens;
                                                                   the dapp gets "User rejected the request in SignSense."
```

Not every request goes through SignSense:

- **Guarded requests**: sending transactions (`eth_sendTransaction`) and signatures (`personal_sign`, `eth_signTypedData_v3/v4`, `eth_sign`).
- **Connecting a wallet** is not guarded, so MetaMask's **Connect** prompt appears directly.
- **Popup demo requests** don't use MetaMask at all. They open the review window with a sample request.

### MetaMask button labels

| You want to | Button in MetaMask |
|---|---|
| Connect your wallet to the dapp | **Connect** (if asked to pick an account first: **Next**, then **Connect**) |
| Approve a transaction or sign a message | **Confirm** |
| Turn it down | **Cancel** |

Older MetaMask versions use **Approve** or **Sign** instead of **Confirm**, and **Reject** instead of **Cancel**.

## Test dapp buttons and what SignSense shows

These are the exact button labels on <https://metamask.github.io/test-dapp/>. The SignSense results come from running SignSense's decoder on the exact request each button sends.

| Test dapp card → button | Request | SignSense shows | Setup needed |
|---|---|---|---|
| **Connect Actions → Connect** | Connect | Not guarded. MetaMask opens directly. | None |
| **Personal Sign → Sign** | `personal_sign` | **Looks normal**, "Sign a message" | Connected |
| **Sign In With Ethereum → Sign In With Ethereum** | SIWE for this site | **Looks normal**, "Sign in with Ethereum" | Connected |
| **Sign In With Ethereum → Sign In With Ethereum (Bad Domain)** | SIWE claiming `metamask.badactor.io` | **High risk**. The sign-in message is for a different site than `metamask.github.io`. Possible phishing. | Connected |
| **Sign Permit → Sign** | EIP-2612 `Permit` | **High risk**, "Gasless token approval (Permit)" | Connected |
| **Send Eth → Send** | 0 ETH send | **Looks normal**, "Send coins" | Test ETH for gas |
| **ERC 20 → Approve Tokens** | `approve` of 7 tokens to the "Approve to Address" | **Be careful**, unknown spender | **Create Token** first (deploy) |
| **ERC 721 → Set Approval For All** | `setApprovalForAll` | **High risk**, "Approve ALL NFTs in a collection" | **Deploy**, then **Mint** first |

Some buttons need setup first:

- **Create Token** and the ERC 721 **Deploy** button are contract deployments. SignSense shows them as **Be careful**, "Deploy a contract". That's expected; press **Continue to wallet**, then **Confirm** in MetaMask.
- The table shows the local rules. Gemini can raise a level, for example from Looks normal to Be careful, but never lowers one.

## Before you record

### Prepare the browser

- Reload SignSense in `chrome://extensions`, then refresh the test dapp tab. A tab that isn't refreshed rejects requests with "Extension context invalidated".
- Open the popup and check that **Gemini Nano** shows **Ready**.
- In MetaMask, switch to **Sepolia** and use a test account with a little Sepolia ETH. The test dapp's **Status** card should show the network you picked, not "Ethereum Mainnet".
- Open the test dapp, click **Connect** and connect MetaMask once before recording, so the dry run works.
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
| 0:00–0:15 | Test dapp page | Nothing (hook) |
| 0:15–0:25 | **Connect Actions** card | **Connect** → MetaMask **Connect** |
| 0:25–0:50 | **Personal Sign** card | **Sign** → SignSense **Looks normal** → **Continue to wallet** → MetaMask **Confirm** |
| 0:50–1:20 | **Sign In With Ethereum** card | **Sign In With Ethereum (Bad Domain)** → SignSense **High risk** → **Reject** (MetaMask never opens) |
| 1:20–1:40 | **Sign Permit** card | **Sign** → SignSense **High risk**, gasless permit → **Reject** |
| 1:40–2:05 | SignSense popup → AI mode **Strict privacy: on-device only**, Wi-Fi off, back to the test dapp | **Sign In With Ethereum (Bad Domain)** again → point at **On-device · Gemini Nano** → **Reject** |
| 2:05–2:20 | Wi-Fi on, popup back to **Balanced**, **Sign Permit → Sign** again | **Run deep check** → **Reject** |
| 2:20–2:40 | SignSense popup → **Unlimited USDC approval (unknown spender)** | **Report as scam** → close → reopen the same demo |
| 2:40–2:50 | Gallery slide 5, then the repo URL | Nothing (close) |

### Why the community scene uses a popup demo

Don't press **Report as scam** on a test dapp request. That would file a real scam report against `metamask.github.io`, which is a legitimate site. The popup demo uses a made-up scam site (`claim-usdc-rewards.xyz`), so reporting it is harmless.

### Optional B-roll

- **ERC 721 → Deploy → Mint → Set Approval For All**: the classic NFT drainer, shown as **High risk**.
- **ERC 20 → Create Token → Approve Tokens**: shown as **Be careful**, unknown spender.

Each step costs Sepolia gas, so record these separately if you want them.

## Narration script

**0:00 — Hook**

> Most crypto drains don't start with a hack. They start with a signature: a pop-up full of hex that nobody can read. SignSense is a Chrome extension that reads it for you, in plain English, before you sign. I'll show it on MetaMask's own test dapp.

**0:15 — Connect**

> First I connect MetaMask, as usual. Connecting is harmless, so SignSense lets it straight through.

**0:25 — Safe signature**

> Now the dapp asks me to sign a message. Before MetaMask even opens, SignSense steps in, decodes it and explains it. It's a plain message, so it looks normal. I'll press Continue to wallet, and now MetaMask shows it. Confirm.

**0:50 — Phishing sign-in**

> This one's a classic phishing trick: a sign-in message that claims to be for metamask.badactor.io, while I'm on metamask.github.io. SignSense catches the mismatch and marks it high risk. Gemini explains why. Continue stays locked until I confirm I understand. I'll press Reject, and MetaMask never even sees it.

**1:20 — Gasless permit**

> And this "signature" is really a token approval in disguise: a gasless permit. No transaction, no gas, but it lets someone else move my tokens. SignSense flags it. Reject.

**1:40 — On-device AI**

> This is the hybrid part. With Firebase AI Logic, explanations run on Gemini Nano inside Chrome. I'll switch to strict privacy and turn off Wi-Fi, and it still works. The request never left my laptop.

**2:05 — Deep check**

> When I want more, the deep check uses cloud Gemini with Google Search to look for scam reports about this site and contract. My wallet address is never sent.

**2:20 — Community reports**

> If I spot a scam, I can report it. Reports are stored in Firestore under anonymous sign-in, one report per user. Reports alone can only warn. A request turns red only when the risk checks agree, so nobody can mob a legitimate site.

**2:40 — Close**

> Rules hold the line, AI explains, people warn. SignSense: understand it before you sign it.

## Recording tips

- Record at 1080p with OBS or your system screen recorder (on GNOME: Ctrl+Shift+Alt+R).
- MetaMask and the SignSense review window open as separate windows. Record the whole screen, not just the Chrome tab.
- The test dapp is a long page. Scroll to each card before you start that scene's clip.
- Record each scene as its own clip, so a cloud error doesn't ruin a full take.
- Cloud explanations can take 15–20 seconds. Cut the wait, or label the clip as sped up. On-device runs are quick.
- After you reject a request, the test dapp shows the error "User rejected the request in SignSense." It's worth a one-second shot, because it proves the wallet never got the request.
- After recording, click **Undo** on your test report so the community count goes back to 0.
- End on the repository URL for 2–3 seconds: <https://github.com/Christopherdominic/signsense>
