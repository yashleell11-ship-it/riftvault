import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <WifiOff className="h-12 w-12 text-text-muted mb-4" />
      <h1 className="font-display text-2xl font-bold mb-2">You&apos;re offline</h1>
      <p className="text-text-secondary text-sm max-w-sm mb-6">
        RiftVault needs a connection for trading. Cached pages may still be available when you reconnect.
      </p>
      <Button href="/">Back home</Button>
      <Link href="/explore" className="text-sm text-accent mt-4 hover:text-accent-dim">
        Browse cached explore →
      </Link>
    </div>
  );
}
