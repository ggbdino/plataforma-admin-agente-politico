import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill ok">MVP Caminho A</span>
        <h1 className="title">Painel GAP para implantacao e operacao de campanhas</h1>
        <p className="subtitle">
          Um ambiente unico para acompanhar candidatos importados, acionar workflows do
          n8n, validar QR Codes e conduzir a implantacao de cada campanha com mais
          clareza visual.
        </p>
        <div className="hero-meta">
          <span className="pill">Tema azul institucional</span>
          <span className="pill">Operacao por candidato</span>
          <span className="pill">Backend integrado ao n8n</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button" href="/candidatos">
            Abrir candidatos
          </Link>
          <Link className="button secondary" href="/estatisticas">
            Inteligencia da Campanha
          </Link>
          <Link className="button secondary" href="/gestor">
            Painel do gestor
          </Link>
          <Link className="button secondary" href="/gestora">
            Area da gestora
          </Link>
        </div>
      </section>
    </main>
  );
}
