import type { Metadata } from "next";
import { ReserveMarketplace } from "@/components/reserve/ReserveMarketplace";

export const metadata: Metadata = {
  title: "Reserve",
};

export default function ReservePage() {
  return <ReserveMarketplace />;
}
