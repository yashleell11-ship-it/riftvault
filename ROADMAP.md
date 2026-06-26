# RiftVault — Build Roadmap

Small phases so each chat session stays focused. Say **"do Phase N"** to continue.

---

## Phase 1 — Foundation ✅
- Next.js + TypeScript + Tailwind dark theme
- Unique design system (teal + gold accents, Syne + DM Sans)
- Layout: header, footer, mobile nav
- Landing page with hero, features, CTA
- Auth UI shells: login, signup, forgot password
- Placeholder pages: Explore, Earn, Reserve, Airdrop

---

## Phase 2 — Auth backend ✅
- PostgreSQL + Prisma schema (`users`, `sessions`)
- Email/password signup & login API routes
- JWT or session cookies
- Protected route middleware
- Email verification flow (Resend or similar)

---

## Phase 3 — Explore marketplace UI ✅
- NFT grid with skeleton loaders
- Search + filters (price, collection, status)
- NFT detail page layout
- Mock/seed data from JSON or DB

---

## Phase 4 — Database & NFT catalog ✅
- Prisma models: `collections`, `nfts`, `listings`
- Admin seed script for sample NFTs
- API: `GET /api/nfts`, `GET /api/nfts/[id]`
- Live stats on homepage (real counts)

---

## Phase 5 — User dashboard shell ✅
- `/dashboard` layout (sidebar)
- Profile page, settings
- My NFTs / My orders empty states
- User level badge (LV1 default)

---

## Phase 6 — Reserve flow ✅
- Daily reservation slots by level
- Midnight reset logic (timezone config)
- Reserve confirmation modal
- `reservations` table + API

---

## Phase 7 — List & sell flow ✅
- List reserved NFT for sale
- Fixed-price listing UI
- Order creation (off-chain ledger first)

---

## Phase 8 — Earn dashboard ✅
- Trading reward history
- Referral link generation
- Earnings breakdown charts
- Level progression display

---

## Phase 9 — Referral system ✅
- 1–2 level referral tracking (ethical cap)
- Commission on platform fees only
- Team list UI

---

## Phase 10 — Wallet ledger (pre-chain) ✅
- Internal balance: deposit, withdraw requests
- Transaction history table
- Admin approval queue for withdrawals

---

## Phase 11 — Airdrop module ✅
- Campaign CRUD (admin)
- Eligibility rules + claim UI
- Claim history

---

## Phase 12 — Wallet connect (wagmi + viem) ✅
- Connect MetaMask / WalletConnect
- Link wallet to user account
- Display on-chain address in profile

---

## Phase 13 — Smart contracts (testnet) ✅
- NFT ERC-721 collection contract
- Marketplace contract (list/buy)
- Deploy to Sepolia or Polygon Amoy

---

## Phase 14 — On-chain payments ✅
- Pay with ETH via marketplace contract
- Tx verification + DB sync (`/api/orders/buy-onchain`)
- Balance pay still works for USDT/BNB/BTC listings

---

## Phase 15 — Platform token (RVLT) ✅
- `TokenStake` Prisma model (userId, amount, stakedAt, status, unstakedAt)
- `src/lib/token.ts` — RVLT off-chain ledger helpers (creditRvlt, debitRvlt, getRvltBalance, getStakedAmount); NEXT_PUBLIC_RVLT_TOKEN_ADDRESS env for on-chain plug-in
- API: GET /api/token/balance, POST /api/token/stake, POST /api/token/unstake
- `/earn` page: new RVLT section (balance cards, stake form, active stakes list + unstake)
- Airdrop claim route extended: campaigns with currency="RVLT" credit to RVLT ledger
- Seed: 1 000 RVLT for demo user, 250 for collector; RVLT Genesis Drop airdrop campaign
- Utility-only messaging — no yield/return promises
- Fixed pre-existing build blockers: tsconfig excludes contracts/ + scripts/, target upgraded to ES2020 for wagmi BigInt code, hardhat.config.ts type fix, profile page missing Input import

---

