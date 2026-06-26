import type { Metadata } from "next";
import { AdminDepositsPage } from "@/components/admin/AdminDepositsPage";

export const metadata: Metadata = { title: "Deposits — Admin" };

export default function DepositsPage() {
  return <AdminDepositsPage />;
}
