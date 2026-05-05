import { notFound } from "next/navigation";
import { getCandidateImplantation } from "@/lib/repositories/implantation";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";
import { StepList } from "@/components/step-list";

type CandidatePageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
};

export default async function CandidateImplantationPage({
  params
}: CandidatePageProps) {
  const { idCandidato } = await params;
  const data = await getCandidateImplantation(idCandidato);

  if (!data) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Tela 2</span>
        <h1 className="title">
          {data.cabecalho.nome_urna} <span className="mono">#{data.cabecalho.id_candidato}</span>
        </h1>
        <p className="subtitle">
          Assistente de implantacao da campanha com QR Code, dados tecnicos e etapas.
        </p>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card key-value">
          <div>
            <strong>Status da implantacao</strong>
            <div style={{ marginTop: 6 }}>
              <ImplantationStatusPill status={data.cabecalho.status_implantacao} />
            </div>
          </div>
          <div>
            <strong>Numero oficial do agente</strong>
            <div className="mono">{data.cabecalho.numero_agente_oficial ?? "-"}</div>
          </div>
          <div>
            <strong>Instancia Evolution</strong>
            <div className="mono">{data.cabecalho.instancia_evolution ?? "-"}</div>
          </div>
          <div>
            <strong>Webhook inbound</strong>
            <div className="mono">{data.cabecalho.webhook_inbound_url ?? "-"}</div>
          </div>
          <div>
            <strong>Webhook outbound</strong>
            <div className="mono">{data.cabecalho.webhook_outbound_url ?? "-"}</div>
          </div>
        </article>

        <article className="card qr-frame">
          <strong>QR Code do agente</strong>
          {data.cabecalho.qr_code_url ? (
            <>
              <img
                alt={`QR Code do candidato ${data.cabecalho.nome_urna}`}
                className="qr-image"
                src={data.cabecalho.qr_code_url}
              />
              <div className="mono">{data.cabecalho.qr_code_url}</div>
            </>
          ) : (
            <p className="muted">QR Code ainda nao gerado.</p>
          )}
        </article>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Etapas da implantacao</h2>
        <StepList idCandidato={idCandidato} steps={data.etapas} />
      </section>
    </main>
  );
}
