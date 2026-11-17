// Deterministic, offline decoder for wallet signing requests.
// No AI and no network: it turns raw calldata / typed data into facts and risk flags.
// The AI layers only *explain* these facts; they can never lower a flag raised here.

export const MAX_UINT256 = (1n << 256n) - 1n;
const UNLIMITED_THRESHOLD = 1n << 255n; // anything this large is effectively "unlimited"
const MAX_UINT160 = (1n << 160n) - 1n;

const CHAINS = {
  1: 'Ethereum', 10: 'Optimism', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base',
  42161: 'Arbitrum', 43114: 'Avalanche', 11155111: 'Sepolia (testnet)', 84532: 'Base Sepolia (testnet)',
};

// chainId:address(lowercase) -> token metadata
const TOKENS = {
  '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '1:0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
  '1:0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18 },
  '1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18 },
  '8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '8453:0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
  '137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { symbol: 'USDC', decimals: 6 },
  '42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
  '10:0x0b2c639c533813f4aa9d7837caf62653d097ff85': { symbol: 'USDC', decimals: 6 },
};

// Well-known spenders (same address on most EVM chains). Being "known" lowers
// severity but never hides an unlimited approval.
const KNOWN_SPENDERS = {
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Uniswap Permit2',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x0000000000000068f116a894984e2db1123eb395': 'OpenSea Seaport 1.6',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch Router v6',
};

const SELECTORS = {
  '0x095ea7b3': 'approve',
  '0x39509351': 'increaseAllowance',
  '0xa22cb465': 'setApprovalForAll',
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x42842e0e': 'safeTransferFrom',
  '0xb88d4fde': 'safeTransferFrom',
  '0x87517c45': 'permit2Approve',
  '0xd505accf': 'permit',
  '0xac9650d8': 'multicall',
  '0x3593564c': 'universalRouterExecute',
};

// ---------- helpers ----------

export const chainName = (id) => CHAINS[Number(id)] || `chain ${Number(id)}`;
const lc = (a) => (typeof a === 'string' ? a.toLowerCase() : a);
export const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '');
const toBig = (v) => {
  if (v === undefined || v === null || v === '') return 0n;
  try { return BigInt(v); } catch { return 0n; }
};
const word = (data, i) => data.slice(10 + i * 64, 10 + (i + 1) * 64);
const wordAddr = (data, i) => '0x' + word(data, i).slice(24);
const wordInt = (data, i) => toBig('0x' + (word(data, i) || '0'));

export function tokenInfo(chainId, address) {
  return TOKENS[`${Number(chainId)}:${lc(address)}`] || null;
}

export function spenderLabel(address) {
  return KNOWN_SPENDERS[lc(address)] || null;
}

export function formatUnits(value, decimals) {
  const neg = value < 0n; let v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  const wholeStr = whole.toLocaleString('en-US');
  return `${neg ? '-' : ''}${wholeStr}${frac ? '.' + frac : ''}`;
}

function amountText(raw, token) {
  if (raw >= UNLIMITED_THRESHOLD || raw === MAX_UINT160) return 'UNLIMITED';
  if (token) return `${formatUnits(raw, token.decimals)} ${token.symbol}`;
  return `${raw.toString()} (raw units, unknown token)`;
}

function hexToUtf8(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return hex;
  const bytes = hex.slice(2).match(/.{1,2}/g) || [];
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes.map((b) => parseInt(b, 16))));
    // Treat as text only if it is mostly printable
    const printable = text.replace(/[\x20-\x7E\n\r\t -￿]/g, '').length === 0;
    return printable ? text : null;
  } catch { return null; }
}

function hostOf(origin) {
  try { return new URL(origin).host; } catch { return origin || 'unknown site'; }
}

function deadlineText(seconds) {
  const s = Number(seconds);
  if (!s) return 'none';
  const days = (s * 1000 - Date.now()) / 86400000;
  const date = new Date(s * 1000).toISOString().slice(0, 10);
  if (days > 3650) return `effectively never (${date})`;
  return `${date} (${Math.round(days)} days from now)`;
}

// ---------- main entry ----------

/**
 * @param {object} req { method, params, origin, chainId, toIsContract }
 * @returns {{ kind, title, facts, flags, ai, deep }}
 *   facts: [{label, value}] shown to the user
 *   flags: [{level: 'danger'|'warn'|'info', code, text}]
 *   ai:    redacted summary for the quick explanation (no wallet addresses)
 *   deep:  fuller context, sent to the cloud ONLY when the user asks for a deep check
 */
