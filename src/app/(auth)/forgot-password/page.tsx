"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Request failed");
    } else {
      setMessage(data.message);
    }
    setLoading(false);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold mb-2">Reset password</h1>
      <p className="text-sm text-text-secondary mb-8">
        Enter your email and we&apos;ll send a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          error={error}
        />
        {message && <p className="text-sm text-accent">{message}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-accent hover:text-accent-dim font-medium">
          Back to login
        </Link>
      </p>
    </>
  );
}
