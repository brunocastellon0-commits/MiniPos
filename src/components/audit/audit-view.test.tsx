import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AuditEntryView } from "@/lib/actions/audit-core";
import { formatDateTime } from "@/lib/dates";
import type { AuditAlert } from "@/lib/domain/audit-alerts";
import { AuditView } from "./audit-view";

const entry: AuditEntryView = {
  id: "a-1",
  at: "2026-11-03T14:00:00.000Z",
  action: "sales.confirm",
  entity: "sales",
  entityId: "sale-1",
  summary: { totalCents: 2500, discountCents: 500, paymentMethod: "cash" },
  reason: null,
  userId: "cashier-1",
  userName: "Carlos Mamani",
};

const alert: AuditAlert = {
  kind: "voids",
  title: "Anulaciones repetidas",
  description: "3 ventas anuladas en las últimas 24 horas. Revisa la bitácora de auditoría.",
  count: 3,
};

describe("AuditView (E11-08)", () => {
  it("muestra los estados vacíos: sin alertas y sin actividad registrada", () => {
    render(<AuditView entries={[]} alerts={[]} />);

    expect(screen.getByText("Sin alertas en las últimas 24 horas.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin actividad registrada" })).toBeInTheDocument();
    expect(
      screen.getByText("Las acciones sensibles del sistema aparecerán aquí."),
    ).toBeInTheDocument();
  });

  it("muestra las alertas de patrones con role=alert", () => {
    render(<AuditView entries={[]} alerts={[alert]} />);

    const alertRegion = screen.getByRole("alert");
    expect(alertRegion).toHaveTextContent("Anulaciones repetidas");
    expect(alertRegion).toHaveTextContent("3 ventas anuladas");
    expect(screen.queryByText("Sin alertas en las últimas 24 horas.")).not.toBeInTheDocument();
  });

  it("lista la bitácora con fecha, actor, acción traducida y detalle del cobro", () => {
    render(<AuditView entries={[entry]} alerts={[]} />);

    const row = screen.getByRole("row", {
      name: new RegExp(`Carlos Mamani`),
    });
    expect(row).toHaveTextContent(formatDateTime(new Date(entry.at)));
    expect(row).toHaveTextContent("Cobro de venta");
    expect(row).toHaveTextContent("Total Bs 25,00 · Descuento Bs 5,00 · CASH");
  });

  it("traduce acciones conocidas y reserva la bitácora como solo consulta", () => {
    render(
      <AuditView
        entries={[
          { ...entry, id: "a-2", action: "sales.void", summary: {}, reason: "Cobro equivocado" },
          { ...entry, id: "a-3", action: "accion.desconocida", summary: {} },
        ]}
        alerts={[]}
      />,
    );

    expect(screen.getByText("Anulación de venta")).toBeInTheDocument();
    expect(screen.getByText("Cobro equivocado")).toBeInTheDocument();
    expect(screen.getByText("accion.desconocida")).toBeInTheDocument();
    expect(
      screen.getByText(/La bitácora es de solo consulta y no se puede editar ni eliminar/),
    ).toBeInTheDocument();
  });

  it("muestra '—' cuando el actor es desconocido", () => {
    render(<AuditView entries={[{ ...entry, userName: null, summary: {} }]} alerts={[]} />);

    const row = screen.getByRole("row", { name: /Cobro de venta/ });
    expect(row).toHaveTextContent("—");
  });
});
