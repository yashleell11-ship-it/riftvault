# Smart Contracts — RiftVault

## Contracts

| Contract | File | Purpose |
|---|---|---|
| `RiftVaultNFT` | `src/RiftVaultNFT.sol` | ERC-721 — mint and store NFTs |
| `RiftVaultMarketplace` | `src/RiftVaultMarketplace.sol` | List / buy NFTs on-chain |
| `RiftVaultToken` | `src/RiftVaultToken.sol` | ERC-20 RVLT utility token (100M cap) |

## Prerequisites

1. MetaMask with Sepolia ETH
2. Alchemy/Infura RPC URL
3. Deployer wallet private key (never commit)

## Compile

Contracts use OpenZeppelin **v5** (Solidity 0.8.20).

```bash
# From repo root
npm run contracts:compile

# Or manually
cd contracts && npm install && npm run compile
```

## Setup `.env`

```env
NEXT_PUBLIC_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
DEPLOYER_PRIVATE_KEY="your_private_key"
```

## Deploy to Sepolia

```bash
npm run contracts:deploy
```

Copies addresses into `contracts/deployments.json` and prints them to the console. Paste into `.env`:

```env
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_RVLT_TOKEN_ADDRESS="0x..."
NEXT_PUBLIC_CHAIN_ID=11155111
```

Restart `npm run dev`.

## RiftVaultToken (RVLT) — H6

- ERC-20, symbol `RVLT`, 100M cap, burnable
- Constructor mints 10M to deployer for airdrop / liquidity seeding
- `mint(address to, uint256 amount)` — only callable by owner
- **Off-chain fallback:** when `NEXT_PUBLIC_RVLT_TOKEN_ADDRESS` is empty, the platform uses the off-chain RVLT ledger in `WalletTransaction` (currency = "RVLT")

## On-chain listing flow (H7)

1. User owns NFT on-chain (chainTokenId set)
2. Dashboard "List on-chain" button: user approves marketplace + calls `marketplace.list(nft, tokenId, priceWei)`
3. After tx confirms, frontend calls `POST /api/listings/onchain` with `{ nftId, txHash, chainListingId }`
4. Marketplace contract stores listing; buyers pay ETH directly to contract

## On-chain buy flow (Phase 14)

1. User clicks "Pay with wallet (ETH)" on `/explore/[id]` when `chainListingId` is set
2. Calls `marketplace.buy(listingId)` with ETH value
3. After tx confirms, calls `POST /api/orders/buy-onchain` to sync DB

## Manual mint (advanced)

```solidity
RiftVaultNFT.mint(sellerAddress, "ipfs://Qm...")
RiftVaultNFT.setApprovalForAll(marketplace, true)
RiftVaultMarketplace.list(nftAddress, tokenId, priceWei)
```
