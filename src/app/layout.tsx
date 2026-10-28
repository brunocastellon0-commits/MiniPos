import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LILA MARKET",
  description: "Sistema de gestión comercial para minimarkets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-BO">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
