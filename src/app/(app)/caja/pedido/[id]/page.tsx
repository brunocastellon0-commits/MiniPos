import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { OrderDetail } from "@/components/orders/order-detail";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrderAction } from "@/lib/actions/orders";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Detalle de pedido",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("/login");
  const { id } = await params;

  const result = await getOrderAction({ orderId: id });

  if (!result.ok) {
    return (
      <div className="space-y-4">
        {result.code === "NOT_FOUND" ? (
          <EmptyState
            icon={<ClipboardList className="size-10" aria-hidden="true" />}
            title="Pedido no encontrado"
            description="Puede que el pedido no exista o no tengas permiso para verlo."
          />
        ) : (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            {result.message}
          </div>
        )}
        <Link href="/caja" className={buttonClasses({ variant: "secondary" })}>
          Volver a pedidos
        </Link>
      </div>
    );
  }

  return (
    <OrderDetail
      order={result.data.order}
      items={result.data.items}
      createdByName={result.data.createdByName}
    />
  );
}
