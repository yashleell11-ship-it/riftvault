import type { Metadata } from "next";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";
export const metadata: Metadata = { title: "Users — Admin" };
export default function UsersPage() { return <AdminUsersPage />; }
