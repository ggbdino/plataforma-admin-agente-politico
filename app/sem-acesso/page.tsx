import Link from "next/link";

export default function SemAcessoPage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Acesso restrito</span>
        <h1 className="title">Usuário sem campanha vinculada</h1>
        <p className="subtitle">
          O login foi reconhecido, mas este usuário ainda não possui uma campanha vinculada para
          operação. Ajuste o cadastro em usuários e perfis para liberar o acesso correto.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/">
            Voltar para entrada
          </Link>
        </div>
      </section>
    </main>
  );
}
