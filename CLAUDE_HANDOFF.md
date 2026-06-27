# Treasury Sweeper Hardening — Handoff

**Last updated:** 2026-06-27
**Branch:** `main` (all work pushed)
**Head commit:** `556b33e5`
**Build:** `npm run build` passes (118 routes, 0 TS errors). `npm test` → 22 passing.

---

## Mission

Make the BSC USDT treasury sweeper production-ready. Original production
blocker: **gas funding occasionally underfunded deposit wallets** (e.g. balance
`6212800000000` vs required `6212880000000`, an 80000-wei shortfall), so the
USDT sweep tx could not afford its own gas.

## Root cause (now fixed)

Funding was computed from `getGasPrice()` + `estimateContractGas()` at one
moment, but the actual sweep tx was prepared independently
(`prepareTransactionRequest`) and could pick a **higher EIP-1559 `maxFeePerGas`**
or a different gas limit. There was no hard cap tying the tx cost to the funded
amount, so any upward drift underfunded the wallet.

## The fix (structural, not a patch)

A single **pinned gas plan** is used for BOTH the funding math and the actual
transaction:

- `gasLimit  = rawEstimate * 1.20` (floored at the 100k ERC20 minimum)
- `gasPrice  = max(networkPrice, 1 gwei) * 1.30`, forced **legacy**
- `maxTxCost = gasLimit * gasPrice`
- `fundingTarget = max(maxTxCost, 0.00002 BNB)`

Because BSC legacy gas charges exactly `gasPrice` and never exceeds `gasLimit`,
`actualCost <= maxTxCost <= fundingTarget`. The sweep tx is signed with the
plan's `gasLimit`/`gasPrice` verbatim (`send-signed.ts` now accepts a pinned
legacy `gasPrice`). **Underfunding is now provably impossible**, proven by tests.

---

## What was done (commit by commit)

| Commit | Phase | Summary |
|--------|-------|---------|
| `9211e5ac` | 1 | Pinned legacy gas plan in `gas.ts`; `send-signed.ts` accepts pinned `gasPrice`/`nonce` |
| `e73ea1a8` | 1 | `ensureGasFunded()` — verify→top-up→retry (x3), returns the plan the sweep is signed with |
| `2a6597b3` | 7 | vitest + 15 gas tests incl. the underfunding-invariant proof and the exact 80000-wei bug |
| `04d4b7ed` | 4 | `getTxLiveness()`; drop-detection so a dropped sweep tx is re-sent (safe by nonce reuse) |
| `b139b804` | 3 | `SystemLock` table + `system-lock.ts`; serialize drains so cron+admin can't race the treasury nonce |
| `57327996` | 3 | Lock the admin single-tick path too (`runSweeperTickGuarded`) |
| `5fa1ace3` | 5 | Structured gas diagnostics (treasury, estimate, price, funding amount, balance delta, cost) |
| `3483681f` | 7 | 7 tests for `getTxLiveness` + timeout detection (suite → 22) |
| `bc39feb4` | 6 | `previewUsdtSweepCost()` + "Live gas economics" card in admin panel |
| `59568571` | 2 | Extract `refundLeftoverBnbToTreasury()`; recover leftover gas on interrupted-before-refund |
| `556b33e5` | — | Document sweeper env knobs in `.env.example` |

## Key files

- `src/deposits/blockchain/gas.ts` — pinned gas planner (the heart of the fix) + `gas.test.ts`
- `src/deposits/blockchain/send-signed.ts` — pinned legacy gasPrice/nonce on raw sends
- `src/deposits/sweeper/address-sweep.ts` — `ensureGasFunded()` (verify/top-up/retry + diagnostics)
- `src/deposits/sweeper/sweep-deposit.ts` — orchestration; dropped-tx recovery; reusable refund
- `src/deposits/sweeper/confirmations.ts` — `getTxLiveness()` + `confirmations.test.ts`
- `src/deposits/sweeper/runner.ts` — lock-guarded `runSweeperUntilDone` / `runSweeperTickGuarded`
- `src/lib/system-lock.ts` — portable cross-process mutex (SQLite dev + Postgres prod)
- `prisma/schema.prisma` — new `SystemLock` model (auto-applied via `prisma db push` in build)
- `src/app/api/admin/sweeps/stats/route.ts` + `AdminSweepsPage.tsx` — live gas economics

## Invariants now guaranteed

1. **No underfunding** — funded amount always covers the pinned worst-case tx cost.
2. **No duplicate sweeps** — per-deposit DB claims + a global drain lock.
3. **No nonce races** — cron and admin runs are serialized on `SWEEPER_LOCK_KEY`.
4. **No stuck-forever tx** — dropped sweep txs are detected and re-sent (nonce-safe).
5. **No stranded gas** — leftover BNB is refunded even if a run is interrupted post-sweep.

---

## Verification done

- `npm run build` after every commit — clean (mirrors the Vercel build).
- `npm test` — 22 hermetic tests pass, including:
  - `fundingTarget >= worst-case tx cost` across a wide gas-price/estimate matrix
  - exact reproduction of the 80000-wei production shortfall
  - gas-price spike demands strictly more funding
  - dropped/pending/mined tx classification
- `SystemLock` proven against the dev DB (mutual exclusion, stale-lease steal,
  exactly-one-of-five concurrent runs) via a throwaway smoke script.

## NOT verified (needs access this environment lacks)

- **Live Vercel deployment status** — no `gh`/`vercel` CLI here. Pushes to
  `main` auto-deploy; confirm in the Vercel dashboard. Local build parity is green.
- **Real on-chain end-to-end** (Phase 10) — needs a funded treasury key + real
  deposits. The logic is unit-proven; do a small real test deposit before relying
  on it for large volumes. Watch the new structured logs (`[deposit-sweeper]`) for
  `gas_funding_complete` (shows funded amount vs maxTxCost) and `refund_confirmed`.

## Suggested next steps

1. Confirm the latest deploy is live in Vercel and that `prisma db push` applied
   the `SystemLock` table to the prod Postgres DB (the build runs it).
2. Run one real small deposit through the sweeper; verify on-chain that funding
   ≈ `gasPreview.perSweepFundingBnb` and the sweep + refund both confirm.
3. Optional perf (Phase 9): the sweep path re-reads balances a few times; could
   be trimmed, but correctness was prioritized over RPC-call count.
4. Optional: lower `MIN_GAS_PRICE_WEI` in `gas.ts` from 1 gwei to 0.1 gwei to
   match BSC's current floor and reduce harmless gas overfunding (would need the
   `getPinnedGasPrice` test expectation updated).

## How to resume

```bash
cd F:/nft
npm install        # vitest is now a devDependency
npm run build      # must stay green
npm test           # 22 tests must pass
git log --oneline -12
```

All tunables are documented in `.env.example` under "Treasury deposit sweeper".
