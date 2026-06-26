import { parseAbiItem } from "viem";
import { getUsdtContractAddress } from "@/payments/blockchain/config";

export const USDT_DECIMALS = 18;

export const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export const USDT_BEP20_ABI = [
  ERC20_TRANSFER_EVENT,
  parseAbiItem("function decimals() view returns (uint8)"),
  parseAbiItem("function balanceOf(address account) view returns (uint256)"),
] as const;

export function getUsdtTokenAddress() {
  return getUsdtContractAddress();
}
