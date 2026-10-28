import type { Metadata } from "next";
import { DesignShowcase } from "./design-showcase";

export const metadata: Metadata = {
  title: "Sistema de diseño · LILA MARKET",
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">LILA MARKET</p>
        <h1 className="mt-2 text-3xl font-semibold">Sistema de diseño</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Tokens, componentes y estados reutilizables. Esta página es interna y no se indexa.
        </p>
      </header>
      <div className="mt-10">
        <DesignShowcase />
      </div>
    </main>
  );
}
