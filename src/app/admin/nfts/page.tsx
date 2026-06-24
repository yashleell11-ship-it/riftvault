import type { Metadata } from "next";
import { AdminNftsPage } from "@/components/admin/AdminNftsPage";
export const metadata: Metadata = { title: "Upload NFTs — Admin" };
export default function NftsPage() { return <AdminNftsPage />; }
