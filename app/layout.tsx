import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { APP_VERSION } from "@/lib/version";
import { getCurrentPlatformSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "GAP Consult Tecnologia | Plataforma Administrativa",
  description:
    "Painel administrativo da GAP Consult Tecnologia para operação do agente político"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentPlatformSession();
  const userSession = session
    ? {
        nome: session.nome,
        perfil: session.perfil
      }
    : null;

  return (
    <html lang="pt-BR">
      <body>
        <AppShell appVersion={APP_VERSION} userSession={userSession}>{children}</AppShell>
      </body>
    </html>
  );
}
