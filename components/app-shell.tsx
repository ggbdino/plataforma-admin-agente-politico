"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  appVersion: string;
  children: React.ReactNode;
};

export function AppShell({ appVersion, children }: AppShellProps) {
  const pathname = usePathname();
  const isPublicEventPage = pathname.startsWith("/e/");

  if (isPublicEventPage) {
    return (
      <>
        <div className="page-shell">
          <header className="brand-bar">
            <div className="brand-lockup" aria-label="GAP Consult Tecnologia">
              <Image
                alt="Logo oficial da GAP Consult Tecnologia"
                className="brand-logo"
                height={56}
                priority
                src="/gap-logo-oficial.png"
                width={271}
              />
            </div>
          </header>
        </div>
        {children}
      </>
    );
  }

  return (
    <>
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
                <span className="version-badge">{appVersion}</span>
              </div>
              <p className="brand-subtitle">
                Gestão operacional do agente político, implantação de campanhas e governança da automação
              </p>
            </div>
          </Link>
        </header>
      </div>
      {children}
      <footer className="page-footer">
        Powered by <strong>GapConsult</strong>{" "}
        <span className="page-footer-version">{appVersion}</span>
      </footer>
    </>
  );
}
