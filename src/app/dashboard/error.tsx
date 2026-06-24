"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <h2 className="font-display text-2xl font-bold mb-2">Dashboard error</h2>
      <p className="text-text-muted text-sm mb-6">Something went wrong loading this page.</p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="secondary">Try again</Button>
        <Button href="/dashboard" variant="ghost">Dashboard home</Button>
      </div>
    </div>
  );
}
