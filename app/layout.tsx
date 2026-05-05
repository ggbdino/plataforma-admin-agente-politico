import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agente Politico Admin",
  description: "Painel administrativo do Agente Politico"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
