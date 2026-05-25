"use client";

import { useMemo, useState } from "react";
import type { CandidateListItem } from "@/lib/types";

type WorkflowFeedback = {
  feedback?: string;
  mensagem?: string;
};

type WorkflowCenterPanelProps = {
  candidates: CandidateListItem[];
  defaultCandidateId: string;
  isAdmin: boolean;
  feedback?: WorkflowFeedback;
  triggerAction: (payload: FormData) => void;
};

const BATCH_WORKFLOWS = [
  {
    ordem: "1",
    workflow: "candidato_sync",
    title: "Sincronizar candidatos",
    description:
      "Processa toda a planilha-base e atualiza apenas candidatos novos ou alterados desde a ultima sincronizacao."
  }
] as const;

const CANDIDATE_WORKFLOWS = [
  {
    ordem: "2",
    workflow: "qrcode_canais",
    title: "Gerar QR Code e canais",
    description:
      "Dispara o workflow de QR Code e atualizacao dos canais do candidato selecionado."
  },
  {
    ordem: "3",
    workflow: "governanca",
    title: "Governança da agenda",
    description:
      "Aciona o workflow de governança para registrar agenda, eventos, reuniões e canais do candidato selecionado."
  },
  {
    ordem: "4",
    workflow: "entrada_eleitor",
    title: "Simular entrada de eleitor",
    description:
      "Aciona o workflow de entrada no funil com nome, telefone e mensagem para o candidato selecionado."
  },
  {
    ordem: "5",
    workflow: "cadencia",
    title: "Acionar cadencia",
    description: "Inicia o workflow de cadencia e reativacao controlada do candidato selecionado."
  }
] as const;

function getReadiness(candidate: CandidateListItem | undefined) {
  if (!candidate) {
    return {
      canRunQrcode: false,
      canRunGovernance: false,
      canRunInbound: false,
      canRunCadence: false
    };
  }

  const hasImplantation = Boolean(candidate.status_implantacao);
  const hasInstance = Boolean(candidate.instancia_evolution);
  const hasNumber = Boolean(candidate.numero_agente_oficial);
  const hasQr = Boolean(candidate.qr_code_url);

  return {
    hasImplantation,
    hasInstance,
    hasNumber,
    hasQr,
    canRunQrcode: hasImplantation,
    canRunGovernance: hasImplantation,
    canRunInbound: hasNumber,
    canRunCadence: hasNumber
  };
}

