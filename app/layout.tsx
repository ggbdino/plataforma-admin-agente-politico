import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "GAP Consult Tecnologia | Plataforma Administrativa",
  description:
    "Painel administrativo da GAP Consult Tecnologia para operação do agente político"
};

const APP_VERSION = "V.14.5.5";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell appVersion={APP_VERSION}>{children}</AppShell>
      </body>
    </html>
  );
}
