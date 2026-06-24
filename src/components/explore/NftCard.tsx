import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";
import { rarityColor, type NftItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NftCard({ nft }: { nft: NftItem }) {
  return (
    <Link href={`/explore/${nft.id}`}>
      <Card shine className="p-0 overflow-hidden group hover:border-accent/40 transition-colors h-full">
        <div className="relative aspect-square overflow-hidden bg-bg-elevated">
          <Image
            src={nft.imageUrl}
            alt={nft.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          <div className="absolute top-3 left-3">
            <Badge variant="default" className="capitalize backdrop-blur-sm">
              {nft.rarity}
            </Badge>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs text-text-muted mb-1">{nft.collection.name}</p>
          <h3 className="font-display font-semibold truncate mb-2">{nft.name}</h3>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs capitalize", rarityColor(nft.rarity))}>
              {nft.status}
            </span>
            {nft.listing ? (
              <span className="text-sm font-medium text-accent">
                {formatPrice(nft.listing.price, nft.listing.currency)}
              </span>
            ) : (
              <span className="text-xs text-text-muted">Not listed</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function NftCardSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="aspect-square bg-bg-hover animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-20 bg-bg-hover rounded animate-pulse" />
        <div className="h-4 w-full bg-bg-hover rounded animate-pulse" />
        <div className="h-3 w-16 bg-bg-hover rounded animate-pulse" />
      </div>
    </Card>
  );
}
