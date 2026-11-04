import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anular venta"
        description="Se repone el stock y se revierte la caja."
      >
        <p>Motivo: error de cobro.</p>
        <button type="button">Confirmar</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("no renderiza nada mientras está cerrado", () => {
    render(<DialogHarness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre con nombre accesible, aria-modal y foco dentro", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = screen.getByRole("dialog", { name: "Anular venta" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Motivo: error de cobro.")).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("cierra con Escape y devuelve el foco al disparador", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("cierra al hacer clic en el overlay", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(screen.getByTestId("dialog-overlay"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("encicla el foco con Tab y Shift+Tab dentro del diálogo (E11-04)", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = screen.getByRole("dialog", { name: "Anular venta" });
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])"),
    );
    expect(focusable.length).toBeGreaterThan(1);
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
