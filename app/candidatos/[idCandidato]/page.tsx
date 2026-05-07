import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCandidateImplantation } from "@/lib/repositories/implantation";
import { ImplantationStatusPill } from "@/components/implantation-status-pill";
import { StepList } from "@/components/step-list";

export const dynamic = "force-dynamic";

type CandidatePageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export default async function CandidateImplantationPage({
  params,
  searchParams
}: CandidatePageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const data = await getCandidateImplantation(idCandidato);

  if (!data) {
    notFound();
  }

  const totalEtapas = data.etapas.length;
  const etapasConcluidas = data.etapas.filter((step) => step.status_etapa === "concluida").length;
  const etapasComErro = data.etapas.filter((step) => step.status_etapa === "com_erro").length;
  const progresso = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;
  const proximaEtapa =
    data.etapas.find((step) => step.status_etapa !== "concluida")?.nome_etapa ??
    "Implantacao concluida";
  const prontaParaAtivar =
    data.etapas
      .filter((step) => step.codigo_etapa !== "ativar_campanha")
      .every((step) => step.status_etapa === "concluida") && data.cabecalho.status_implantacao !== "ativo";

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section
          className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
        >
          <strong>{query.feedback === "sucesso" ? "Operacao concluida." : "Falha na etapa."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Tela 2</span>
        <h1 className="title">
          {data.cabecalho.nome_urna} <span className="mono">#{data.cabecalho.id_candidato}</span>
        </h1>
        <p className="subtitle">
          Assistente de implantacao da campanha com QR Code, dados tecnicos e etapas
          operacionais da GAP.
        </p>
        <div className="hero-meta">
          <ImplantationStatusPill status={data.cabecalho.status_implantacao} />
          <span className="pill">Instancia {data.cabecalho.instancia_evolution ?? "pendente"}</span>
          <span className="pill">{progresso}% concluido</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Area do Gestor da Campanha
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card metric-card">
          <span className="metric-label">Progresso da implantacao</span>
          <strong className="metric-value">{progresso}%</strong>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${progresso}%` }} />
          </div>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Proxima etapa</span>
          <strong className="metric-title">{proximaEtapa}</strong>
          <span className="muted">
            {etapasConcluidas} de {totalEtapas} etapas concluidas
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Leitura operacional</span>
          <strong className="metric-title">
            {prontaParaAtivar
              ? "Campanha pronta para ativacao"
              : etapasComErro > 0
                ? "Existem incidentes a tratar"
                : "Implantacao em andamento"}
          </strong>
          <span className="muted">
            {etapasComErro > 0
              ? `${etapasComErro} etapa(s) com erro exigem revisao`
              : prontaParaAtivar
                ? "A etapa final pode ser registrada no painel"
                : "Conclua a proxima etapa recomendada para seguir"}
          </span>
        </article>
      </section>

      {data.atualizacaoGestora ? (
        <section className="card manager-update-card" style={{ marginBottom: 20 }}>
          <div className="section-heading">
            <div>
              <h2 className="section-title">Ultima atualizacao da gestora</h2>
              <p className="subtitle">
                Registro trazido da area especial da gestora para dar visibilidade imediata
                ao administrativo sobre o que foi alterado na campanha.
              </p>
            </div>
            <span className="pill ok">Origem: gestora da campanha</span>
          </div>
          <div className="manager-update-grid">
            <div>
              <strong>Executado em</strong>
              <div className="muted">
                {data.atualizacaoGestora.executado_em
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(data.atualizacaoGestora.executado_em))
                  : "-"}
              </div>
            </div>
            <div>
              <strong>Finalizado em</strong>
              <div className="muted">
                {data.atualizacaoGestora.finalizado_em
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(data.atualizacaoGestora.finalizado_em))
                  : "-"}
              </div>
            </div>
            <div>
              <strong>Status do registro</strong>
              <div className="muted">{data.atualizacaoGestora.status_execucao}</div>
            </div>
          </div>
          <div className="step-panel-callout" style={{ marginTop: 14 }}>
            {data.atualizacaoGestora.resumo ?? "Sem resumo da ultima atualizacao."}
          </div>
        </section>
      ) : null}

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
            <div className="mono mono-wrap">{data.cabecalho.webhook_inbound_url ?? "-"}</div>
          </div>
          <div>
            <strong>Webhook outbound</strong>
            <div className="mono mono-wrap">{data.cabecalho.webhook_outbound_url ?? "-"}</div>
          </div>
        </article>

        <article className="card qr-frame">
          <strong>QR Code do agente</strong>
          <p className="qr-description">
            Este QR Code deve ser utilizado no telefone oficial da campanha para vincular o
            numero ao Agente Politico. A partir desse contato, qualquer conversa no WhatsApp
            passa a alimentar o funil de captacao, relacionamento e conversao da campanha.
          </p>
          {data.cabecalho.qr_code_url ? (
            <>
              <Image
                alt={`QR Code do candidato ${data.cabecalho.nome_urna}`}
                className="qr-image"
                height={240}
                src={data.cabecalho.qr_code_url}
                unoptimized
                width={240}
              />
              <div className="step-panel-callout">
                Divulgue este QR Code e o numero oficial em redes sociais, site, eventos e
                materiais graficos para centralizar o relacionamento no WhatsApp do Agente
                Politico.
              </div>
              <div className="mono mono-wrap">{data.cabecalho.qr_code_url}</div>
            </>
          ) : (
            <p className="muted">QR Code ainda nao gerado.</p>
          )}
        </article>
      </section>

      <section className="card">
        <h2 className="section-title">Etapas da implantacao</h2>
        <StepList
          candidateName={data.cabecalho.nome_urna}
          idCandidato={idCandidato}
          officialNumber={data.cabecalho.numero_agente_oficial}
          steps={data.etapas}
        />
      </section>
    </main>
  );
}
