"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WithdrawWalletForm } from "@/components/wallet/WithdrawWalletForm";
import { truncateAddress } from "@/lib/crypto-address";

type Props = {
  initialAddress?: string | null;
  onSaved?: (address: string) => void;
  size?: "sm" | "md";
};

export function WithdrawWalletButton({ initialAddress, onSaved, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initialAddress ?? "");

  useEffect(() => {
    setSaved(initialAddress ?? "");
  }, [initialAddress]);

  function handleSaved(address: string) {
    setSaved(address);
    onSaved?.(address);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size={size}
        onClick={() => setOpen((v) => !v)}
        title={saved || "Set your crypto withdrawal address"}
        className="gap-1.5"
      >
        <Wallet className="h-4 w-4 shrink-0" />
        <span className="max-w-[120px] truncate">
          {saved ? truncateAddress(saved) : "Withdraw wallet"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-bg-surface shadow-xl p-4">
            <h3 className="font-medium text-sm mb-1">Receiving wallet</h3>
            <p className="text-xs text-text-muted mb-4">
              Crypto withdrawals are sent to this address. Each account uses its own
              destination — double-check before saving.
            </p>
            <WithdrawWalletForm initialAddress={saved || null} onSaved={handleSaved} />
          </div>
        </>
      )}
    </div>
  );
}