export function WorkflowCenterPanel({
  candidates,
  defaultCandidateId,
  isAdmin,
  feedback,
  triggerAction
}: WorkflowCenterPanelProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState(defaultCandidateId);
  const [governanceResource, setGovernanceResource] = useState("agenda");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id_candidato === selectedCandidateId),
    [candidates, selectedCandidateId]
  );
  const readiness = getReadiness(selectedCandidate);

  return (
    <main className="page-shell">
      {feedback?.feedback && feedback?.mensagem ? (
        <section className={`feedback-banner ${feedback.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{feedback.feedback === "sucesso" ? "Workflow iniciado." : "Falha ao iniciar workflow."}</strong>
          <div style={{ marginTop: 6 }}>{feedback.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Governanca de workflows</span>
        <h1 className="title">Central de workflows do n8n</h1>
        <p className="subtitle">
          Todos os workflows estrategicos da automacao podem ser iniciados a partir desta
          plataforma, com trilha administrativa, ordenacao operacional e contexto de campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">{isAdmin ? "Administrador autenticado" : "Acesso restrito"}</span>
          <span className="pill">Origem unica da governanca</span>
          <span className="pill">{candidates.length} candidato(s) disponivel(is) na base</span>
        </div>
        <div className="workflow-guidance">
          <div className="workflow-guidance-card">
            <strong>Operacao em lote</strong>
            <span>
              Use o fluxo 1 para sincronizar toda a planilha. Ele verifica todos os candidatos
              atualizados externamente e evita duplicidade por identificador.
            </span>
          </div>
          <div className="workflow-guidance-card">
            <strong>Operacao por candidato</strong>
            <span>
              Depois da sincronizacao, selecione um candidato ja refletido na base e siga a
              implantacao. Os fluxos dependentes so podem ser executados quando os requisitos
              minimos do ambiente estiverem disponiveis.
            </span>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <a className="button secondary" href="/estatisticas/governanca">
            Voltar para governanca
          </a>
        </div>
      </section>

      <section className="card workflow-candidate-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Candidato selecionado para operacao</h2>
            <p className="subtitle">
              A selecao usa apenas os candidatos que ja estao gravados na base da plataforma.
            </p>
          </div>
        </div>
        <div className="workflow-candidate-grid">
          <label className="step-note" style={{ marginBottom: 0 }}>
            <span>Candidato da base</span>
            <select
              className="step-input"
              value={selectedCandidateId}
              onChange={(event) => setSelectedCandidateId(event.target.value)}
            >
              {candidates.map((candidate) => (
                <option key={candidate.id_candidato} value={candidate.id_candidato}>
                  {candidate.id_candidato} - {candidate.nome_urna}
                  {candidate.partido ? ` (${candidate.partido})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="workflow-status-grid">
            <div className="workflow-status-card">
              <span className="metric-label">Status de implantacao</span>
              <strong>{selectedCandidate?.status_implantacao ?? "Nao iniciado"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">Instancia da Evolution</span>
              <strong>{selectedCandidate?.instancia_evolution ?? "Pendente"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">Numero oficial</span>
              <strong>{selectedCandidate?.numero_agente_oficial ?? "Pendente"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">QR</span>
              <strong>{selectedCandidate?.qr_code_url ? "Disponivel" : "Pendente"}</strong>
            </div>
          </div>
        </div>
        <div className="workflow-guidance" style={{ marginTop: 16 }}>
          <div className="workflow-guidance-card">
            <strong>Controle minimo de implantacao</strong>
            <span>
              Para nao falhar com administradores, a plataforma considera que a operacao por
              candidato depende de cadastro sincronizado, registro de implantacao e, quando
              necessario, numero oficial e instancia ativa.
            </span>
          </div>
          <div className="workflow-guidance-card">
            <strong>Proximo passo sugerido</strong>
            <span>
              {readiness.canRunQrcode
                ? "O candidato ja possui registro minimo de implantacao. Siga com QR Code, governanca e demais fluxos conforme a necessidade."
                : "Sincronize os candidatos e depois abra a tela de Implantacao do candidato para criar a instancia e registrar o ambiente antes dos fluxos operacionais."}
            </span>
          </div>
        </div>
      </section>

      <section className="analytics-stack" style={{ marginBottom: 16 }}>
        <div className="section-heading">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Fluxos em lote
          </h2>
        </div>
        <div className="grid grid-2">
          {BATCH_WORKFLOWS.map(({ ordem, workflow, title, description }) => (
            <article className="card analytics-panel" key={workflow}>
              <div className="workflow-card-head">
                <span className="workflow-order">Etapa {ordem}</span>
                <h3 className="section-title workflow-card-title">{title}</h3>
              </div>
              <p className="subtitle">{description}</p>
              <form action={triggerAction} className="manager-auth-form">
                <input name="workflow" type="hidden" value={workflow} />
                <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
                <div className="step-panel-callout">
                  Este fluxo nao depende de um candidato especifico. Ele percorre toda a planilha
                  externa e atualiza somente os registros novos ou alterados desde a ultima
                  execucao.
                </div>
                <div className="actions">
                  <button className="button" type="submit">
                    Iniciar workflow pela plataforma
                  </button>
                </div>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-stack">
        <div className="section-heading">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Fluxos por candidato
          </h2>
        </div>
        <div className="grid grid-2">
          {CANDIDATE_WORKFLOWS.map(({ ordem, workflow, title, description }) => {
            const disabled =
              (workflow === "qrcode_canais" && !readiness.canRunQrcode) ||
              (workflow === "governanca" && !readiness.canRunGovernance) ||
              (workflow === "entrada_eleitor" && !readiness.canRunInbound) ||
              (workflow === "cadencia" && !readiness.canRunCadence);

            return (
              <article className="card analytics-panel" key={workflow}>
                <div className="workflow-card-head">
                  <span className="workflow-order">Etapa {ordem}</span>
                  <h3 className="section-title workflow-card-title">{title}</h3>
                </div>
                <p className="subtitle">{description}</p>
                <form action={triggerAction} className="manager-auth-form">
                  <input name="workflow" type="hidden" value={workflow} />
                  <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
                  <input name="idCandidato" type="hidden" value={selectedCandidateId} />

                  {workflow === "governanca" ? (
                    <>
                      <div className="step-panel-callout">
                        Registre aqui apenas os dados operacionais do item que será governado. O
                        candidato selecionado já vem da base oficial da plataforma e os campos
                        técnicos ficam protegidos para evitar erro humano.
                      </div>
                      <input
                        name="liderId"
                        type="hidden"
                        value="d4ee483c-282c-428b-8ce2-188001d783d0"
                      />
                      <input name="acao" type="hidden" value="upsert" />
                      <label className="step-note">
                        <span>Tipo de registro</span>
                        <select
                          className="step-input"
                          name="recurso"
                          onChange={(event) => setGovernanceResource(event.target.value)}
                          value={governanceResource}
                        >
                          <option value="agenda">Agenda</option>
                          <option value="evento">Evento ou reunião</option>
                          <option value="canal">Canal</option>
                        </select>
                      </label>
                      <label className="step-note">
                        <span>Nome ou título</span>
                        <input
                          className="step-input"
                          defaultValue={governanceResource === "canal" ? "Canal de campanha" : "Agenda de campanha"}
                          name="governanceNome"
                          type="text"
                        />
                      </label>
                      <label className="step-note">
                        <span>Descrição</span>
                        <textarea
                          className="step-textarea"
                          defaultValue={
                            governanceResource === "canal"
                              ? "Canal registrado pela plataforma para uso operacional da campanha."
                              : "Evento gerado pela plataforma para organização da agenda de campanha."
                          }
                          name="governanceDescricao"
                          rows={3}
                        />
                      </label>
                      {governanceResource !== "canal" ? (
                        <>
                          <div className="step-form-grid">
                            <label className="step-note">
                              <span>Data de início</span>
                              <input
                                className="step-input"
                                defaultValue="2026-07-30T14:00"
                                name="governanceDataInicio"
                                type="datetime-local"
                              />
                            </label>
                            <label className="step-note">
                              <span>Data de fim</span>
                              <input
                                className="step-input"
                                defaultValue="2026-07-30T18:00"
                                name="governanceDataFim"
                                type="datetime-local"
                              />
                            </label>
                          </div>
                          <div className="step-form-grid">
                            <label className="step-note">
                              <span>Local ou identificador</span>
                              <input
                                className="step-input"
                                defaultValue="A definir"
                                name="governanceLocalNome"
                                type="text"
                              />
                            </label>
                            <label className="step-note">
                              <span>Endereço ou URL</span>
                              <input
                                className="step-input"
                                defaultValue="A confirmar"
                                name="governanceEnderecoOuUrl"
                                type="text"
                              />
                            </label>
                          </div>
                          <div className="step-form-grid">
                            <label className="step-note">
                              <span>Cidade</span>
                              <input
                                className="step-input"
                                defaultValue="Brasília"
                                name="governanceCidade"
                                type="text"
                              />
                            </label>
                            <label className="step-note">
                              <span>UF</span>
                              <input
                                className="step-input"
                                defaultValue="DF"
                                name="governanceUf"
                                type="text"
                              />
                            </label>
                          </div>
                        </>
                      ) : (
                        <div className="step-form-grid">
                          <label className="step-note">
                            <span>Identificador do canal</span>
                            <input
                              className="step-input"
                              defaultValue="whatsapp-oficial"
                              name="governanceLocalNome"
                              type="text"
                            />
                          </label>
                          <label className="step-note">
                            <span>URL do canal</span>
                            <input
                              className="step-input"
                              defaultValue="https://wa.me/5561993194306"
                              name="governanceEnderecoOuUrl"
                              type="text"
                            />
                          </label>
                        </div>
                      )}
                      <div className="step-form-grid">
                        <label className="step-note">
                          <span>Tipo complementar</span>
                          <input
                            className="step-input"
                            defaultValue={governanceResource === "canal" ? "whatsapp" : "reuniao"}
                            name="governanceTipo"
                            placeholder="Exemplo: reuniao, whatsapp, instagram"
                            type="text"
                          />
                        </label>
                        <label className="step-note">
                          <span>Status</span>
                          <input
                            className="step-input"
                            defaultValue="planejado"
                            name="governanceStatus"
                            placeholder="Exemplo: planejado, ativo"
                            type="text"
                          />
                        </label>
                      </div>
                      {governanceResource !== "canal" ? (
                        <>
                          <label className="step-note">
                            <span>Canal de confirmação</span>
                            <input
                              className="step-input"
                              defaultValue="https://sympla.com.br"
                              name="governanceCanalConfirmacao"
                              type="text"
                            />
                          </label>
                          <label className="step-note">
                            <span>Capacidade estimada</span>
                            <input
                              className="step-input"
                              defaultValue="0"
                              name="governanceCapacidade"
                              type="number"
                            />
                          </label>
                        </>
                      ) : null}
                      <label className="step-note">
                        <span>Referencia</span>
                        <span className="step-field-hint">
                          Use apenas quando estiver atualizando um registro já existente da agenda.
                          Se esta for uma agenda nova, deixe em branco.
                        </span>
                        <input
                          className="step-input"
                          name="referenciaId"
                          placeholder="Exemplo: UUID de uma agenda já cadastrada"
                          type="text"
                        />
                      </label>
                      <label className="step-note">
                        <span>Observação operacional</span>
                        <input
                          className="step-input"
                          defaultValue="Operacao de governanca acionada pela plataforma."
                          name="observacao"
                          type="text"
                        />
                      </label>
                    </>
                  ) : null}

                  {workflow === "entrada_eleitor" || workflow === "cadencia" ? (
                    <>
                      {workflow === "cadencia" ? (
                        <div className="step-panel-callout">
                          A cadência deve ser acionada depois que já existir eleitor registrado na
                          base do candidato, seja por importação ou por entrada no funil.
                        </div>
                      ) : null}
                      <label className="step-note">
                        <span>Telefone</span>
                        <input
                          className="step-input"
                          defaultValue={selectedCandidate?.numero_agente_oficial ?? ""}
                          name="telefone"
                          placeholder="Use o numero oficial do candidato."
                          type="text"
                        />
                      </label>
                      <label className="step-note">
                        <span>Nome</span>
                        <input className="step-input" defaultValue="Eleitor Teste" name="nome" type="text" />
                      </label>
                    </>
                  ) : null}

                  {workflow === "entrada_eleitor" ? (
                    <label className="step-note">
                      <span>Mensagem</span>
                      <textarea
                        className="step-textarea"
                        defaultValue="Ola, quero saber mais sobre a campanha."
                        name="mensagem"
                        rows={3}
                      />
                    </label>
                  ) : null}

                  {disabled ? (
                    <div className="step-warning">
                      {workflow === "qrcode_canais" || workflow === "governanca"
                        ? "Este fluxo exige que o candidato ja tenha registro minimo de implantacao no ambiente."
                        : "Este fluxo exige que o candidato ja tenha numero oficial registrado na implantacao."}
                    </div>
                  ) : null}

                  <div className="actions">
                    <button className="button" disabled={disabled} type="submit">
                      Iniciar workflow pela plataforma
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