export function decodeRequest(req) {
  const ctx = {
    site: hostOf(req.origin),
    chainId: Number(req.chainId || 1),
    facts: [],
    flags: [],
    ai: {},
    deep: {},
  };
  ctx.facts.push({ label: 'Site', value: ctx.site });
  ctx.facts.push({ label: 'Network', value: chainName(ctx.chainId) });

  let out;
  switch (req.method) {
    case 'eth_sendTransaction': out = decodeTx(req.params?.[0] || {}, req, ctx); break;
    case 'eth_signTypedData_v4':
    case 'eth_signTypedData_v3': out = decodeTypedData(req.params?.[1], ctx); break;
    case 'personal_sign': out = decodePersonalSign(req.params?.[0], ctx); break;
    case 'eth_sign':
      ctx.flags.push({ level: 'danger', code: 'BLIND_SIGN', text: 'eth_sign asks you to sign a raw hash. You cannot see what it authorizes, and it can be a full transaction that drains your wallet.' });
      out = { kind: 'blind_signature', title: 'Blind signature (eth_sign)', action: 'sign an unreadable raw hash' };
      break;
    default:
      out = { kind: 'unknown', title: `Request: ${req.method}`, action: `unrecognized wallet method ${req.method}` };
      ctx.flags.push({ level: 'warn', code: 'UNKNOWN_METHOD', text: 'SignSense does not recognize this request type.' });
  }

  const ai = {
    action: out.action,
    site: ctx.site,
    network: chainName(ctx.chainId),
    ...ctx.ai,
    risk_flags: ctx.flags.map((f) => `${f.level.toUpperCase()}: ${f.text}`),
  };
  return {
    kind: out.kind,
    title: out.title,
    facts: ctx.facts,
    flags: ctx.flags,
    level: overallLevel(ctx.flags),
    ai,
    deep: { site: ctx.site, network: chainName(ctx.chainId), chainId: ctx.chainId, method: req.method, action: out.action, ...ctx.deep },
  };
}

