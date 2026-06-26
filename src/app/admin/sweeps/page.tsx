import type { Metadata } from "next";
import { AdminSweepsPage } from "@/components/admin/AdminSweepsPage";

export const metadata: Metadata = { title: "Treasury sweeper — Admin" };

export default function SweepsPage() {
  return <AdminSweepsPage />;
}
