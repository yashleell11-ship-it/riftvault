import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UsdtCheckoutClient } from "@/components/payments/UsdtCheckoutClient";
import {
  getPaymentOrderStatus,
  toStatusPayload,
} from "@/payments/services/payment-order.service";

export const metadata: Metadata = {
  title: "USDT Checkout — RiftVault",
};

export default async function UsdtCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const order = await getPaymentOrderStatus(id, user.id);
  if (!order) redirect("/explore");

  return (
    <div className="min-h-[calc(100vh-4rem)] py-10 px-4">
      <UsdtCheckoutClient paymentId={id} initial={toStatusPayload(order)} />
    </div>
  );
}
