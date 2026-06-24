import type { Metadata } from "next";
import { DeveloperPage } from "@/components/dashboard/DeveloperPage";
export const metadata: Metadata = { title: "Developer" };
export default function DevPage() { return <DeveloperPage />; }
