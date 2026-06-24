"use client";

import { useEffect, useState } from "react";
import { CHAINS } from "@/lib/chains";

const STORAGE_KEY = "riftvault_chain";

export function ChainSelector() {
  const [selected, setSelected] = useState("sepolia");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CHAINS.find(c => c.key === saved)) setSelected(saved);
  }, []);

  function handleChange(key: string) {
    setSelected(key);
    localStorage.setItem(STORAGE_KEY, key);
    // Update user preference via API (fire-and-forget)
    fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferredChain: key }) }).catch(() => {});
  }

  const chain = CHAINS.find(c => c.key === selected) ?? CHAINS[0];

  return (
    <select
      value={selected}
      onChange={e => handleChange(e.target.value)}
      className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-text-secondary outline-none focus:border-accent/50 cursor-pointer"
      title="Select network"
    >
      {CHAINS.map(c => (
        <option key={c.key} value={c.key}>{c.shortName}</option>
      ))}
    </select>
  );
}

export function usePreferredChain() {
  const [key, setKey] = useState("sepolia");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setKey(saved);
  }, []);
  return CHAINS.find(c => c.key === key) ?? CHAINS[0];
}
