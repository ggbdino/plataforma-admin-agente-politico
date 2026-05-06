import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
      <body>
        <div className="page-shell">
          <header className="brand-bar">
            <Link className="brand-lockup" href="/">
              <Image
                alt="Logo GAP Consult"
                className="brand-logo"
                height={72}
                priority
                src="/gap-logo-2024.png"
                width={72}
              />
              <div>
                <span className="brand-kicker">GAP Consult</span>
                <h1 className="brand-title">Plataforma Administrativa</h1>
                <p className="brand-subtitle">Gestao operacional do agente politico</p>
              </div>
            </Link>
          </header>
        </div>
        {children}
      </body>
    </html>
  );
}
