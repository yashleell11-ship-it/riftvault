"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CURRENCY_CODES,
  CURRENCIES,
  formatPrice,
  getDefaultCurrency,
  type CurrencyCode,
} from "@/lib/currency";

type PoolNft = {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  collection: { name: string };
};

type ReserveModalProps = {
  nft: PoolNft | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  remaining: number;
};

export function ReserveModal({
  nft,
  open,
  onClose,
  onConfirm,
  loading,
  remaining,
}: ReserveModalProps) {
  if (!nft) return null;

  return (
    <Modal open={open} onClose={onClose} title="Confirm reservation">
      <div className="flex gap-4 mb-5">
        <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0">
          <Image src={nft.imageUrl} alt={nft.name} fill className="object-cover" sizes="80px" />
        </div>
        <div>
          <p className="text-xs text-text-muted">{nft.collection.name}</p>
          <p className="font-medium">{nft.name}</p>
          <p className="text-xs text-text-secondary capitalize mt-1">{nft.rarity}</p>
        </div>
      </div>

      <p className="text-sm text-text-secondary mb-6">
        This uses 1 daily slot. You have {remaining} remaining after this reserve.
        List it for sale from your dashboard anytime.
      </p>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onConfirm} disabled={loading}>
          {loading ? "Reserving..." : "Confirm reserve"}
        </Button>
      </div>
    </Modal>
  );
}

type ListModalProps = {
  nft: { id: string; name: string; imageUrl: string; collection: { name: string } } | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (price: number, currency: CurrencyCode) => void;
  loading: boolean;
  floorHint?: number;
  floorCurrency?: string;
};

export function ListForSaleModal({
  nft,
  open,
  onClose,
  onConfirm,
  loading,
  floorHint,
  floorCurrency,
}: ListModalProps) {
  const [price, setPrice] = useState("0.1");
  const [currency, setCurrency] = useState<CurrencyCode>(getDefaultCurrency());

  if (!nft) return null;

  return (
    <Modal open={open} onClose={onClose} title="List for sale">
      <div className="flex gap-4 mb-5">
        <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0">
          <Image src={nft.imageUrl} alt={nft.name} fill className="object-cover" sizes="64px" />
        </div>
        <div>
          <p className="text-xs text-text-muted">{nft.collection.name}</p>
          <p className="font-medium text-sm">{nft.name}</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-text-secondary mb-2">
        Currency
      </label>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className="h-11 w-full rounded-xl border border-border bg-bg-elevated px-4 text-sm outline-none focus:border-accent/50 mb-4"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {CURRENCIES[code].symbol} — {CURRENCIES[code].name}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium text-text-secondary mb-2">
        Price ({currency})
      </label>
      <input
        type="number"
        step="0.01"
        min="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-bg-elevated px-4 text-sm outline-none focus:border-accent/50 mb-2"
      />
      {floorHint != null && (
        <p className="text-xs text-text-muted mb-5">
          Collection floor: {formatPrice(floorHint, floorCurrency)}
        </p>
      )}

      <div className="flex gap-3 mt-4">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={loading || !price || parseFloat(price) <= 0}
          onClick={() => onConfirm(parseFloat(price), currency)}
        >
          {loading ? "Listing..." : "List artifact"}
        </Button>
      </div>
    </Modal>
  );
}
