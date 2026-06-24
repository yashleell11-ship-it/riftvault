# Deploying RiftVault to Vercel + Postgres

## Overview

| Environment | Database | Prisma provider |
|---|---|---|
| Local dev | `dev.db` (SQLite) | `sqlite` |
| Production | Neon or Supabase (Postgres) | `postgresql` |

The only file that changes between environments is `prisma/schema.prisma` (one line).  
All other code is identical.

---

## 1 · Create a Postgres database

### Option A — Neon (recommended, free tier)

1. Sign up at [neon.tech](https://neon.tech) → **Create project**
2. Copy the **Connection string** (starts with `postgresql://...`)

### Option B — Supabase

1. Sign up at [supabase.com](https://supabase.com) → **New project**
2. Go to **Settings → Database → Connection string → URI**
3. Replace `[YOUR-PASSWORD]` with your project password

---

## 2 · Switch Prisma to PostgreSQL

Edit `prisma/schema.prisma`, change the datasource block:

```prisma
datasource db {
  // ⬇ change "sqlite" → "postgresql" for production
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> **Undo for local dev:** revert to `provider = "sqlite"` and `DATABASE_URL="file:./dev.db"`.
> Keep the two schema files in sync — the models are identical.

---

## 3 · Push schema to Postgres

With the postgres provider set and `DATABASE_URL` pointing at your Neon/Supabase URL:

```bash
# First time — creates all tables
npx prisma db push

# Optional: generate a migration baseline for future ALTER TABLE tracking
npx prisma migrate dev --name init
```

Seed sample data (optional):

```bash
npm run db:seed
```

---

## 4 · Set environment variables in Vercel

### Required

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` |
| `AUTH_SECRET` | 32+ random chars — run `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

### Recommended

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Transactional email (H5) |
| `EMAIL_FROM` | `RiftVault <noreply@yourdomain.com>` |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints (H2) |
| `UPSTASH_REDIS_REST_URL` | Redis-backed rate limiting (H3) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis-backed rate limiting (H3) |
| `PINATA_JWT` | IPFS upload for admin NFT tool (H4) |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` (Sepolia) or `1` (mainnet) |
| `NEXT_PUBLIC_RPC_URL` | Alchemy/Infura RPC URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` | Deployed RiftVaultNFT address |
| `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS` | Deployed RiftVaultMarketplace address |

---

## 5 · Deploy

### Via Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

### Via GitHub integration

1. Push repo to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Set all env vars above under **Settings → Environment Variables**
4. Vercel auto-deploys on every push to `main`

---

## 6 · Post-deploy checklist

- [ ] Visit `https://your-app.vercel.app` — landing page loads
- [ ] Sign up with a real email — verification email arrives (if `RESEND_API_KEY` set)
- [ ] Log in as `demo@riftvault.io` / `password123` (if seeded)
- [ ] `/admin` redirects non-admins to `/dashboard`
- [ ] `/api/v1/nfts` with `X-API-Key` returns JSON
- [ ] Vercel Function logs show no Prisma connection errors

---

## 7 · Prisma in Vercel Functions

Vercel bundles the Prisma query engine automatically. The `postinstall` script
(`prisma generate`) runs during `vercel build` — no extra config needed.

If you see `PrismaClientInitializationError` in production logs, check:

1. `DATABASE_URL` is set and starts with `postgresql://`
2. Your Neon/Supabase IP allowlist includes Vercel's egress IPs (or is set to `0.0.0.0/0`)
3. `?sslmode=require` is appended to the connection string

---

## 8 · Custom domain

1. Vercel dashboard → **Domains** → Add your domain
2. Update `NEXT_PUBLIC_APP_URL` to the custom domain
3. Update `RESEND_API_KEY` sender domain for email deliverability

---

## Useful commands

```bash
# Regenerate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (DB browser) — works with both SQLite and Postgres
npx prisma studio

# Check migration status
npx prisma migrate status
```
