import type { Metadata } from "next";
import { AdminAirdropsPage } from "@/components/admin/AdminAirdropsPage";
export const metadata: Metadata = { title: "Airdrops — Admin" };
export default function AirdropsPage() { return <AdminAirdropsPage />; }