## Phase 16 — Admin panel ✅
- `User.role` ("user"|"admin"), `User.frozen` — demo@riftvault.io seeded as admin
- Route group `/admin` with sidebar + client-side role guard
- Pages: `/admin` overview, `/admin/users` (freeze/unfreeze/promote), `/admin/withdrawals` (approve/reject), `/admin/nfts` (upload form), `/admin/airdrops` (CRUD)
- APIs: `/api/admin/users`, `/api/admin/withdrawals/[id]`, `/api/admin/nfts`, `/api/admin/airdrops`, `/api/admin/airdrops/[id]`
- Admin link added to header dropdown for admin users

---

## Phase 17 — Polish & production ✅
- `sonner` Toaster added to root layout (dark theme, bottom-right)
- `loading.tsx` + `error.tsx` for `(main)` and `dashboard` route groups
- `sitemap.ts` + `robots.ts` added
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.) in `next.config.ts`
- `tsconfig.json` fixed: excludes `contracts/` + `scripts/`, target upgraded to ES2020

---

## Phase 18 — Auctions & offers ✅
- `Auction`, `Bid`, `Offer` Prisma models
- `POST /api/auctions` — create timed auction; `POST /api/auctions/[id]/bid` — place bid with balance check + outbid notification
- `POST /api/offers`, `PATCH /api/offers/[id]` — make/accept/reject offers with atomic balance transfer
- `GET /api/cron/close-auctions` — settles expired auctions, transfers funds, creates orders

---

## Phase 19 — Collection creator tools ✅
- `User.isCreator`, `Collection.creatorId`, `Collection.royaltyBps` fields
- `POST /api/creator/collections`, `POST /api/creator/nfts` (batch up to 50)
- `/dashboard/create` — 2-step wizard: collection details → batch NFT upload
- `/creator/[userId]` — public creator profile showing all collections

---

## Phase 20 — Real-time notifications ✅
- `Notification` model — type, title, body, read, link
- `GET /api/notifications`, `PATCH /api/notifications` (mark all read), `PATCH /api/notifications/[id]`
- Header bell icon with unread badge — polls every 30 s
- Notifications fired on: withdrawal approved/rejected, offer received/accepted/rejected, auction outbid/won

---

## Phase 21 — Multi-chain support ✅
- `src/lib/chains.ts` — Ethereum Sepolia, BNB Testnet, Polygon Amoy config (chainId, RPC, explorer, native currency)
- `ChainSelector` dropdown in header — persists to localStorage + `User.preferredChain` via PATCH
- `User.preferredChain` field added to schema + profile PATCH API

---

## Phase 22 — Analytics & reporting ✅
- `GET /api/admin/analytics` — total volume, users, orders/day (14d), top collections (admin only)
- `/admin/analytics` — CSS bar chart + collection leaderboard
- `GET /api/user/analytics` — personal P&L, spend/earn, rewards breakdown, RVLT balance
- `/dashboard/analytics` — P&L card, rewards bars, RVLT stat
- `GET /api/user/orders/export?format=csv` — CSV download of all orders

---

## Phase 23 — Public API & webhooks ✅
- `ApiKey` model — hashed keys with prefix, max 5 per user
- `Webhook` model — URL, HMAC secret, event filter, max 3 per user
- `src/lib/apikeys.ts` — key generation, SHA-256 validation, in-memory rate limiter (60 req/min)
- `POST /api/developer/keys`, `DELETE /api/developer/keys/[id]`
- `POST /api/developer/webhooks`; `POST /api/webhooks/test` — fires signed test payload
- `GET /api/v1/nfts`, `GET /api/v1/collections` — public read-only, API-key gated
- `/dashboard/developer` — key management + webhook config + quick-reference table
- `/developers` — public API docs page (auth, endpoints, webhook signing)

---

## Phase 24 — Mobile PWA ✅
- `manifest.ts`, service worker, install prompt
- Offline fallback page `/offline`
- Apple mobile web app meta tags

---

## Phase 25 — Fiat on-ramp ~~removed~~
- Superseded by crypto-only wallet (ledger + on-chain pay). No card or bank flows.

---

## Phase 26 — RVLT governance ✅
- `GovernanceProposal` + `GovernanceVote` models
- `/governance` — create proposals, vote with staked RVLT weight
- APIs under `/api/governance`

---

