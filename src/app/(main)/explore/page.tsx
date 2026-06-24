import type { Metadata } from "next";
import { ExploreMarketplace } from "@/components/explore/ExploreMarketplace";

export const metadata: Metadata = {
  title: "Explore",
};

export default function ExplorePage() {
  return <ExploreMarketplace />;
}
