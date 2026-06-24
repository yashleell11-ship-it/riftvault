"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, ThumbsDown, ThumbsUp, Vote } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Proposal = {
  id: string;
  title: string;
  description: string;
  status: string;
  endsAt: string;
  creator: { displayName: string };
  tally: { for: number; against: number };
  myVote: string | null;
};

type GovStatus = {
  voteWeight: number;
  rvltBalance: number;
  canPropose: boolean;
  canVote: boolean;
};

function statusVariant(status: string): "accent" | "gold" | "danger" | "default" {
  if (status === "passed") return "accent";
  if (status === "active") return "gold";
  if (status === "rejected") return "danger";
  return "default";
}

export default function GovernancePage() {
  const [items, setItems] = useState<Proposal[]>([]);
  const [status, setStatus] = useState<GovStatus | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [propRes, statusRes, meRes] = await Promise.all([
      fetch("/api/governance/proposals"),
      fetch("/api/governance/status").catch(() => null),
      fetch("/api/auth/me"),
    ]);

    if (propRes.ok) {
      const data = await propRes.json();
      setItems(data.items ?? []);
    }

    setLoggedIn(meRes.ok);
    if (statusRes?.ok) setStatus(await statusRes.json());
    else setStatus(null);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/governance/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, daysOpen: 7 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setTitle("");
    setDescription("");
    setMessage("Proposal created.");
    load();
  }

  async function vote(proposalId: string, choice: "for" | "against") {
    const res = await fetch(`/api/governance/proposals/${proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Vote failed");
      return;
    }
    setMessage(`Vote recorded (${choice}).`);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Badge variant="gold" className="mb-3">
        RVLT governance
      </Badge>
      <h1 className="font-display text-3xl font-bold mb-2">Governance</h1>
      <p className="text-text-secondary text-sm mb-8 max-w-xl">
        Vote with staked RVLT weight. Proposals guide platform parameters — no yield promises.
      </p>

      {loggedIn && status && (
        <Card className="mb-8 !p-4">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <Vote className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-medium">Your voting power</p>
                <p className="text-xs text-text-muted">
                  {status.voteWeight} RVLT staked · {status.rvltBalance} RVLT available
                </p>
              </div>
            </div>
            {!status.canVote && (
              <Button href="/earn" variant="secondary" size="sm">
                Stake RVLT on Earn →
              </Button>
            )}
          </div>
        </Card>
      )}

      {!loggedIn && (
        <Card className="mb-8 !p-4">
          <p className="text-sm text-text-secondary">
            <Link href="/login?redirect=/governance" className="text-accent hover:text-accent-dim">
              Log in
            </Link>{" "}
            to vote or create proposals.
          </p>
        </Card>
      )}

      {loggedIn && status?.canPropose && (
        <Card className="mb-8">
          <h2 className="font-medium mb-4">New proposal</h2>
          <form onSubmit={createProposal} className="space-y-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="w-full rounded-xl border border-border bg-bg-base px-4 py-3 text-sm min-h-[100px]"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Button type="submit">Submit proposal</Button>
          </form>
        </Card>
      )}

      {loggedIn && status && !status.canPropose && (
        <Card className="mb-8 !p-4">
          <p className="text-sm text-text-secondary">
            Stake at least 10 RVLT to create proposals.{" "}
            <Link href="/earn" className="text-accent hover:text-accent-dim">
              Go to Earn →
            </Link>
          </p>
        </Card>
      )}

      {message && <p className="text-sm text-accent mb-6">{message}</p>}

      {loading ? (
        <p className="text-text-muted text-sm">Loading proposals…</p>
      ) : items.length === 0 ? (
        <p className="text-text-muted text-sm">No proposals yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="font-medium">{p.title}</h3>
                <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
              </div>
              <p className="text-sm text-text-secondary mb-3">{p.description}</p>
              <p className="text-xs text-text-muted mb-3">
                By {p.creator.displayName} · ends {new Date(p.endsAt).toLocaleDateString()}
                {p.myVote && (
                  <span className="text-accent ml-2">· You voted {p.myVote}</span>
                )}
              </p>
              <div className="flex items-center gap-4 text-sm mb-4">
                <span className="flex items-center gap-1 text-accent">
                  <ThumbsUp className="h-4 w-4" /> {p.tally.for} RVLT
                </span>
                <span className="flex items-center gap-1 text-danger">
                  <ThumbsDown className="h-4 w-4" /> {p.tally.against} RVLT
                </span>
                <Scale className="h-4 w-4 text-text-muted ml-auto" />
              </div>
              {p.status === "active" &&
                new Date(p.endsAt) > new Date() &&
                loggedIn &&
                status?.canVote && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={p.myVote === "for" ? "primary" : "secondary"}
                      onClick={() => vote(p.id, "for")}
                    >
                      Vote for
                    </Button>
                    <Button
                      size="sm"
                      variant={p.myVote === "against" ? "primary" : "secondary"}
                      onClick={() => vote(p.id, "against")}
                    >
                      Vote against
                    </Button>
                  </div>
                )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
