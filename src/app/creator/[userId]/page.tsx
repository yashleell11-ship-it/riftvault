import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  return { title: user ? `${user.displayName} — Creator` : "Creator" };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, displayName: true, isCreator: true, createdAt: true,
      createdCollections: {
        select: {
          id: true, name: true, slug: true, imageUrl: true, floorPrice: true, royaltyBps: true,
          _count: { select: { nfts: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!creator || !creator.isCreator) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-4 mb-10">
        <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-accent">{creator.displayName[0]}</span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{creator.displayName}</h1>
          <p className="text-text-muted text-sm">Creator · {creator.createdCollections.length} collection{creator.createdCollections.length !== 1 ? "s" : ""}</p>
          <Badge variant="accent" className="mt-2">Verified Creator</Badge>
        </div>
      </div>

      <h2 className="font-display text-xl font-semibold mb-4">Collections</h2>
      {creator.createdCollections.length === 0 ? (
        <Card><p className="text-text-muted text-sm text-center py-8">No collections yet.</p></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {creator.createdCollections.map(col => (
            <Card key={col.id} className="group">
              {col.imageUrl && (
                <div className="relative h-40 rounded-xl overflow-hidden mb-4">
                  <Image src={col.imageUrl} alt={col.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="320px" />
                </div>
              )}
              <h3 className="font-display font-semibold truncate">{col.name}</h3>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-text-muted">{col._count.nfts} items</span>
                <span className="text-accent">{formatPrice(col.floorPrice)} floor</span>
              </div>
              {col.royaltyBps > 0 && <p className="text-xs text-text-muted mt-1">{(col.royaltyBps / 100).toFixed(1)}% royalty</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