export function overallLevel(flags) {
  if (flags.some((f) => f.level === 'danger')) return 'danger';
  if (flags.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

// ---------- transactions ----------

function decodeTx(tx, req, ctx) {
  const data = (tx.data || tx.input || '0x').toLowerCase();
  const value = toBig(tx.value);
  const to = tx.to;
  const selector = data.length >= 10 ? data.slice(0, 10) : null;
  const fn = selector ? SELECTORS[selector] : null;
  const token = tokenInfo(ctx.chainId, to);

  ctx.deep.contract = to;
  // Raw calldata is NOT forwarded: it can contain the user's own address.
  if (selector) ctx.deep.function_selector = selector;

  if (value > 0n) {
    ctx.facts.push({ label: 'Sends', value: `${formatUnits(value, 18)} native coin` });
    ctx.ai.native_value_sent = formatUnits(value, 18);
  }

  if (!to) {
    ctx.flags.push({ level: 'warn', code: 'CONTRACT_DEPLOY', text: 'This transaction deploys a new contract.' });
    return { kind: 'deploy', title: 'Deploy a contract', action: 'deploy a new smart contract' };
  }

  if (data === '0x' || data === '') {
    const recipient = req.toIsContract ? 'a smart contract' : 'a wallet address';
    ctx.facts.push({ label: 'To', value: `${short(to)} (${recipient})` });
    ctx.ai.recipient = recipient;
    if (req.toIsContract) ctx.flags.push({ level: 'info', code: 'SEND_TO_CONTRACT', text: 'You are sending coins directly to a contract, not a person.' });
    return { kind: 'native_transfer', title: 'Send coins', action: `send ${formatUnits(value, 18)} native coin to ${recipient}` };
  }

  ctx.facts.push({ label: 'Contract', value: `${short(to)}${token ? ` (${token.symbol} token)` : ''}` });

  switch (fn) {
    case 'approve':
    case 'increaseAllowance': {
      const spender = wordAddr(data, 0);
      const raw = wordInt(data, 1);
      const label = spenderLabel(spender);
      const amt = amountText(raw, token);
      const what = token ? token.symbol : 'tokens from this contract';
      ctx.facts.push({ label: 'Spender', value: `${short(spender)}${label ? ` (${label})` : ' (unknown)'}` });
      ctx.facts.push({ label: 'Allowance', value: amt });
      ctx.ai.token = token ? token.symbol : 'unknown token';
      ctx.ai.allowance = amt;
      ctx.ai.spender = label ? `known protocol: ${label}` : 'unknown address';
      ctx.deep.spender = spender;
      if (amt === 'UNLIMITED') {
        ctx.flags.push({ level: label ? 'warn' : 'danger', code: 'UNLIMITED_APPROVAL', text: `Unlimited approval: the spender could move ALL of your ${what}, now or at any time in the future.` });
      } else if (!token) {
        ctx.flags.push({ level: 'info', code: 'AMBIGUOUS_APPROVE', text: 'Unknown token contract. For NFTs, this number may be a token ID rather than an amount.' });
      }
      if (!label) ctx.flags.push({ level: 'warn', code: 'UNKNOWN_SPENDER', text: 'The spender is not a protocol SignSense recognizes.' });
      if (raw === 0n) {
        ctx.flags.length = 0;
        ctx.flags.push({ level: 'info', code: 'REVOKE', text: 'Setting allowance to 0 revokes access. This is usually a safety action.' });
        return { kind: 'revoke', title: 'Revoke token approval', action: `revoke a spender's access to ${what}` };
      }
      return { kind: 'approval', title: `Approve ${token ? token.symbol : 'token'} spending`, action: `let another address spend ${amt === 'UNLIMITED' ? `an UNLIMITED amount of ${what}` : amt}` };
    }
    case 'setApprovalForAll': {
      const operator = wordAddr(data, 0);
      const approved = wordInt(data, 1) === 1n;
      const label = spenderLabel(operator);
      ctx.facts.push({ label: 'Operator', value: `${short(operator)}${label ? ` (${label})` : ' (unknown)'}` });
      ctx.facts.push({ label: 'Grants', value: approved ? 'ALL NFTs in this collection' : 'removes access (revoke)' });
      ctx.ai.operator = label ? `known protocol: ${label}` : 'unknown address';
      ctx.deep.spender = operator;
      if (!approved) return { kind: 'revoke', title: 'Revoke NFT collection access', action: 'revoke an operator\'s access to an NFT collection' };
      ctx.flags.push({ level: label ? 'warn' : 'danger', code: 'APPROVAL_FOR_ALL', text: 'This gives the operator control of EVERY NFT you own in this collection. It is the most common NFT drainer trick.' });
      return { kind: 'nft_approval_all', title: 'Approve ALL NFTs in a collection', action: 'give another address control over every NFT you own in this collection' };
    }
    case 'transfer': {
      const recipient = wordAddr(data, 0);
      const amt = amountText(wordInt(data, 1), token);
      ctx.facts.push({ label: 'Recipient', value: short(recipient) });
      ctx.facts.push({ label: 'Amount', value: amt });
      ctx.ai.token = token ? token.symbol : 'unknown token';
      ctx.ai.amount = amt;
      ctx.ai.recipient = 'an address (not shown)';
      return { kind: 'token_transfer', title: `Send ${token ? token.symbol : 'tokens'}`, action: `send ${amt} to another address` };
    }
    case 'transferFrom':
    case 'safeTransferFrom': {
      const from = wordAddr(data, 0); const recipient = wordAddr(data, 1);
      ctx.facts.push({ label: 'From', value: short(from) });
      ctx.facts.push({ label: 'To', value: short(recipient) });
      ctx.facts.push({ label: 'Amount / token ID', value: wordInt(data, 2).toString() });
      ctx.ai.recipient = 'an address (not shown)';
      return { kind: 'transfer_from', title: 'Transfer tokens / NFT', action: 'move a token or NFT from one address to another' };
    }
    case 'permit2Approve': {
      const tok = wordAddr(data, 0); const spender = wordAddr(data, 1);
      const raw = wordInt(data, 2); const exp = wordInt(data, 3);
      const t = tokenInfo(ctx.chainId, tok); const label = spenderLabel(spender);
      const amt = amountText(raw, t);
      ctx.facts.push({ label: 'Token', value: t ? t.symbol : short(tok) });
      ctx.facts.push({ label: 'Spender', value: `${short(spender)}${label ? ` (${label})` : ' (unknown)'}` });
      ctx.facts.push({ label: 'Allowance', value: amt });
      ctx.facts.push({ label: 'Expires', value: deadlineText(exp) });
      ctx.ai.token = t ? t.symbol : 'unknown token'; ctx.ai.allowance = amt;
      ctx.ai.spender = label ? `known protocol: ${label}` : 'unknown address';
      ctx.deep.spender = spender; ctx.deep.token = tok;
      if (amt === 'UNLIMITED') ctx.flags.push({ level: label ? 'warn' : 'danger', code: 'UNLIMITED_APPROVAL', text: 'Unlimited Permit2 allowance for this spender.' });
      return { kind: 'approval', title: 'Permit2 approval', action: `approve ${amt} via Permit2` };
    }
    case 'multicall':
    case 'universalRouterExecute':
      ctx.flags.push({ level: 'info', code: 'BATCHED_CALL', text: 'This bundles several actions together. SignSense shows the outer call only.' });
      return { kind: 'contract_call', title: 'Batched contract call', action: `call a batched function (${fn}) on a contract` };
    default:
      ctx.facts.push({ label: 'Function', value: selector || 'none' });
      ctx.flags.push({ level: 'warn', code: 'UNKNOWN_FUNCTION', text: 'Unrecognized contract function. Only continue if you trust this site.' });
      return { kind: 'contract_call', title: 'Unknown contract call', action: 'call an unrecognized function on a smart contract' };
  }
}

// ---------- typed data (EIP-712) ----------

function decodeTypedData(raw, ctx) {
  let td;
  try { td = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { td = null; }
  if (!td || !td.message) {
    ctx.flags.push({ level: 'warn', code: 'UNREADABLE_TYPED_DATA', text: 'The structured data could not be read.' });
    return { kind: 'typed_data', title: 'Sign structured data', action: 'sign unreadable structured data' };
  }
  const { domain = {}, message: m, primaryType } = td;
  ctx.facts.push({ label: 'App (domain)', value: domain.name || 'unnamed' });
  ctx.facts.push({ label: 'Type', value: primaryType });
  ctx.deep.verifyingContract = domain.verifyingContract;
  ctx.ai.signing_domain = domain.name || 'unnamed';
  ctx.ai.message_type = primaryType;
  if (domain.chainId !== undefined && Number(domain.chainId) !== ctx.chainId) {
    ctx.flags.push({ level: 'danger', code: 'CHAIN_MISMATCH', text: `Signature is for ${chainName(domain.chainId)} but you are connected to ${chainName(ctx.chainId)}.` });
  }

  // EIP-2612 permit (gasless token approval)
  if (primaryType === 'Permit' && m.spender !== undefined && m.value !== undefined) {
    const t = tokenInfo(ctx.chainId, domain.verifyingContract);
    const label = spenderLabel(m.spender);
    const amt = amountText(toBig(m.value), t);
    ctx.facts.push({ label: 'Token', value: t ? t.symbol : `${domain.name || 'token'} (${short(domain.verifyingContract)})` });
    ctx.facts.push({ label: 'Spender', value: `${short(m.spender)}${label ? ` (${label})` : ' (unknown)'}` });
    ctx.facts.push({ label: 'Allowance', value: amt });
    ctx.facts.push({ label: 'Valid until', value: deadlineText(m.deadline) });
    ctx.ai.token = t ? t.symbol : domain.name || 'unknown token';
    ctx.ai.allowance = amt; ctx.ai.spender = label ? `known protocol: ${label}` : 'unknown address';
    ctx.ai.valid_until = deadlineText(m.deadline);
    ctx.deep.spender = m.spender;
    ctx.flags.push({ level: label ? 'warn' : 'danger', code: 'GASLESS_PERMIT', text: 'This "signature" is actually a token approval. No gas, no transaction, but the spender can take your tokens afterwards.' });
    if (amt === 'UNLIMITED') ctx.flags.push({ level: 'danger', code: 'UNLIMITED_APPROVAL', text: 'The approval amount is unlimited.' });
    return { kind: 'permit', title: 'Gasless token approval (Permit)', action: `approve ${amt === 'UNLIMITED' ? `an UNLIMITED amount of ${ctx.ai.token}` : amt} through an off-chain signature` };
  }

  // Uniswap Permit2 signatures
  if (domain.name === 'Permit2' && (primaryType === 'PermitSingle' || primaryType === 'PermitBatch')) {
    const details = primaryType === 'PermitSingle' ? [m.details] : m.details || [];
    const label = spenderLabel(m.spender);
    ctx.facts.push({ label: 'Spender', value: `${short(m.spender)}${label ? ` (${label})` : ' (unknown)'}` });
    ctx.deep.spender = m.spender;
    let unlimited = false;
    details.forEach((d, i) => {
      const t = tokenInfo(ctx.chainId, d.token);
      const amt = amountText(toBig(d.amount), t);
      if (amt === 'UNLIMITED') unlimited = true;
      ctx.facts.push({ label: `Token ${details.length > 1 ? i + 1 : ''}`.trim(), value: `${t ? t.symbol : short(d.token)}: ${amt}, expires ${deadlineText(d.expiration)}` });
    });
    ctx.ai.spender = label ? `known protocol: ${label}` : 'unknown address';
    ctx.ai.tokens = details.map((d) => (tokenInfo(ctx.chainId, d.token)?.symbol || 'unknown token') + ': ' + amountText(toBig(d.amount), tokenInfo(ctx.chainId, d.token)));
    if (!label) ctx.flags.push({ level: 'danger', code: 'UNKNOWN_SPENDER', text: 'Permit2 signature for a spender SignSense does not recognize. This is a common drainer pattern.' });
    if (unlimited) ctx.flags.push({ level: 'warn', code: 'UNLIMITED_APPROVAL', text: 'At least one token has an unlimited allowance.' });
    return { kind: 'permit2', title: 'Permit2 signature', action: `sign a Permit2 approval for ${details.length} token(s)` };
  }

  // Seaport / OpenSea orders: compare what you give vs what you get
  if (primaryType === 'OrderComponents' && Array.isArray(m.offer)) {
    const offerer = lc(m.offerer);
    const toYou = (m.consideration || []).filter((c) => lc(c.recipient) === offerer);
    const nftCount = m.offer.filter((o) => Number(o.itemType) >= 2).length;
    ctx.facts.push({ label: 'You give', value: `${m.offer.length} item(s)${nftCount ? `, ${nftCount} NFT(s)` : ''}` });
    const youGet = toYou.reduce((s, c) => (Number(c.itemType) === 0 ? s + toBig(c.startAmount) : s), 0n);
    ctx.facts.push({ label: 'You receive', value: toYou.length ? `${formatUnits(youGet, 18)} native coin${toYou.some((c) => Number(c.itemType) !== 0) ? ' + other items' : ''}` : 'NOTHING' });
    ctx.ai.items_given = m.offer.length; ctx.ai.native_received = formatUnits(youGet, 18);
    if (!toYou.length || (youGet === 0n && toYou.every((c) => Number(c.itemType) === 0))) {
      ctx.flags.push({ level: 'danger', code: 'ZERO_PRICE_LISTING', text: 'You would give away items and receive nothing. This is a classic fake-listing scam.' });
    }
    return { kind: 'marketplace_order', title: 'Marketplace order / listing', action: `list ${m.offer.length} item(s) for sale on a marketplace` };
  }

  ctx.flags.push({ level: 'info', code: 'GENERIC_TYPED_DATA', text: 'Structured signature of a type SignSense does not specifically understand.' });
  return { kind: 'typed_data', title: `Sign ${primaryType || 'structured data'}`, action: `sign a "${primaryType}" message for ${domain.name || 'an app'}` };
}

// ---------- personal_sign ----------

function decodePersonalSign(hexMsg, ctx) {
  const text = hexToUtf8(hexMsg);
  if (text === null) {
    ctx.flags.push({ level: 'warn', code: 'BINARY_MESSAGE', text: 'The message is not readable text.' });
    return { kind: 'message', title: 'Sign a message', action: 'sign an unreadable binary message' };
  }
  ctx.facts.push({ label: 'Message', value: text.length > 280 ? text.slice(0, 280) + '…' : text });
  // Wallet addresses are replaced before anything reaches a model.
  ctx.ai.message_preview = text.slice(0, 400).replace(/0x[a-fA-F0-9]{40}/g, '[address]');
  const siwe = text.match(/^(\S+) wants you to sign in with your Ethereum account/m);
  if (siwe) {
    const claimed = siwe[1].replace(/^https?:\/\//, '');
    if (claimed !== ctx.site) {
      ctx.flags.push({ level: 'danger', code: 'SIWE_DOMAIN_MISMATCH', text: `Sign-in message claims to be for "${claimed}" but you are on "${ctx.site}". Possible phishing.` });
    }
    return { kind: 'sign_in', title: 'Sign in with Ethereum', action: `log in to ${claimed} by signing a message` };
  }
  return { kind: 'message', title: 'Sign a message', action: 'sign a text message' };
}

/** True for built-in tokens and protocols, which must never be reported as scams. */
export function isKnownAddress(chainId, address) {
  return Boolean(tokenInfo(chainId, address) || spenderLabel(address));
}
