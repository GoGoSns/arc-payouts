# Arc Global Payouts

> Global USDC payments on Arc Network — built by GoGo

**Live:** [arc-payouts.vercel.app](https://arc-payouts.vercel.app)

---

## What is it?

Arc Global Payouts is a Web3 payment platform built on Arc Network. Send USDC to anyone with just a wallet address or @handle — no banks, no delays, no limits.

Think PayPal meets Web3. But faster. And free.

---

## Features

| Feature | Description |
|---|---|
| **Send** | Instant USDC transfers via @handle or wallet address |
| **Batch** | Pay hundreds of people at once — CSV import supported |
| **Bridge** | Cross-chain USDC transfers (ETH / ARB / OP / Base → Arc) |
| **Swap** | Token swaps on Arc Testnet (USDC ↔ EURC ↔ ETH) |
| **Pay Link** | Your personal payment link — share it, get paid |
| **AI Assistant** | Groq-powered AI — "Send 10 USDC to @alice" |
| **Tetris** | USDC Tetris — bet USDC with friends on high scores |
| **Contacts** | Address book for frequent recipients |
| **Schedule** | Schedule future payments |
| **Split** | Split bills with friends |
| **NFT Receipt** | Mint your transaction as an NFT (IPFS) |

---

## Tech Stack

- **Framework:** Next.js 16 + TypeScript
- **Wallet:** Wagmi + MetaMask
- **Payments:** Circle AppKit (send, bridge, swap)
- **Database:** Upstash Redis
- **Auth:** X OAuth 2.0 with PKCE
- **AI:** Groq — llama-3.3-70b-versatile
- **Storage:** Pinata IPFS
- **Deploy:** Vercel

---

## Getting Started

### 1. Add Arc Testnet
→ [thirdweb.com/arc-testnet](https://thirdweb.com/arc-testnet)

### 2. Get Test USDC
→ [faucet.circle.com](https://faucet.circle.com)

### 3. Connect & Go
→ [arc-payouts.vercel.app](https://arc-payouts.vercel.app)

---

## How Pay Links Work

1. Connect wallet + login with X
2. Profile saved to Redis with wallet address
3. Share: `arc-payouts.vercel.app/pay/yourusername`
4. Anyone sends you USDC — no login required

---

## Built by GoGo

- X: [@0xGoGochain](https://x.com/0xGoGochain)
- GitHub: [github.com/GoGoSns](https://github.com/GoGoSns)

---

*Built on Arc Network · Powered by Circle AppKit · Sub-second finality*
