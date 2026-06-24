"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/currency";

type Order = {
  id: string;
  price: number;
  currency: string;
  status: string;
  createdAt: string;
  nft: {
    id: string;
    name: string;
    imageUrl: string;
    collection: { name: string };
  };
  buyer: { displayName: string };
  seller: { displayName: string };
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-display text-2xl font-bold mb-2">My Orders</h1>
      <p className="text-text-secondary text-sm mb-8">
        Purchase and sale history.
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-bg-hover" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-center py-16">
          <ShoppingBag className="h-10 w-10 text-text-muted mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold mb-2">No orders yet</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your trades will appear here once you buy or sell on the marketplace.
          </p>
          <Button href="/explore">Start exploring</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="flex items-center gap-4 p-4">
              <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0">
                <Image src={order.nft.imageUrl} alt={order.nft.name} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{order.nft.name}</p>
                <p className="text-xs text-text-muted">
                  {order.nft.collection.name} · {order.status}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-medium text-accent">{formatPrice(order.price, order.currency)}</p>
                <p className="text-xs text-text-muted">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
