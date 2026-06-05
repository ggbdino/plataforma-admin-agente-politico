import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GAP Consult Tecnologia | Plataforma Administrativa",
  description:
    "Painel administrativo da GAP Consult Tecnologia para operação do agente político"
};

const APP_VERSION = "V.14.1.4";

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
                alt="Logo oficial da GAP Consult Tecnologia"
                className="brand-logo"
                height={56}
                priority
                src="/gap-logo-oficial.png"
                width={271}
              />
              <div>
                <span className="brand-kicker">GAP Consult Tecnologia</span>
                <div className="brand-title-row">
                  <h1 className="brand-title">Plataforma Administrativa</h1>
                  <span className="version-badge">{APP_VERSION}</span>
                </div>
                <p className="brand-subtitle">
                  Gestão operacional do agente político, implantação de campanhas e governança da
                  automação
                </p>
              </div>
            </Link>
          </header>
        </div>
        {children}
        <footer className="page-footer">
          Powered by <strong>GapConsult</strong>{" "}
          <span className="page-footer-version">{APP_VERSION}</span>
        </footer>
      </body>
    </html>
  );
}
