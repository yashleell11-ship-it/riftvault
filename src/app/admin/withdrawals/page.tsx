import type { Metadata } from "next";
import { AdminWithdrawalsPage } from "@/components/admin/AdminWithdrawalsPage";
export const metadata: Metadata = { title: "Withdrawals — Admin" };
export default function WithdrawalsPage() { return <AdminWithdrawalsPage />; }
