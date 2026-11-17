// Sample signing requests for demo mode. They let judges (and you, while recording
// the demo video) try SignSense without a wallet or real funds.

const USER = '0x1111111111111111111111111111111111111111';
const DRAINER = '0x9d3c1e5a7b2f4e6d8c0a1b3d5f7e9a2c4b6d8f01';
const pad = (hex) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const MAX = 'f'.repeat(64);

export const SAMPLES = {
  unlimited_usdc: {
    label: 'Unlimited USDC approval (unknown spender)',
    request: {
      origin: 'https://claim-usdc-rewards.xyz', chainId: 1, method: 'eth_sendTransaction',
      params: [{ from: USER, to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', value: '0x0', data: '0x095ea7b3' + pad(DRAINER) + MAX }],
    },
  },
  nft_all: {
    label: 'setApprovalForAll on an NFT collection',
    request: {
      origin: 'https://bayc-free-mint.io', chainId: 1, method: 'eth_sendTransaction',
      params: [{ from: USER, to: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', value: '0x0', data: '0xa22cb465' + pad(DRAINER) + pad('0x1') }],
    },
  },
  permit: {
    label: 'Gasless "signature" that is really a USDC permit',
    request: {
      origin: 'https://airdrop-check.app', chainId: 1, method: 'eth_signTypedData_v4',
      params: [USER, JSON.stringify({
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
          Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }],
        },
        primaryType: 'Permit',
        domain: { name: 'USD Coin', version: '2', chainId: 1, verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        message: { owner: USER, spender: DRAINER, value: '0x' + MAX, nonce: 0, deadline: 4102444800 },
      })],
    },
  },
  zero_listing: {
    label: 'NFT listing where you receive nothing',
    request: {
      origin: 'https://opensea-verify.net', chainId: 1, method: 'eth_signTypedData_v4',
      params: [USER, JSON.stringify({
        types: { OrderComponents: [] },
        primaryType: 'OrderComponents',
        domain: { name: 'Seaport', version: '1.6', chainId: 1, verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395' },
        message: {
          offerer: USER,
          offer: [{ itemType: 2, token: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', identifierOrCriteria: '1234', startAmount: '1', endAmount: '1' }],
          consideration: [{ itemType: 0, token: '0x0000000000000000000000000000000000000000', identifierOrCriteria: '0', startAmount: '1', endAmount: '1', recipient: DRAINER }],
        },
      })],
    },
  },
  siwe_phish: {
    label: 'Sign-in message for a different website',
    request: {
      origin: 'https://uniswap-airdrop.org', chainId: 1, method: 'personal_sign',
      params: ['0x' + Array.from(new TextEncoder().encode(
        `app.uniswap.org wants you to sign in with your Ethereum account:\n${USER}\n\nSign in to Uniswap.\n\nURI: https://app.uniswap.org\nVersion: 1\nChain ID: 1\nNonce: 8f2k1x9q\nIssued At: 2026-11-16T10:00:00Z`,
      )).map((b) => b.toString(16).padStart(2, '0')).join(''), USER],
    },
  },
  blind: {
    label: 'eth_sign blind signature',
    request: { origin: 'https://nft-mint-live.com', chainId: 1, method: 'eth_sign', params: [USER, '0x' + 'ab'.repeat(32)] },
  },
  safe_send: {
    label: 'Normal: send 0.05 ETH to a friend',
    request: {
      origin: 'https://app.example-wallet.com', chainId: 8453, method: 'eth_sendTransaction', toIsContract: false,
      params: [{ from: USER, to: '0x2222222222222222222222222222222222222222', value: '0xb1a2bc2ec50000', data: '0x' }],
    },
  },
};
