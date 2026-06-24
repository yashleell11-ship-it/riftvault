"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then((r) => setStatus(r.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="text-center">
      <h1 className="font-display text-2xl font-bold mb-2">Email verification</h1>
      {status === "loading" && (
        <p className="text-text-secondary">Verifying your email...</p>
      )}
      {status === "success" && (
        <>
          <p className="text-accent mb-6">Your email has been verified.</p>
          <Button href="/dashboard">Go to dashboard</Button>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-danger mb-6">Invalid or expired verification link.</p>
          <Button href="/login" variant="secondary">
            Back to login
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
