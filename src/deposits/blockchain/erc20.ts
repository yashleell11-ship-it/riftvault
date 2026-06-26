import { parseAbiItem } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";

export const ERC20_TRANSFER_ABI = [
  parseAbiItem("function transfer(address to, uint256 amount) returns (bool)"),
  parseAbiItem("function balanceOf(address account) view returns (uint256)"),
] as const;

export async function readUsdtBalance(
  client: PublicClient,
  address: `0x${string}`
): Promise<bigint> {
  return client.readContract({
    address: getUsdtTokenAddress(),
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

export async function transferFullUsdtBalance(
  wallet: WalletClient,
  publicClient: PublicClient,
  from: `0x${string}`,
  to: `0x${string}`
): Promise<{ hash: `0x${string}`; amount: bigint } | null> {
  const token = getUsdtTokenAddress();
  const balance = await readUsdtBalance(publicClient, from);
  if (balance <= 0n) return null;

  const hash = await wallet.writeContract({
    address: token,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, balance],
    account: from,
    chain: wallet.chain,
  });

  return { hash, amount: balance };
}
