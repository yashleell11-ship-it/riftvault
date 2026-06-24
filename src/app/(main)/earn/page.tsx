import type { Metadata } from "next";
import { EarnDashboard } from "@/components/earn/EarnDashboard";

export const metadata: Metadata = {
  title: "Earn",
};

export default function EarnPage() {
  return <EarnDashboard />;
}