## Phase 27 — Cross-chain bridge intents ✅
- `BridgeIntent` model + `/api/bridge`
- `/dashboard/bridge` — route picker, intent tracking
- External bridge docs (no custody)

---

## Phase 28 — KYC withdrawal tiers ✅
- `KycProfile` model + tier limits on withdraw
- `/dashboard/verification` submit flow
- `PATCH /api/admin/kyc/[userId]` for admin review

---

## Phase 29 — White-label tenants ✅
- `Tenant` model + `NEXT_PUBLIC_TENANT_SLUG`
- `getTenantBranding()` + CSS accent override
- Default `riftvault` tenant in seed

---

## Phase 25b — Stripe Checkout ~~removed~~
- Removed — international crypto-only product (no Stripe).

---

## Phase 28b — Admin KYC queue ✅
- `/admin/kyc` — approve tier 1/2 or reject
- `GET /api/admin/kyc`

---

## Phase 27b — Bridge intent tracking ✅
- User intents on `GET /api/bridge`
- `PATCH /api/bridge/[id]` — tx hash + complete
- `/dashboard/bridge` intent list UI

---

## Phase 24b — PWA icons ✅
- `src/app/icon.svg` + `src/app/apple-icon.svg`
- Manifest maskable icon entry

---

## Phase 30 — Fiat off-ramp ~~removed~~
- Removed — crypto withdrawals only via `/api/wallet/withdraw` + admin queue.

---

## Phase 31 — 2FA / TOTP ✅
- `User.totpSecret`, `User.totpEnabled`
- `/dashboard/settings` — setup, enable, disable
- Login challenge + `POST /api/auth/2fa/verify-login`

---

## Phase 32 — Admin audit log ✅
- `AuditLog` model + `logAudit()` helper
- Wired to user/KYC/withdrawal/tenant admin actions
- `/admin/audit`

---

## Phase 33 — Tenant admin ✅
- `GET/POST /api/admin/tenants`, `PATCH/DELETE /api/admin/tenants/[id]`
- `/admin/tenants` — create, activate/deactivate branding

---

## Production hardening

### H1 — Postgres + deploy guide ✅
### H2 — Vercel Cron for auctions ✅
- `vercel.json` — `GET /api/cron/close-auctions` runs hourly via Vercel Cron
- Route protected by `CRON_SECRET` env var (`Authorization: Bearer <secret>` header); dev allows unauthenticated
- `docs/DEPLOY.md` already documents `CRON_SECRET`

### H3 — Upstash rate limiting ✅
- `src/lib/apikeys.ts` — `checkRateLimit()` now async; uses Upstash Redis REST pipeline (INCR + EXPIRE) when `UPSTASH_REDIS_REST_URL/TOKEN` set
- Falls back to in-memory map (original behavior) when env vars absent — zero-config dev
- Callers in `/api/v1/nfts` and `/api/v1/collections` updated to `await checkRateLimit()`

### H4 — Pinata IPFS for admin NFT upload ✅
- `src/lib/pinata.ts` — `uploadFileToPinata()`, `uploadJsonToPinata()`, `ipfsToHttp()`, `isPinataConfigured()`
- `POST /api/admin/nfts` — accepts both JSON (URL) and `multipart/form-data` (file); auto-pins to Pinata + generates metadata JSON when `PINATA_JWT` set
- `/admin/nfts` UI — drag-and-drop file input with preview; URL field as fallback; shows IPFS status
- `GET /api/admin/pinata-status` — tells UI whether IPFS upload is available

### H5 — Resend email ✅
- `src/lib/email.ts` — fully styled HTML templates for all transactional emails; `send()` helper with dev console fallback
- New: `sendWithdrawalStatusEmail()` fired from `PATCH /api/admin/withdrawals/[id]` (non-blocking)
- New: `sendOfferReceivedEmail()` fired from `POST /api/offers` to NFT owner (non-blocking)
- Existing: `sendVerificationEmail()` + `sendPasswordResetEmail()` upgraded with branded HTML

