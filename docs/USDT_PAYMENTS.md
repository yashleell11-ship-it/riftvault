# USDT BEP20 Self-Hosted Payments

Production-ready **USDT on BNB Smart Chain (BEP20)** checkout for RiftVault / NiftVault.

- **Self-hosted** — no Coinbase Commerce, NOWPayments, or third-party payment APIs
- **Receiving wallet** from `RECEIVING_WALLET` env (swap to Ledger later without code changes)
- **Live checkout** — QR code, address, amount, auto status updates (SSE + polling fallback)
- **Background listener** — scans BEP20 `Transfer` events, matches orders, confirms, fulfills NFT purchase

---

## Architecture

```
src/payments/
  blockchain/     # BSC RPC client, USDT contract, amounts, config
  database/       # Prisma repository helpers
  listener/       # Transfer scanner, matcher, runner
  services/       # Create order, fulfill, expire
  api/            # (Next.js routes in src/app/api/payments/)

scripts/payment-listener.ts   # Long-running listener for VPS/PM2
```

### Database models

| Model | Purpose |
|-------|---------|
| `UsdtPaymentOrder` | Checkout intent (amount, wallet, status, tx metadata) |
| `UsdtPayment` | Matched on-chain transfer record |
| `PaymentTransaction` | Status history / audit log |
| `PaymentListenerState` | Last scanned block (survives restarts) |

### Payment status flow

```
pending → detecting → confirming → paid
```

1. **pending** — waiting for customer to send USDT  
2. **detecting** — transfer seen on-chain  
3. **confirming** — building block confirmations  
4. **paid** — NFT order fulfilled  

---

## Installation

```bash
npm install
npx prisma generate
npx prisma db push
```

---

## Configuration

Copy variables into `.env` (local) or Vercel → Environment Variables (production).

### Required

| Variable | Example | Description |
|----------|---------|-------------|
| `RECEIVING_WALLET` | `0xYourWallet...` | BEP20 receiving address (dev wallet now, Ledger later) |
| `BSC_RPC_URL` | `https://bsc-dataseed.binance.org` | BNB Smart Chain JSON-RPC |
| `DATABASE_URL` | `postgresql://...` | Postgres (Neon) in production |

### Recommended

| Variable | Default | Description |
|----------|---------|-------------|
| `BSC_CHAIN_ID` | `56` | `56` mainnet, `97` testnet |
| `BSC_USDT_CONTRACT` | mainnet USDT | Override for testnet token |
| `PAYMENT_CONFIRMATIONS` | `12` | Blocks before marking paid |
| `PAYMENT_ORDER_EXPIRY_MINUTES` | `60` | Checkout window |
| `PAYMENT_LISTENER_POLL_MS` | `15000` | Standalone listener interval |
| `PAYMENT_LISTENER_LOOKBACK_BLOCKS` | `2000` | Initial scan depth |
| `CRON_SECRET` | random string | Protects `/api/cron/scan-usdt-payments` |

### Never set in client code

- Private keys — **not used**; customers send USDT to `RECEIVING_WALLET` from their own wallet.

---

## Running locally

1. Set `.env`:

```env
DATABASE_URL="postgresql://..."
RECEIVING_WALLET="0x..."
BSC_RPC_URL="https://bsc-dataseed.binance.org"
BSC_CHAIN_ID=56
```

2. Start the app:

```bash
npm run dev
```

3. **(Recommended)** Start the payment listener in a second terminal:

```bash
npm run payments:listen
```

The listener scans BSC for USDT transfers to your receiving wallet and auto-fulfills orders.

---

## Testing with a small USDT payment

1. Log in at `http://localhost:3000`
2. Open an NFT listed in **USDT** on `/explore/[id]`
3. Click **Pay with USDT (BEP20)**
4. On the checkout page, send **exactly** the shown amount (including unique suffix) from MetaMask/Trust Wallet on **BSC**
5. Watch status update live: Pending → Detected → Confirmations → Paid
6. NFT appears under **Dashboard → My NFTs**

