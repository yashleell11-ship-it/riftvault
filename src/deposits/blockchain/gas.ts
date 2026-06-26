import type { PublicClient } from "viem";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { ERC20_TRANSFER_ABI } from "@/deposits/blockchain/erc20";

const NATIVE_TRANSFER_GAS = 21_000n;
const GAS_BUFFER_NUM = 12n;
const GAS_BUFFER_DEN = 10n;

/** Gas limit + cost for one BEP20 USDT transfer from `from` to `to`. */
export async function estimateUsdtTransferGas(
  client: PublicClient,
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Promise<{ gasLimit: bigint; gasCost: bigint; gasPrice: bigint }> {
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
    gasLimit = 80_000n;
  }

  const buffered = (gasLimit * GAS_BUFFER_NUM) / GAS_BUFFER_DEN;
  const gasCost = buffered * gasPrice;
  return { gasLimit: buffered, gasCost, gasPrice };
}

/** Gas cost for one native BNB transfer (refund sweep). */
export async function estimateNativeTransferGas(
  client: PublicClient
): Promise<{ gasLimit: bigint; gasCost: bigint; gasPrice: bigint }> {
  const gasPrice = await client.getGasPrice();
  const gasLimit = NATIVE_TRANSFER_GAS;
  const gasCost = gasLimit * gasPrice;
  return { gasLimit, gasCost, gasPrice };
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
