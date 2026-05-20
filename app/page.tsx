import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill ok">MVP operacional</span>
        <h1 className="title">Painel GAP para implantação, operação e governança de campanhas</h1>
        <p className="subtitle">
          Um ambiente único para acompanhar candidatos importados, iniciar workflows do n8n,
          validar QR Codes, conduzir a implantação e operar a Inteligência da Campanha com
          controle administrativo.
        </p>
        <div className="hero-meta">
          <span className="pill">Operação por candidato</span>
          <span className="pill">Governança da automação</span>
          <span className="pill">Perfis e permissões internos</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button" href="/candidatos">
            Abrir candidatos
          </Link>
          <Link className="button secondary" href="/estatisticas">
            Inteligência da Campanha
          </Link>
          <Link className="button secondary" href="/gestor">
            Painel do gestor
          </Link>
          <Link className="button secondary" href="/gestora">
            Área da gestora
          </Link>
          <Link className="button secondary" href="/admin/usuarios">
            Usuários e perfis
          </Link>
        </div>
      </section>
    </main>
  );
}
