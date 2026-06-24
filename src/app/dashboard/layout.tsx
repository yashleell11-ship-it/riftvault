import { Header } from "@/components/layout/Header";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </>
  );
}
