import { Inter } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LILA MARKET",
  description: "Sistema de gestión comercial para minimarkets.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-BO">
      <body className={`${inter.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
