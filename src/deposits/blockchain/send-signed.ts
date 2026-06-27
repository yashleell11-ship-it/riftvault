import {
  encodeFunctionData,
  type Account,
  type Chain,
  type Hash,
  type Hex,
} from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getBscChainId } from "@/payments/blockchain/config";
import { ERC20_TRANSFER_ABI } from "@/deposits/blockchain/erc20";

type LocalSigningAccount = Account & {
  type: "local";
  signTransaction: (
    transaction: Record<string, unknown>,
    options?: { serializer?: unknown }
  ) => Promise<Hex>;
};

function getBscChain(): Chain {
  return getBscChainId() === bsc.id ? bsc : bscTestnet;
}

function assertLocalSigningAccount(account: Account): LocalSigningAccount {
  if (account.type !== "local") {
    throw new Error(
      `Account ${account.address} is not a local signing account (got type=${account.type ?? "unknown"})`
    );
  }
  if (typeof (account as LocalSigningAccount).signTransaction !== "function") {
    throw new Error(`Account ${account.address} cannot signTransaction locally`);
  }
  return account as LocalSigningAccount;
}

/**
 * Sign with the LocalAccount private key and broadcast via eth_sendRawTransaction only.
 * Never calls eth_sendTransaction on the RPC.
 *
 * When `gasPrice` is supplied the transaction is forced to LEGACY pricing so the
 * on-chain cost is provably `gasUsed * gasPrice` (never an inflated EIP-1559
 * maxFeePerGas). The sweeper relies on this to guarantee a funded wallet can
 * always afford the tx it was funded for. `nonce` may be pinned for replacement.
 */
export async function sendSignedTransaction(
  account: Account,
  params: {
    to: `0x${string}`;
    value?: bigint;
    data?: Hex;
    gas?: bigint;
    gasPrice?: bigint;
    nonce?: number;
  }
): Promise<Hash> {
  const signer = assertLocalSigningAccount(account);
  const publicClient = getBscPublicClient();
  const chain = getBscChain();

  const prepared = await publicClient.prepareTransactionRequest({
    account: signer,
    chain,
    to: params.to,
    value: params.value ?? 0n,
    data: params.data,
    gas: params.gas,
    ...(params.gasPrice !== undefined
      ? { type: "legacy" as const, gasPrice: params.gasPrice }
      : {}),
    ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
  });

  const serializer = chain.serializers?.transaction;
  const serializedTransaction = await signer.signTransaction(prepared, { serializer });

  return publicClient.sendRawTransaction({ serializedTransaction });
}

/** ERC20 transfer signed locally and broadcast as a raw transaction. */
export async function sendSignedErc20Transfer(
  account: Account,
  token: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
  options?: { gas?: bigint; gasPrice?: bigint; nonce?: number }
): Promise<Hash> {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });

  return sendSignedTransaction(account, {
    to: token,
    data,
    gas: options?.gas,
    gasPrice: options?.gasPrice,
    nonce: options?.nonce,
  });
}
