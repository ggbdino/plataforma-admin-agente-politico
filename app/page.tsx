import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill ok">MVP operacional</span>
        <h1 className="title">Painel GAP para implantacao, operacao e governanca de campanhas</h1>
        <p className="subtitle">
          Um ambiente unico para acompanhar candidatos importados, iniciar workflows do n8n,
          validar QR Codes, conduzir a implantacao e operar a Inteligencia da Campanha com
          controle administrativo.
        </p>
        <div className="hero-meta">
          <span className="pill">Operacao por candidato</span>
          <span className="pill">Governanca da automacao</span>
          <span className="pill">Perfis e permissoes internos</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button" href="/candidatos">
            Abrir candidatos
          </Link>
          <Link className="button secondary" href="/estatisticas">
            Inteligencia da Campanha
          </Link>
          <Link className="button secondary" href="/gestor">
            Painel do admin
          </Link>
          <Link className="button secondary" href="/gestora">
            Area da gestora
          </Link>
          <Link className="button secondary" href="/admin/usuarios">
            Usuarios e perfis
          </Link>
          <Link className="button secondary" href="/admin/candidatos">
            Saneamento da base
          </Link>
        </div>
      </section>
    </main>
  );
}