**Tips**

- Use a tiny listing price for first test (e.g. 0.01 USDT)
- Amount must match **exactly** — the suffix distinguishes your order
- For faster tests on testnet: `BSC_CHAIN_ID=97` and a testnet USDT contract

---

## Deploying

### Vercel (app)

1. Add all env vars in Vercel project settings
2. Deploy — `prisma db push` runs on build
3. Add `CRON_SECRET` and enable cron `scan-usdt-payments` (every 5 min on Pro; Hobby may need standalone listener)

### Self-hosted listener (recommended for production)

On a VPS, PM2, or Railway worker:

```bash
npm run payments:listen
```

This is more reliable than cron-only on serverless.

### Vercel cron fallback

`vercel.json` includes:

```json
{ "path": "/api/cron/scan-usdt-payments", "schedule": "*/5 * * * *" }
```

Call with header: `Authorization: Bearer <CRON_SECRET>`

Checkout also triggers scans via SSE/polling while the user waits.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/payments/usdt/create` | Returns `{ enabled }` |
| `POST` | `/api/payments/usdt/create` | `{ nftId }` → `{ paymentOrderId, checkoutUrl }` |
| `GET` | `/api/payments/[id]/status` | Payment status (+ triggers scan) |
| `GET` | `/api/payments/[id]/stream` | SSE live updates |
| `GET` | `/api/cron/scan-usdt-payments` | Background scan (cron) |

---

## Future upgrades (architecture-ready)

| Feature | How to add later |
|---------|------------------|
| Ledger cold wallet | Change `RECEIVING_WALLET` env only |
| Unique address per order | Populate `UserDepositAddress`; listener matches `to` per order |
| Auto-sweep | New `sweeper` service + hot wallet key in env (separate from receiving) |
| Multi-currency | Extend `blockchain/` module per token contract |

---

## Unique deposit addresses (Phase 37)

Each user gets a **personal BSC address** derived from `DEPOSIT_MNEMONIC` (HD wallet).

| Variable | Description |
|----------|-------------|
| `ENABLE_UNIQUE_DEPOSIT_ADDRESSES` | `true` to enable |
| `DEPOSIT_MNEMONIC` | 12/24-word mnemonic (**server only**, never expose) |
| `BSC_RPC_URL` | Same as checkout |
| `PAYMENT_CONFIRMATIONS` | Blocks before wallet credit |

Users send USDT to their address on **Dashboard → Wallet**. The listener auto-detects and credits balance.

**Ledger later:** keep using HD mnemonic on a separate hot wallet, or swap to xpub-based derivation — architecture supports changing env only.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No **Pay with USDT** button | Set `RECEIVING_WALLET` + `BSC_RPC_URL`, redeploy |
| Payment not detected | Run `npm run payments:listen` or check RPC limits |
| Wrong amount | Must send **exact** `expectedAmount` from checkout |
| Expired order | Create new checkout — orders expire after `PAYMENT_ORDER_EXPIRY_MINUTES` |
| Wallet shows "Report deposit" instead of QR | Set `ENABLE_UNIQUE_DEPOSIT_ADDRESSES=true` and `DEPOSIT_MNEMONIC` (single line or multi-line 12/24 words), then redeploy |
| Listener exits immediately | `npm run payments:listen` loads `.env.production.local` via `@next/env`; ensure values are non-empty (re-run `vercel env pull` or copy from Vercel dashboard) |
| BscScan link 404 on testnet | Use `testnet.bscscan.com` when `BSC_CHAIN_ID=97` |

---

## Security

- No private keys in the codebase
- `txHash` uniqueness prevents double fulfillment
- Transfer `logIndex` uniqueness prevents duplicate log processing
- All blockchain amounts validated as raw integers (18 decimals)
- Cron routes protected by `CRON_SECRET` in production
