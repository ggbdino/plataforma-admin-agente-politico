import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { authenticateCampaignAnalyticsAction } from "@/lib/actions/campaign-analytics-action";
import { getCampaignConversationExplorer } from "@/lib/repositories/campaign-analytics";

export const dynamic = "force-dynamic";

type CampaignConversationsPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    busca?: string;
    etapa?: string;
    origem?: string;
    sentimento?: string;
    eleitorUid?: string;
  }>;
};

export default async function CampaignConversationsPage({
  params,
  searchParams
}: CampaignConversationsPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const hasAccess =
    cookieStore.get(`campaign-analytics-access-${idCandidato}`)?.value === "ok";
  const explorer = await getCampaignConversationExplorer(idCandidato, {
    busca: query?.busca,
    etapa: query?.etapa,
    origem: query?.origem,
    sentimento: query?.sentimento,
    eleitorUid: query?.eleitorUid
  });

  if (!explorer) {
    notFound();
  }

  if (!hasAccess) {
    return (
      <main className="page-shell">
        {query?.feedback && query?.mensagem ? (
          <section
            className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
          >
            <strong>
              {query.feedback === "sucesso"
                ? "Operação concluída."
                : "Acesso ao console de conversas não liberado."}
            </strong>
            <div style={{ marginTop: 6 }}>{query.mensagem}</div>
          </section>
        ) : null}

        <section className="hero-card">
          <span className="pill">Console de conversas</span>
          <h1 className="title">Acesso protegido ao histórico conversacional</h1>
          <p className="subtitle">
            Esta área permite consultar eleitores, sinais políticos e volume de interação da campanha.
          </p>
        </section>

        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso ao console</h2>
          <form action={authenticateCampaignAnalyticsAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input
              name="redirectTo"
              type="hidden"
              value={`/campanhas/${idCandidato}/conversas`}
            />
            <label className="step-note">
              <span>Senha de acesso</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar no console
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Console de conversas</span>
        <h1 className="title">
          Conversas da campanha de {explorer.cabecalho.nome_urna}
        </h1>
        <p className="subtitle">
          Consulta individualizada dos eleitores com filtros, leitura de histórico, etapa do funil,
          sentimento, intenção de voto e densidade de contato.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/campanhas/${idCandidato}`}>
            Voltar ao painel da campanha
          </Link>
          <Link className="button secondary" href="/estatisticas">
            Inteligência da Campanha
          </Link>
        </div>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Exploração inteligente da base</h2>
            <p className="subtitle">
              Filtre a leitura por etapa, origem, sentimento ou eleitor para navegar entre o agregado e o detalhe.
            </p>
          </div>
          <span className="pill ok">Drill-down e drill-up ativos</span>
        </div>
        <form className="step-form-grid" method="get">
          <label className="step-note">
            <span>Busca por nome, telefone ou identificador</span>
            <input
              className="step-input"
              defaultValue={explorer.filtros.busca}
              name="busca"
              type="text"
            />
          </label>
          <label className="step-note">
            <span>Etapa do funil</span>
            <select className="step-input" defaultValue={explorer.filtros.etapa} name="etapa">
              <option value="">Todas</option>
              {explorer.opcoes.etapas.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {labelStage(etapa)}
                </option>
              ))}
            </select>
          </label>
          <label className="step-note">
            <span>Origem de captação</span>
            <select className="step-input" defaultValue={explorer.filtros.origem} name="origem">
              <option value="">Todas</option>
              {explorer.opcoes.origens.map((origem) => (
                <option key={origem} value={origem}>
                  {origem}
                </option>
              ))}
            </select>
          </label>
          <label className="step-note">
            <span>Sentimento</span>
            <select
              className="step-input"
              defaultValue={explorer.filtros.sentimento}
              name="sentimento"
            >
              <option value="">Todos</option>
              {explorer.opcoes.sentimentos.map((sentimento) => (
                <option key={sentimento} value={sentimento}>
                  {sentimento}
                </option>
              ))}
            </select>
          </label>
          <div className="actions" style={{ alignItems: "end" }}>
            <button className="button" type="submit">
              Aplicar filtros
            </button>
            <Link className="button secondary" href={`/campanhas/${idCandidato}/conversas`}>
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="grid grid-2">
        <section className="card">
          <h2 className="section-title">Base filtrada de conversas</h2>
          <div className="table-responsive">
            <table className="table analytics-table">
              <thead>
                <tr>
                  <th>Eleitor</th>
                  <th>Origem</th>
                  <th>Etapa</th>
                  <th>Sinal político</th>
                  <th>Interações</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {explorer.conversas.map((conversation) => (
                  <tr key={conversation.eleitor_uid}>
                    <td>
                      <strong>{normalizeDisplayValue(conversation.nome, "Eleitor não identificado")}</strong>
                      <div className="mono">
                        {normalizeDisplayValue(
                          conversation.telefone,
                          normalizeDisplayValue(conversation.eleitor_id, "Sem identificador")
                        )}
                      </div>
                    </td>
                    <td>{normalizeDisplayValue(conversation.origem_captacao, "-")}</td>
                    <td>{labelStage(conversation.etapa_funil)}</td>
                    <td>
                      <div>{normalizeDisplayValue(conversation.intencao_voto, "sem leitura")}</div>
                      <div className="muted">
                        {normalizeDisplayValue(conversation.sentimento, "sem sentimento")}
                      </div>
                    </td>
                    <td>{conversation.total_interacoes}</td>
                    <td>
                      <Link
                        className="button secondary"
                        href={buildConversationDetailHref(idCandidato, explorer.filtros, conversation.eleitor_uid)}
                      >
                        Abrir histórico
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card analytics-panel">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Histórico do eleitor</h2>
              <p className="subtitle">
                Drill-down do eleitor selecionado com leitura temporal da conversa.
              </p>
            </div>
            {explorer.conversaSelecionada ? (
              <span className="pill ok">{explorer.conversaSelecionada.resumo.total_interacoes} interações</span>
            ) : null}
          </div>
          {explorer.conversaSelecionada ? (
            <>
              <div className="manager-channel-box">
                <strong>
                  {normalizeDisplayValue(
                    explorer.conversaSelecionada.resumo.nome,
                    "Eleitor não identificado"
                  )}
                </strong>
                <div className="mono">
                  {normalizeDisplayValue(
                    explorer.conversaSelecionada.resumo.telefone,
                    normalizeDisplayValue(explorer.conversaSelecionada.resumo.eleitor_id, "Sem identificador")
                  )}
                </div>
                <div className="muted">
                  {labelStage(explorer.conversaSelecionada.resumo.etapa_funil)} |{" "}
                  {normalizeDisplayValue(
                    explorer.conversaSelecionada.resumo.intencao_voto,
                    "sem leitura de intenção"
                  )}
                </div>
              </div>
              <div className="conversation-timeline">
                {explorer.conversaSelecionada.historico.map((item) => (
                  <article
                    className={`conversation-event ${item.direcao === "outbound" ? "outbound" : "inbound"}`}
                    key={item.id}
                  >
                    <div className="conversation-event-head">
                      <strong>{item.direcao === "outbound" ? "Saída da campanha" : "Entrada do eleitor"}</strong>
                      <span className="muted">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short"
                        }).format(new Date(item.criado_em))}
                      </span>
                    </div>
                    <div className="muted">{item.canal}</div>
                    <div className="conversation-message-stack">
                      {renderConversationBodies(item)}
                    </div>
                    <div className="conversation-event-meta">
                      <span className="pill">
                        {normalizeDisplayValue(item.tema_classificado, "tema livre")}
                      </span>
                      <span className="pill">
                        {normalizeDisplayValue(item.sentimento, "sem sentimento")}
                      </span>
                      <span className="pill">
                        {normalizeDisplayValue(item.intencao_voto, "sem intenção")}
                      </span>
                      <span className="pill">
                        {normalizeDisplayValue(item.etapa_sugerida, "sem etapa sugerida")}
                      </span>
                      <span className="pill warn">
                        {normalizeDisplayValue(item.risco_compliance, "risco baixo")}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="step-panel-callout">
              Selecione um eleitor na tabela ao lado para abrir o histórico detalhado.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function renderConversationBodies(item: {
  direcao: string;
  mensagem: string | null;
  resposta_eleitor: string | null;
}) {
  const blocks: Array<{ label: string; content: string; tone: "agent" | "elector" }> = [];
  const mensagem = normalizeTextContent(item.mensagem);
  const respostaEleitor = normalizeTextContent(item.resposta_eleitor);

  if (item.direcao === "inbound") {
    if (respostaEleitor) {
      blocks.push({
        label: "Mensagem do eleitor",
        content: respostaEleitor,
        tone: "elector"
      });
    }

    if (mensagem && mensagem !== respostaEleitor) {
      blocks.push({
        label: "Resposta do agente",
        content: mensagem,
        tone: "agent"
      });
    }
  } else {
    if (mensagem) {
      blocks.push({
        label: "Saida da campanha",
        content: mensagem,
        tone: "agent"
      });
    }

    if (respostaEleitor && respostaEleitor !== mensagem) {
      blocks.push({
        label: "Resposta registrada do eleitor",
        content: respostaEleitor,
        tone: "elector"
      });
    }
  }

  if (blocks.length === 0) {
    return <div>Sem conteúdo textual</div>;
  }

  return blocks.map((block, index) => (
    <div className={`conversation-message-block ${block.tone}`} key={`${block.label}-${index}`}>
      <strong>{block.label}</strong>
      <div>{block.content}</div>
    </div>
  ));
}

function labelStage(stage: string | null) {
  const normalizedStage = normalizeTextContent(stage);

  if (!normalizedStage) {
    return "não_classificado";
  }

  return normalizedStage.replace(/_/g, " ");
}

function buildConversationDetailHref(
  idCandidato: string,
  filters: {
    busca: string;
    etapa: string;
    origem: string;
    sentimento: string;
  },
  eleitorUid: string
) {
  const params = new URLSearchParams();

  if (filters.busca) {
    params.set("busca", filters.busca);
  }

  if (filters.etapa) {
    params.set("etapa", filters.etapa);
  }

  if (filters.origem) {
    params.set("origem", filters.origem);
  }

  if (filters.sentimento) {
    params.set("sentimento", filters.sentimento);
  }

  params.set("eleitorUid", eleitorUid);

  return `/campanhas/${idCandidato}/conversas?${params.toString()}`;
}

function normalizeTextContent(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  const lower = normalized.toLowerCase();

  if (lower === "undefined" || lower === "null") {
    return "";
  }

  return normalized;
}

function normalizeDisplayValue(
  value: string | null | undefined,
  fallback: string
) {
  return normalizeTextContent(value) || fallback;
}
