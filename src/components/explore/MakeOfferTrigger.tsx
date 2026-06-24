"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MakeOfferModal } from "./MakeOfferModal";

export function MakeOfferTrigger({ nftId, nftName }: { nftId: string; nftName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" />Make an offer
      </Button>
      <MakeOfferModal nftId={nftId} nftName={nftName} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
