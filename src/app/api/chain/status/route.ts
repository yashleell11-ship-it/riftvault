import { NextResponse } from "next/server";
import { isChainPaymentsEnabled } from "@/lib/chain/verify";
import { getContractAddresses } from "@/lib/contracts";
import { getTargetChainId } from "@/lib/wagmi";

export async function GET() {
  return NextResponse.json({
    enabled: isChainPaymentsEnabled(),
    chainId: getTargetChainId().id,
    chainName: getTargetChainId().name,
    contracts: getContractAddresses(),
    nativeCurrency: getTargetChainId().nativeCurrency.symbol,
  });
}
