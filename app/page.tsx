import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill ok">MVP Caminho A</span>
        <h1 className="title">Plataforma Administrativa do Agente Politico</h1>
        <p className="subtitle">
          O frontend conversa com o backend do proprio app, e o backend conversa com
          o banco e com os workflows do n8n.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button" href="/candidatos">
            Abrir candidatos
          </Link>
        </div>
      </section>
    </main>
  );
}
