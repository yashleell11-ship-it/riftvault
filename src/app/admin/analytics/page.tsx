import type { Metadata } from "next";
import { AdminAnalyticsPage } from "@/components/admin/AdminAnalyticsPage";
export const metadata: Metadata = { title: "Analytics — Admin" };
export default function AnalyticsPage() { return <AdminAnalyticsPage />; }
