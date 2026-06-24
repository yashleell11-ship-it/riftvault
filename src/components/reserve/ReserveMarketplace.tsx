"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReserveModal } from "@/components/marketplace/MarketplaceModals";
import { levelLabel } from "@/lib/levels";

type PoolNft = {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  collection: { name: string; slug: string };
};

type ReserveStatus = {
  level: number;
  maxSlots: number;
  usedToday: number;
  remaining: number;
  timezone: string;
  resetsAt: string;
};

export function ReserveMarketplace() {
  const router = useRouter();
  const [pool, setPool] = useState<PoolNft[]>([]);
  const [status, setStatus] = useState<ReserveStatus | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PoolNft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [poolRes, statusRes, meRes] = await Promise.all([
      fetch("/api/reserve/pool"),
      fetch("/api/reserve/status"),
      fetch("/api/auth/me"),
    ]);

    const poolData = await poolRes.json();
    setPool(poolData.nfts ?? []);
    setLoggedIn(meRes.ok);

    if (statusRes.ok) {
      setStatus(await statusRes.json());
    } else {
      setStatus(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openReserve(nft: PoolNft) {
    if (!loggedIn) {
      router.push("/login?redirect=/reserve");
      return;
    }
    if (status && status.remaining <= 0) {
      setError("No reservation slots left today. Come back after reset.");
      return;
    }
    setError("");
    setSelected(nft);
    setModalOpen(true);
  }

  async function confirmReserve() {
    if (!selected) return;
    setReserving(true);
    setError("");

    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId: selected.id }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Reservation failed");
      setReserving(false);
      return;
    }

    setModalOpen(false);
    setSelected(null);
    setReserving(false);
    router.push("/dashboard/nfts");
    router.refresh();
  }

  const resetLabel = status
    ? new Date(status.resetsAt).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Reserve</h1>
        <p className="text-text-secondary">
          Lock in artifacts from the daily pool. Higher levels unlock more slots.
        </p>
      </div>

      {loggedIn && status ? (
        <Card className="mb-8 border-accent/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <Lock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-display font-semibold">
                  {status.remaining} / {status.maxSlots} slots today
                </p>
                <p className="text-sm text-text-secondary">
                  {levelLabel(status.level)} · resets {resetLabel} ({status.timezone})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4" />
              Used {status.usedToday} today
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-8 text-center py-6">
          <p className="text-text-secondary mb-4">Log in to reserve artifacts and track your daily slots.</p>
          <Button href="/login?redirect=/reserve" size="sm">
            Log in to reserve
          </Button>
        </Card>
      )}

      {error && (
        <p className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden animate-pulse">
              <div className="aspect-square bg-bg-hover" />
            </Card>
          ))}
        </div>
      ) : pool.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-text-secondary mb-4">No artifacts in the reserve pool right now.</p>
          <Button href="/explore" variant="secondary">
            Browse listed NFTs
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pool.map((nft) => (
            <Card key={nft.id} className="p-0 overflow-hidden group hover:border-accent/30 transition-colors">
              <Link href={`/explore/${nft.id}`}>
                <div className="relative aspect-square">
                  <Image
                    src={nft.imageUrl}
                    alt={nft.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="25vw"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="accent" className="capitalize">
                      {nft.rarity}
                    </Badge>
                  </div>
                </div>
              </Link>
              <div className="p-4">
                <p className="text-xs text-text-muted truncate">{nft.collection.name}</p>
                <h3 className="font-medium truncate mb-3">{nft.name}</h3>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => openReserve(nft)}
                  disabled={loggedIn && status !== null && status.remaining <= 0}
                >
                  Reserve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ReserveModal
        nft={selected}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        onConfirm={confirmReserve}
        loading={reserving}
        remaining={status?.remaining ?? 0}
      />
    </div>
  );
}
