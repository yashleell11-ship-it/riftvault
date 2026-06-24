"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: name,
        email,
        password,
        referralCode: referral || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Signup failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold mb-2">Create account</h1>
      <p className="text-sm text-text-secondary mb-8">
        Join RiftVault and start exploring digital artifacts.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Display name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
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
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          label="Referral code (optional)"
          type="text"
          placeholder="Enter invite code"
          value={referral}
          onChange={(e) => setReferral(e.target.value)}
          autoComplete="off"
          error={error}
        />

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:text-accent-dim font-medium">
          Log in
        </Link>
      </p>
    </>
  );
}
