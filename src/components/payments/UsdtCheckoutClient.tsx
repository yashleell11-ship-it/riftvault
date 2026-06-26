"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PaymentStatusPayload } from "@/payments/services/payment-order.service";

type Props = {
  paymentId: string;
  initial?: PaymentStatusPayload | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  detecting: "Payment detected",
  confirming: "Confirming on-chain",
  paid: "Paid",
  expired: "Expired",
  failed: "Failed",
};

function statusStep(status: string): number {
  if (status === "pending") return 0;
  if (status === "detecting") return 1;
  if (status === "confirming") return 2;
  if (status === "paid") return 3;
  return -1;
}

export function UsdtCheckoutClient({ paymentId, initial }: Props) {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentStatusPayload | null>(initial ?? null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = payment ? statusStep(payment.status) : 0;

  const explorerTxUrl =
    payment?.txHash && payment.chainId === 97
      ? `https://testnet.bscscan.com/tx/${payment.txHash}`
      : payment?.txHash
        ? `https://bscscan.com/tx/${payment.txHash}`
        : null;

  useEffect(() => {
    if (!payment?.receivingWallet) return;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(payment.receivingWallet, {
        margin: 2,
        width: 220,
        color: { dark: "#00e5c3", light: "#0a0e1a" },
      }).then(setQrDataUrl);
    });
  }, [payment?.receivingWallet]);

  useEffect(() => {
    if (!paymentId) return;

    const es = new EventSource(`/api/payments/${paymentId}/stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PaymentStatusPayload & { error?: string };
        if (data.error) {
          setError("Connection issue — retrying…");
          return;
        }
        setPayment(data);
        setError(null);
        if (data.status === "paid") {
          es.close();
          setTimeout(() => router.push("/dashboard/nfts"), 2000);
        }
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      setError("Live updates paused — polling…");
      es.close();
    };

    return () => es.close();
  }, [paymentId, router]);

  useEffect(() => {
    if (!error || !paymentId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/payments/${paymentId}/status`);
      if (res.ok) {
        const data = await res.json();
        setPayment(data);
        if (data.status === "paid") router.push("/dashboard/nfts");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [error, paymentId, router]);

  async function copy(text: string, field: "address" | "amount") {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!payment) {
    return (
      <Card className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Badge variant="gold" className="mb-2">
          USDT · BEP20 · BNB Smart Chain
        </Badge>
        <h1 className="font-display text-2xl font-bold">Pay with USDT</h1>
        <p className="text-sm text-text-muted mt-1">{payment.productName}</p>
      </div>

      <Card shine>
        <div className="flex items-center justify-between mb-6">
          {["Pending", "Detected", "Confirmations", "Paid"].map((label, i) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                  step >= i
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-border text-text-muted"
                }`}
              >
                {step > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-[10px] text-text-muted mt-1 text-center">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center font-display text-lg font-semibold text-gold mb-1">
          {STATUS_LABELS[payment.status] ?? payment.status}
        </p>
        {payment.status === "confirming" && (
          <p className="text-center text-xs text-text-muted mb-4">
            {payment.confirmations} / {payment.requiredConfirmations} confirmations
          </p>
        )}

        {payment.status === "pending" && (
          <>
            <div className="flex justify-center mb-4">
              {qrDataUrl ? (
                <Image src={qrDataUrl} alt="Deposit QR" width={220} height={220} unoptimized />
              ) : (
                <div className="h-[220px] w-[220px] bg-bg-hover animate-pulse rounded-xl" />
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted mb-1">Send exactly</p>
                <div className="flex items-center gap-2">
                  <p className="font-display text-2xl font-bold text-accent flex-1">
                    {payment.expectedAmount} USDT
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(payment.expectedAmount, "amount")}
                  >
                    <Copy className="h-4 w-4" />
                    {copied === "amount" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  List price {payment.listPrice} USDT — unique suffix identifies your order.
                </p>
              </div>

              <div>
                <p className="text-xs text-text-muted mb-1">To wallet address</p>
                <div className="flex items-start gap-2 rounded-xl border border-border bg-bg-elevated p-3">
                  <Wallet className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <p className="text-xs font-mono break-all flex-1">{payment.receivingWallet}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(payment.receivingWallet, "address")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied === "address" && (
                  <p className="text-xs text-accent mt-1">Address copied</p>
                )}
              </div>
            </div>
          </>
        )}

        {explorerTxUrl && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-text-muted">Transaction</p>
            <a
              href={explorerTxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-accent break-all hover:underline"
            >
              {payment.txHash}
            </a>
          </div>
        )}

        {payment.status === "paid" && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-3" />
            <p className="font-medium">Payment complete — redirecting to your NFTs…</p>
          </div>
        )}

        {error && <p className="text-xs text-gold mt-3 text-center">{error}</p>}
      </Card>

      <p className="text-xs text-text-muted text-center">
        Expires {new Date(payment.expiresAt).toLocaleString()}. Only send USDT on BNB Smart Chain
        (BEP20).
      </p>

      <div className="flex justify-center">
        <Link href="/explore" className="text-sm text-text-muted hover:text-accent">
          ← Back to explore
        </Link>
      </div>
    </div>
  );
}
