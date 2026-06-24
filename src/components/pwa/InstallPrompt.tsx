"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-border bg-bg-elevated p-4 shadow-xl sm:left-auto sm:right-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
          <Download className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Install RiftVault</p>
          <p className="text-xs text-text-secondary mt-1">
            Add to your home screen for faster access and offline browsing.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={install}>
              Install app
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-primary"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
