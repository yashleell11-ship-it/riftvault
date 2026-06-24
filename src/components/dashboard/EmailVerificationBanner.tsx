"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function resend() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setIsError(!res.ok);
    setMessage(data.message ?? data.error ?? (res.ok ? "Email sent." : "Send failed"));
  }

  return (
    <Card className="mb-8 border-gold/30 bg-gold/5">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div>
            <h2 className="font-medium mb-1">Verify your email</h2>
            <p className="text-sm text-text-secondary max-w-lg">
              We sent a verification link to <strong className="text-text-primary">{email}</strong>.
              Open it in your inbox (check spam too) to unlock airdrops and full account features.
            </p>
            {message && (
              <p className={`text-sm mt-2 ${isError ? "text-danger" : "text-accent"}`}>{message}</p>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={resend} disabled={loading}>
          {loading ? "Sending…" : "Resend email"}
        </Button>
      </div>
    </Card>
  );
}
