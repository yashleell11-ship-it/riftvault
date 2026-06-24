import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Header } from "@/components/layout/Header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0 p-6">{children}</main>
      </div>
    </>
  );
}
