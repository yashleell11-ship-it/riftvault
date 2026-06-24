import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Web3Providers } from "@/components/web3/Web3Providers";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { NetworkStatus } from "@/components/pwa/NetworkStatus";
import { TenantStyles } from "@/components/tenant/TenantStyles";
import { getTenantBranding } from "@/lib/tenant";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "RiftVault — NFT Marketplace",
    template: "%s | RiftVault",
  },
  description:
    "Discover, reserve, and trade digital artifacts. Dark-themed Web3 NFT marketplace with on-chain rewards.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RiftVault",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icons/icon.svg",
  },
  themeColor: "#00e5c3",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenantBranding();

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} h-full`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-bg-base text-text-primary">
        <TenantStyles tenant={tenant} />
        <Web3Providers>
          {children}
          <InstallPrompt />
          <NetworkStatus />
          <Toaster theme="dark" position="bottom-right" richColors />
        </Web3Providers>
      </body>
    </html>
  );
}
