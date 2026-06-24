"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useConnection } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getContractAddresses, RIFT_VAULT_NFT_ABI, RIFT_VAULT_MARKETPLACE_ABI, ethToWei } from "@/lib/contracts";
import type { NftItem } from "@/lib/types";

type Props = { nft: NftItem | null; open: boolean; onClose: () => void; onSuccess: () => void };

export function OnchainListModal({ nft, open, onClose, onSuccess }: Props) {
  const [priceEth, setPriceEth] = useState("");
  const [step, setStep] = useState<"price" | "approve" | "list" | "sync" | "done">("price");
  const [error, setError] = useState("");

  const { address, isConnected } = useConnection();
  const { nft: nftAddr, marketplace } = getContractAddresses();

  const { writeContract: approve, data: approveTx, isPending: approving } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTx });

  const { writeContract: listOnChain, data: listTx, isPending: listing } = useWriteContract();
  const { isSuccess: listConfirmed, data: listReceipt } = useWaitForTransactionReceipt({ hash: listTx });

  if (!open || !nft) return null;

  const currentNft = nft;
  const chainTokenId = currentNft.chainTokenId ? BigInt(currentNft.chainTokenId) : null;

  async function handleApprove() {
    if (!isConnected || !address) { setError("Connect wallet first"); return; }
    if (!nftAddr || !marketplace) { setError("Contracts not configured"); return; }
    if (!chainTokenId) { setError("NFT has no on-chain token ID"); return; }
    setError("");
    setStep("approve");
    approve({ address: nftAddr, abi: RIFT_VAULT_NFT_ABI, functionName: "setApprovalForAll", args: [marketplace, true] });
  }

  async function handleList() {
    if (!nftAddr || !marketplace || !chainTokenId) return;
    const price = parseFloat(priceEth);
    if (!price || price <= 0) { setError("Enter a valid price"); return; }
    setStep("list");
    setError("");
    listOnChain({ address: marketplace, abi: RIFT_VAULT_MARKETPLACE_ABI, functionName: "list", args: [nftAddr, chainTokenId, ethToWei(price)] });
  }

  async function handleSync() {
    if (!listReceipt) return;
    setStep("sync");

    // Extract listing ID from Sold/Listed event logs — fallback to tx hash as ID
    // Real impl: parse logs for the listing ID emitted by the contract.
    // For now, use a sentinel derived from the tx hash.
    const chainListingId = listTx ? `0x${listTx.slice(2, 18)}` : "1";
    const price = parseFloat(priceEth);

    const res = await fetch("/api/listings/onchain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId: currentNft.id, chainListingId, chainTokenId: currentNft.chainTokenId, txHash: listTx, priceEth: price }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Sync failed"); setStep("list"); return; }
    setStep("done");
    onSuccess();
  }

  // Auto-advance steps
  if (approveConfirmed && step === "approve") handleList();
  if (listConfirmed && step === "list") handleSync();

  const busy = approving || listing || step === "sync";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-elevated p-6">
        <h2 className="font-display text-xl font-bold mb-1">List on-chain</h2>
        <p className="text-sm text-text-muted mb-6">{currentNft.name} · Token #{currentNft.chainTokenId ?? "not minted"}</p>

        {!currentNft.chainTokenId && (
          <p className="text-sm text-amber-400 mb-4">This NFT hasn&apos;t been minted on-chain yet. Use the admin mint tool first.</p>
        )}

        {step === "price" && (
          <>
            <Input label="Price (ETH)" type="number" min="0.001" step="0.001" value={priceEth} onChange={e => setPriceEth(e.target.value)} placeholder="0.05" className="mb-4" />
            <p className="text-xs text-text-muted mb-4">You&apos;ll sign two transactions: approve marketplace, then list.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" disabled={!currentNft.chainTokenId || !priceEth || busy} onClick={handleApprove}>
                Approve &amp; list
              </Button>
            </div>
          </>
        )}

        {step === "approve" && (
          <p className="text-sm text-text-secondary">
            {approving ? "Waiting for approval in wallet…" : approveConfirmed ? "Approved ✓ Listing…" : "Approving marketplace…"}
          </p>
        )}

        {(step === "list" || step === "sync") && (
          <p className="text-sm text-text-secondary">
            {listing ? "Waiting for list transaction in wallet…" : listConfirmed ? "Listed on-chain ✓ Saving…" : "Listing…"}
          </p>
        )}

        {step === "done" && (
          <div>
            <p className="text-accent font-medium mb-4">Listed on-chain successfully!</p>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
