import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const getCachedCollectionOptions = unstable_cache(
  async () =>
    prisma.collection.findMany({
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ["collection-filter-options"],
  { revalidate: 300 }
);
