"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Reset failed");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  if (!token) {
    return (
      <>
        <h1 className="font-display text-2xl font-bold mb-2">Invalid link</h1>
        <p className="text-text-secondary mb-6">This reset link is missing a token.</p>
        <Link href="/forgot-password" className="text-accent text-sm">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold mb-2">New password</h1>
      <p className="text-sm text-text-secondary mb-8">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="New password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          error={error}
        />
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
