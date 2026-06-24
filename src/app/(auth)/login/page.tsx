"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [requires2fa, setRequires2fa] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [totpCode, setTotpCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      setLoading(false);
      return;
    }

    if (data.requires2fa) {
      setRequires2fa(true);
      setChallengeToken(data.challengeToken);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handle2fa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/2fa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, code: totpCode }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Invalid code");
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  if (requires2fa) {
    return (
      <>
        <h1 className="font-display text-2xl font-bold mb-2">Authenticator code</h1>
        <p className="text-sm text-text-secondary mb-8">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={handle2fa} className="space-y-5">
          <Input
            label="Code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="123456"
            required
            autoComplete="one-time-code"
            error={error}
          />
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Verifying…" : "Continue"}
          </Button>
          <button
            type="button"
            className="text-sm text-text-muted hover:text-text-primary w-full"
            onClick={() => {
              setRequires2fa(false);
              setTotpCode("");
              setChallengeToken("");
            }}
          >
            ← Back to login
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold mb-2">Welcome back</h1>
      <p className="text-sm text-text-secondary mb-8">
        Log in to your account to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          error={error}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-accent hover:text-accent-dim transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:text-accent-dim font-medium">
          Sign up
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-text-muted">
        Demo: demo@riftvault.io / password123
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
