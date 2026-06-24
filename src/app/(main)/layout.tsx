import { MainLayout } from "@/components/layout/MainLayout";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
