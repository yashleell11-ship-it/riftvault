"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { NftCard, NftCardSkeleton } from "@/components/explore/NftCard";
import { Button } from "@/components/ui/Button";
import type { NftItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Collection = { name: string; slug: string };

export function ExploreMarketplace() {
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("");
  const [status, setStatus] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNfts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (collection) params.set("collection", collection);
    if (status) params.set("status", status);
    if (rarity) params.set("rarity", rarity);
    params.set("sort", sort);
    params.set("page", String(page));

    const res = await fetch(`/api/nfts?${params}`);
    const data = await res.json();
    setNfts(data.nfts ?? []);
    setCollections(data.collections ?? []);
    setTotalPages(data.pagination?.pages ?? 1);
    setLoading(false);
  }, [search, collection, status, rarity, sort, page]);

  useEffect(() => {
    const timer = setTimeout(fetchNfts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchNfts, search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Explore</h1>
        <p className="text-text-secondary">
          Discover artifacts across collections. Filter by rarity, status, and price.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="search"
            placeholder="Search artifacts..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="h-11 w-full rounded-xl border border-border bg-bg-elevated pl-11 pr-4 text-sm outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
            className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary outline-none focus:border-accent/50"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low</option>
            <option value="price_desc">Price: High</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <aside
          className={cn(
            "w-56 shrink-0 space-y-6",
            showFilters ? "block" : "hidden lg:block"
          )}
        >
          <FilterSelect
            label="Collection"
            value={collection}
            onChange={(v) => {
              setPage(1);
              setCollection(v);
            }}
            options={[
              { value: "", label: "All collections" },
              ...collections.map((c) => ({ value: c.slug, label: c.name })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            options={[
              { value: "", label: "All statuses" },
              { value: "listed", label: "Listed" },
              { value: "reserved", label: "Reserved" },
              { value: "available", label: "Available" },
            ]}
          />
          <FilterSelect
            label="Rarity"
            value={rarity}
            onChange={(v) => {
              setPage(1);
              setRarity(v);
            }}
            options={[
              { value: "", label: "All rarities" },
              { value: "common", label: "Common" },
              { value: "uncommon", label: "Uncommon" },
              { value: "rare", label: "Rare" },
              { value: "epic", label: "Epic" },
              { value: "legendary", label: "Legendary" },
            ]}
          />
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : nfts.length === 0 ? (
            <div className="text-center py-20 text-text-secondary">
              No matching artifacts found.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {nfts.map((nft) => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-text-muted">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
        {label}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-lg border border-border bg-bg-elevated px-3 text-sm outline-none focus:border-accent/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
