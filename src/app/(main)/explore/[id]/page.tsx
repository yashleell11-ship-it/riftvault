import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { NftCard } from "@/components/explore/NftCard";
import { NftActions } from "@/components/explore/NftActions";
import { AuctionSection } from "@/components/explore/AuctionSection";
import { MakeOfferTrigger } from "@/components/explore/MakeOfferTrigger";
import { formatPrice, getDefaultCurrency } from "@/lib/currency";
import { rarityColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import type { Metadata } from "next";

type Params = { params: Promise<{ id: string }> };

async function getNft(id: string) {
  return prisma.nft.findUnique({
    where: { id },
    include: {
      collection: true,
      listing: true,
      owner: { select: { id: true, displayName: true } },
    },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const nft = await getNft(id);
  if (!nft) return { title: "Not Found" };
  return { title: nft.name };
}

export default async function NftDetailPage({ params }: Params) {
  const { id } = await params;
  const [nft, user] = await Promise.all([getNft(id), getSessionUser()]);

  if (!nft) notFound();

  const isOwner = user?.id === nft.ownerId;

  const related = await prisma.nft.findMany({
    where: { collectionId: nft.collectionId, id: { not: nft.id } },
    include: {
      collection: { select: { name: true, slug: true } },
      listing: { select: { id: true, price: true, currency: true, status: true } },
    },
    take: 4,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to explore
      </Link>

      <div className="grid lg:grid-cols-2 gap-10">
        <Card className="p-0 overflow-hidden">
          <div className="relative aspect-square">
            <Image
              src={nft.imageUrl}
              alt={nft.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="accent" className="capitalize">{nft.rarity}</Badge>
            <Badge variant="default" className="capitalize">{nft.status}</Badge>
          </div>

          <p className="text-sm text-text-muted mb-1">{nft.collection.name}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">{nft.name}</h1>

          {nft.description && (
            <p className="text-text-secondary leading-relaxed mb-8">{nft.description}</p>
          )}

          {/* Fixed-price listing card */}
          {nft.status === "listed" && nft.listing && (
            <Card className="mb-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Current price</p>
                  <p className="font-display text-3xl font-bold text-accent">
                    {formatPrice(nft.listing.price, nft.listing.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Token ID</p>
                  <p className="font-mono text-sm">#{nft.tokenId}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Auction section (client component — fetches /api/auctions?nftId=) */}
          {nft.status === "auction" && (
            <div className="mb-6">
              <AuctionSection nftId={nft.id} loggedIn={!!user} />
            </div>
          )}

          {/* Buy / reserve / cancel actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <NftActions
              nftId={nft.id}
              status={nft.status}
              price={nft.listing?.status === "active" ? nft.listing.price : null}
              currency={nft.listing?.status === "active" ? nft.listing.currency : null}
              isOwner={isOwner}
              listingId={nft.listing?.status === "active" ? nft.listing.id : null}
              chainListingId={nft.chainListingId}
              loggedIn={!!user}
            />
          </div>

          {/* Make offer button — shown when NFT is listed or in auction and viewer is not the owner */}
          {!isOwner && (nft.status === "listed" || nft.status === "auction") && user && (
            <div className="mb-8">
              <MakeOfferTrigger nftId={nft.id} nftName={nft.name} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-border bg-bg-elevated p-4">
              <p className="text-text-muted mb-1">Collection</p>
              <p className="font-medium">{nft.collection.name}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated p-4">
              <p className="text-text-muted mb-1">Owner</p>
              <p className="font-medium">{nft.owner?.displayName ?? "Unclaimed"}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated p-4">
              <p className="text-text-muted mb-1">Rarity</p>
              <p className={cn("font-medium capitalize", rarityColor(nft.rarity))}>{nft.rarity}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated p-4">
              <p className="text-text-muted mb-1">Floor</p>
              <p className="font-medium">{formatPrice(nft.collection.floorPrice, getDefaultCurrency())}</p>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-xl font-bold mb-6">More from this collection</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((item) => (
              <NftCard key={item.id} nft={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
