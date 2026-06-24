import type { Metadata } from "next";
import { AirdropDashboard } from "@/components/airdrop/AirdropDashboard";

export const metadata: Metadata = {
  title: "Airdrop",
};

export default function AirdropPage() {
  return <AirdropDashboard />;
}
