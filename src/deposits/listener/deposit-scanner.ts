import { scanUsdtTransfersUnified } from "@/payments/listener/unified-scanner";
import { updateDepositConfirmations } from "@/deposits/services/confirm-deposit";
import { uniqueDepositAddressesEnabled } from "@/lib/env";

/** Scan BSC USDT transfers to unique user deposit addresses (unified cursor). */
export async function scanUserDepositTransfers(options?: {
  maxBlocks?: number;
  onlyAddresses?: `0x${string}`[];
}) {
  if (!uniqueDepositAddressesEnabled()) {
    return { scanned: 0, matched: 0 };
  }

  const result = await scanUsdtTransfersUnified({
    maxBlocks: options?.maxBlocks,
    onlyDepositAddresses: options?.onlyAddresses,
    advanceCursor: !options?.onlyAddresses?.length,
  });

  await updateDepositConfirmations();

  return {
    scanned: result.scanned,
    matched: result.depositMatched,
  };
}
