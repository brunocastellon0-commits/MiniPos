import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { SuppliersView } from "@/components/purchases/suppliers-view";
import { listSuppliersAction } from "@/lib/actions/suppliers";
import { requireRole } from "@/lib/auth";
import type { Supplier } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Proveedores",
  description: "Alta, edición y baja de proveedores para las compras.",
};

export default async function ProveedoresPage() {
  await requireRole("owner", "/caja");

  let suppliers: Supplier[] = [];
  let initialError: string | null = null;

  try {
    const result = await listSuppliersAction();
    if (result.ok) {
      suppliers = result.data;
    } else {
      initialError = result.message;
    }
  } catch {
    initialError = "No se pudieron cargar los proveedores.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
          Proveedores
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Quiénes te abastecen. Un proveedor con compras no se puede eliminar, solo desactivar.
        </p>
      </div>

      <SuppliersView initialSuppliers={suppliers} initialError={initialError} />
    </div>
  );
}
