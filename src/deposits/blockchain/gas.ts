import type { PublicClient } from "viem";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { ERC20_TRANSFER_ABI } from "@/deposits/blockchain/erc20";

const NATIVE_TRANSFER_GAS = 21_000n;
const GAS_SAFETY_NUM = 12n;
const GAS_SAFETY_DEN = 10n;
/** Minimum extra BNB added on top of estimated gas (0.00002 BNB). */
export const MIN_GAS_FUNDING_BUFFER_WEI = 20_000_000_000_000n;
const USDT_TRANSFER_GAS_FALLBACK = 100_000n;

export type GasEstimate = {
  gasLimit: bigint;
  gasPrice: bigint;
  /** Raw estimate: gasLimit * gasPrice */
  gasCost: bigint;
  /** Amount the deposit address should hold before sweeping USDT */
  fundingTarget: bigint;
};

function applyFundingMargin(gasCost: bigint): bigint {
  const withMargin = (gasCost * GAS_SAFETY_NUM) / GAS_SAFETY_DEN;
  return withMargin + MIN_GAS_FUNDING_BUFFER_WEI;
}

/** Gas required for one BEP20 USDT transfer from `from` to `to`. */
export async function estimateUsdtTransferGas(
  client: PublicClient,
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Promise<GasEstimate> {
  const token = getUsdtTokenAddress();
  const gasPrice = await client.getGasPrice();

  let gasLimit: bigint;
  try {
    gasLimit = await client.estimateContractGas({
      address: token,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [to, amount],
      account: from,
    });
  } catch {
    gasLimit = USDT_TRANSFER_GAS_FALLBACK;
  }

  const gasCost = gasLimit * gasPrice;
  const fundingTarget = applyFundingMargin(gasCost);

  return { gasLimit, gasPrice, gasCost, fundingTarget };
}

/** Gas cost for one native BNB transfer (refund sweep). */
export async function estimateNativeTransferGas(
  client: PublicClient
): Promise<GasEstimate> {
  const gasPrice = await client.getGasPrice();
  const gasLimit = NATIVE_TRANSFER_GAS;
  const gasCost = gasLimit * gasPrice;
  return {
    gasLimit,
    gasPrice,
    gasCost,
    fundingTarget: applyFundingMargin(gasCost),
  };
}

/** BNB shortfall to reach the funding target from current balance. */
export function gasFundingShortfall(balance: bigint, fundingTarget: bigint): bigint {
  return balance >= fundingTarget ? 0n : fundingTarget - balance;
}

/** Sendable BNB after reserving gas for a native transfer. */
export function refundableBnbAmount(
  balance: bigint,
  gasCost: bigint,
  minRefundWei = 0n
): bigint {
  const sendable = balance > gasCost ? balance - gasCost : 0n;
  return sendable >= minRefundWei ? sendable : 0n;
}