### H6 — On-chain RVLT token ✅
- `contracts/src/RiftVaultToken.sol` — ERC-20, symbol `RVLT`, 100M cap, burnable, owner-mintable
- `contracts/scripts/deploy.js` — deploys NFT + Marketplace + Token; prints `NEXT_PUBLIC_RVLT_TOKEN_ADDRESS`
- `docs/CONTRACTS.md` — updated with RVLT contract details and on-chain/off-chain fallback explanation

### H7 — On-chain list from dashboard ✅
- `POST /api/listings/onchain` — saves `chainListingId`, `chainTokenId`, creates/updates `Listing` row at ETH price
- `src/lib/types.ts` — `NftItem` extended with `chainTokenId` + `chainListingId`
- `OnchainListModal` component — 3-step wagmi flow: price → approve marketplace → list on-chain → sync DB
- `/dashboard/nfts` — "List on-chain (ETH)" button shown when `chainEnabled && chainTokenId` set

### H8 — Auction/offer UI audit ✅
- `GET /api/auctions?nftId=` added — returns active auction + recent bids for NFT detail page
- `AuctionSection` client component — live countdown, current bid, bid form with min-bid enforcement, bid history
- `MakeOfferModal` — offer amount, currency, expiry; calls `POST /api/offers`; owner gets email + notification
- `MakeOfferTrigger` — client wrapper so server page stays RSC
- `/explore/[id]` — wires `AuctionSection` (for `status=auction`) and `MakeOfferTrigger` (for listed/auction, non-owners)

---

## Phase 34 — Production wallet guard ✅
- `src/lib/env.ts` — `isProduction()`, `allowDemoDeposits()`, `uniqueDepositAddressesEnabled()`
- `POST /api/wallet/deposit` blocked in production unless `ALLOW_DEMO_DEPOSITS=true`
- Wallet deposit UI switches between demo credit (dev) and report-deposit flow (prod)

## Phase 35 — Crypto deposit schema ✅
- `UserDepositAddress` + `CryptoDeposit` Prisma models (prep for per-user addresses)
- `GET /api/wallet/deposit-info` — supported chains/assets, addresses, recent deposits
- `DepositPanel` component on `/dashboard/wallet` with “unique addresses coming soon” banner

## Phase 36 — Admin deposit queue ✅
- `POST /api/wallet/deposit/report` — user reports on-chain transfer (pending review)
- `GET /api/admin/deposits`, `PATCH /api/admin/deposits/[id]` — confirm/reject + credit ledger
- `/admin/deposits` — admin review queue with audit log entries

## Phase 37 — Unique deposit address per user ✅
- HD-derived `UserDepositAddress` per user from `DEPOSIT_MNEMONIC` (BSC + USDT)
- `src/deposits/` — derive, provision, auto-scan, auto-credit wallet
- Deposit listener integrated into `runPaymentListenerTick` + `npm run payments:listen`
- Wallet `DepositPanel` — personal address, QR code, live status polling
- Manual report form hidden when `ENABLE_UNIQUE_DEPOSIT_ADDRESSES=true`

## Phase 38 — USDT BEP20 self-hosted checkout ✅
- `src/payments/` modular architecture (blockchain, listener, services, database)
- `UsdtPaymentOrder`, `UsdtPayment`, `PaymentTransaction`, `PaymentListenerState` models
- Checkout `/checkout/usdt/[id]` with QR, live SSE status, polling fallback
- `POST /api/payments/usdt/create`, status + stream APIs, cron scan route
- `scripts/payment-listener.ts` for VPS/PM2 (`npm run payments:listen`)
- `RECEIVING_WALLET` env — Ledger-ready without code changes
- Docs: `docs/USDT_PAYMENTS.md`

### H1 — Postgres + deploy guide ✅
- `docs/DEPLOY.md` — step-by-step Vercel + Neon/Supabase deployment guide
- `prisma/schema.prisma` — comment block explaining `sqlite` (dev) → `postgresql` (prod) provider switch
- `.env.example` — documented postgres `DATABASE_URL`, added H2/H3/H4 env stubs
- No schema migration needed; `prisma db push` works for both providers

---

## Run locally

```bash
npm install
npm run db:setup   # create DB + seed sample data
npm run dev
```

**Demo account:** `demo@riftvault.io` / `password123`

Open [http://localhost:3000](http://localhost:3000)
