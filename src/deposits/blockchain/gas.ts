import type { PublicClient } from "viem";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { ERC20_TRANSFER_ABI } from "@/deposits/blockchain/erc20";

/**
 * Deterministic gas planning for the treasury sweeper.
 *
 * The cardinal rule: the SAME pinned (gasLimit, gasPrice) pair is used to
 * (a) compute how much BNB to fund a deposit wallet with and (b) sign the
 * actual sweep transaction. Because BSC charges legacy gas at exactly the
 * gasPrice you set (and never more than gasLimit units), pinning both values
 * makes the maximum on-chain cost provably bounded:
 *
 *     actualCost = gasUsed * gasPrice  <=  gasLimit * gasPrice = maxTxCost
 *
 * As long as we fund `fundingTarget >= maxTxCost`, the wallet can NEVER be
 * underfunded — regardless of gas-price drift or EIP-1559 fee inflation
 * between estimation and broadcast. This is the root-cause fix for the
 * "funded slightly less than required" production bug.
 */

const NATIVE_TRANSFER_GAS = 21_000n;
const USDT_TRANSFER_GAS_FALLBACK = 100_000n;

/** Gas-limit safety margin applied to the raw estimate (1.20x). */
const GAS_LIMIT_MARGIN_NUM = 12n;
const GAS_LIMIT_MARGIN_DEN = 10n;

/** Gas-price safety margin applied to the network price (1.30x — per spec). */
const GAS_PRICE_MARGIN_NUM = 13n;
const GAS_PRICE_MARGIN_DEN = 10n;

/** Floor on the network gas price so a near-zero RPC reading never strands a tx. */
const MIN_GAS_PRICE_WEI = 1_000_000_000n; // 1 gwei (BSC effective minimum)

/** Minimum BNB a deposit wallet must hold before sweeping (0.00002 BNB). */
export const MIN_GAS_FUNDING_BUFFER_WEI = 20_000_000_000_000n;

export type GasEstimate = {
  /** Pinned gas limit for the actual tx (raw estimate * margin). */
  gasLimit: bigint;
  /** Pinned legacy gas price for the actual tx (network price * margin). */
  gasPrice: bigint;
  /** Hard upper bound on tx cost at the pinned params: gasLimit * gasPrice. */
  gasCost: bigint;
  /** BNB the deposit wallet must hold before sweeping: max(gasCost, MIN_BUFFER). */
  fundingTarget: bigint;
  /** Raw network gas price before margin (diagnostics only). */
  rawGasPrice: bigint;
  /** Raw gas-limit estimate before margin (diagnostics only). */
  rawGasLimit: bigint;
};

function applyMargin(value: bigint, num: bigint, den: bigint): bigint {
  return (value * num) / den;
}

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** Latest network gas price, floored at a sane minimum and margin-padded for pinning. */
export async function getPinnedGasPrice(client: PublicClient): Promise<{
  rawGasPrice: bigint;
  gasPrice: bigint;
}> {
  const network = await client.getGasPrice();
  const rawGasPrice = maxBig(network, MIN_GAS_PRICE_WEI);
  const gasPrice = applyMargin(rawGasPrice, GAS_PRICE_MARGIN_NUM, GAS_PRICE_MARGIN_DEN);
  return { rawGasPrice, gasPrice };
}

/**
 * Plan gas for one BEP20 USDT transfer from `from` to `to`.
 *
 * Returns pinned (gasLimit, gasPrice) that MUST be passed verbatim to the
 * actual sweep transaction so the funded amount provably covers the cost.
 */
export async function estimateUsdtTransferGas(
  client: PublicClient,
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Promise<GasEstimate> {
  const token = getUsdtTokenAddress();
  const { rawGasPrice, gasPrice } = await getPinnedGasPrice(client);

  let rawGasLimit: bigint;
  try {
    rawGasLimit = await client.estimateContractGas({
      address: token,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [to, amount],
      account: from,
    });
  } catch {
    rawGasLimit = USDT_TRANSFER_GAS_FALLBACK;
  }

  // Never trust an estimate below the known floor for an ERC20 transfer.
  if (rawGasLimit < USDT_TRANSFER_GAS_FALLBACK) {
    rawGasLimit = USDT_TRANSFER_GAS_FALLBACK;
  }

  const gasLimit = applyMargin(rawGasLimit, GAS_LIMIT_MARGIN_NUM, GAS_LIMIT_MARGIN_DEN);
  const gasCost = gasLimit * gasPrice;
  const fundingTarget = maxBig(gasCost, MIN_GAS_FUNDING_BUFFER_WEI);

  return { gasLimit, gasPrice, gasCost, fundingTarget, rawGasPrice, rawGasLimit };
}

/**
 * Plan gas for one native BNB transfer (the refund of leftover gas).
 *
 * `gasCost`/`fundingTarget` here is the exact reserve to withhold so the
 * refund tx itself is affordable — NOT floored at MIN_GAS_FUNDING_BUFFER_WEI,
 * otherwise that buffer would be permanently stranded at the deposit address.
 */
export async function estimateNativeTransferGas(
  client: PublicClient
): Promise<GasEstimate> {
  const { rawGasPrice, gasPrice } = await getPinnedGasPrice(client);
  const gasLimit = NATIVE_TRANSFER_GAS;
  const gasCost = gasLimit * gasPrice;
  return {
    gasLimit,
    gasPrice,
    gasCost,
    fundingTarget: gasCost,
    rawGasPrice,
    rawGasLimit: NATIVE_TRANSFER_GAS,
  };
}

/** BNB shortfall to reach the funding target from current balance. */
export function gasFundingShortfall(balance: bigint, fundingTarget: bigint): bigint {
  return balance >= fundingTarget ? 0n : fundingTarget - balance;
}

/** Sendable BNB after reserving gas for a native transfer (use fundingTarget, not raw gasCost). */
export function refundableBnbAmount(
  balance: bigint,
  gasReserve: bigint,
  minRefundWei = 0n
): bigint {
  const sendable = balance > gasReserve ? balance - gasReserve : 0n;
  return sendable >= minRefundWei ? sendable : 0n;
}

/** True when the address can afford a native transfer of `value` plus gas. */
export function canAffordNativeTransfer(
  balance: bigint,
  value: bigint,
  gasReserve: bigint
): boolean {
  return balance >= value + gasReserve;
}
