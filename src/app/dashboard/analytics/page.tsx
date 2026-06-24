import type { Metadata } from "next";
import { UserAnalyticsPage } from "@/components/dashboard/UserAnalyticsPage";
export const metadata: Metadata = { title: "My Analytics" };
export default function AnalyticsPage() { return <UserAnalyticsPage />; }
