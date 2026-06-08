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
      "Processa toda a planilha-base e atualiza apenas candidatos novos ou alterados desde a última sincronização.",
    buttonLabel: "Sincronizar candidatos"
  }
] as const;

const CANDIDATE_WORKFLOWS = [
  {
    ordem: "2",
    workflow: "qrcode_canais",
    title: "Gerar QR de conexão do WhatsApp",
    description:
      "Gera o QR de pareamento da instância Evolution para vincular a nova linha do candidato ao webhook conversacional.",
    buttonLabel: "Gerar QR code"
  },
  {
    ordem: "3",
    workflow: "governanca",
    title: "Atualizar eventos/canais",
    description:
      "Aciona o workflow de governança para registrar agenda, eventos, reuniões e canais do candidato selecionado.",
    buttonLabel: "Atualizar eventos/canais"
  },
  {
    ordem: "4",
    workflow: "entrada_eleitor",
    title: "Simular diálogo do Eleitor",
    description:
      "Aciona o workflow de entrada no funil com nome, telefone e mensagem para o candidato selecionado.",
    buttonLabel: "Simular diálogo do Eleitor"
  },
  {
    ordem: "5",
    workflow: "cadencia",
    title: "Cadenciar relacionamento",
    description: "Inicia o workflow de cadência e reativação controlada do candidato selecionado.",
    buttonLabel: "Cadenciar relacionamento"
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
  const hasNumber = Boolean(candidate.numero_agente_oficial);

  return {
    canRunQrcode: hasImplantation && hasNumber,
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
  const [governanceResource, setGovernanceResource] = useState("");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id_candidato === selectedCandidateId),
    [candidates, selectedCandidateId]
  );
  const readiness = getReadiness(selectedCandidate);
  const selectedCandidateName = selectedCandidate?.nome_urna ?? "Selecionado";
  const isChannelGovernance = governanceResource === "canal";
  const isTimelineGovernance = governanceResource === "agenda" || governanceResource === "evento";

  return (
    <main className="page-shell">
      {feedback?.feedback && feedback?.mensagem ? (
        <section className={`feedback-banner ${feedback.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{feedback.feedback === "sucesso" ? "Workflow iniciado." : "Falha ao iniciar workflow."}</strong>
          <div style={{ marginTop: 6 }}>{feedback.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Governança de workflows</span>
        <h1 className="title">Central de workflows do n8n</h1>
        <p className="subtitle">
          Todos os workflows estratégicos da automação podem ser iniciados a partir desta plataforma,
          com trilha administrativa, ordenação operacional e contexto de campanha.
        </p>
        <div className="hero-meta">
          <span className="pill">{isAdmin ? "Administrador autenticado" : "Acesso restrito"}</span>
          <span className="pill">Origem única da governança</span>
          <span className="pill">{candidates.length} candidato(s) disponível(is) na base</span>
        </div>
        <div className="workflow-guidance">
          <div className="workflow-guidance-card">
            <strong>Operação em lote</strong>
            <span>
              Use o fluxo 1 para sincronizar toda a planilha. Ele verifica todos os candidatos
              atualizados externamente e evita duplicidade por identificador.
            </span>
          </div>
          <div className="workflow-guidance-card">
            <strong>Operação por candidato</strong>
            <span>
              Depois da sincronização, selecione um candidato já refletido na base e siga a
              implantação. Os fluxos dependentes só podem ser executados quando os requisitos
              mínimos do ambiente estiverem disponíveis.
            </span>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <a className="button secondary" href="/estatisticas/governanca">
            Voltar para governança
          </a>
        </div>
      </section>

      <section className="card workflow-candidate-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Candidato selecionado para operação</h2>
            <p className="subtitle">
              A seleção usa apenas os candidatos que já estão gravados na base da plataforma.
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
              <span className="metric-label">Status de implantação</span>
              <strong>{selectedCandidate?.status_implantacao ?? "Não iniciado"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">Instância da Evolution</span>
              <strong>{selectedCandidate?.instancia_evolution ?? "Pendente"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">Número oficial</span>
              <strong>{selectedCandidate?.numero_agente_oficial ?? "Pendente"}</strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">QR de conexão</span>
              <strong>
                {selectedCandidate?.pairing_qr_code_url ? "Pareamento disponível" : "Pendente"}
              </strong>
            </div>
            <div className="workflow-status-card">
              <span className="metric-label">Conexão Evolution</span>
              <strong>{selectedCandidate?.evolution_connection_status ?? "Não iniciada"}</strong>
            </div>
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
          {BATCH_WORKFLOWS.map(({ workflow, ordem, title, description, buttonLabel }) => (
            <article className="card analytics-panel workflow-flow-card" key={workflow}>
              <div className="workflow-card-head">
                <span className="workflow-order">Etapa {ordem}</span>
                <h3 className="section-title workflow-card-title">{title}</h3>
              </div>
              <p className="subtitle">{description}</p>
              <form action={triggerAction} className="manager-auth-form workflow-flow-form">
                <input name="workflow" type="hidden" value={workflow} />
                <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
                <div className="step-panel-callout">
                  Este fluxo não depende de um candidato específico. Ele percorre toda a planilha externa
                  e atualiza somente os registros novos ou alterados desde a última execução.
                </div>
                <div className="workflow-card-footer">
                  <button className="button workflow-action-button" type="submit">
                    {buttonLabel}
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
            {`Fluxos do candidato ${selectedCandidateName}`}
          </h2>
        </div>
        <div className="grid grid-2">
          {CANDIDATE_WORKFLOWS.map(({ workflow, ordem, title, description, buttonLabel }) => {
            const disabled =
              (workflow === "qrcode_canais" && !readiness.canRunQrcode) ||
              (workflow === "governanca" && !readiness.canRunGovernance) ||
              (workflow === "entrada_eleitor" && !readiness.canRunInbound) ||
              (workflow === "cadencia" && !readiness.canRunCadence);

            return (
              <article className="card analytics-panel workflow-flow-card" key={workflow}>
                <div className="workflow-card-head">
                  <span className="workflow-order">Etapa {ordem}</span>
                  <h3 className="section-title workflow-card-title">{title}</h3>
                </div>
                <p className="subtitle">{description}</p>
                <form action={triggerAction} className="manager-auth-form workflow-flow-form">
                  <input name="workflow" type="hidden" value={workflow} />
                  <input name="redirectTo" type="hidden" value="/estatisticas/governanca/workflows" />
                  <input name="idCandidato" type="hidden" value={selectedCandidateId} />

                  {workflow === "qrcode_canais" ? (
                    <div className="step-channel-panel">
                      <div className="step-panel-callout">
                        Gere aqui o QR de conexão do WhatsApp da campanha. Ele deve ser lido no
                        próprio WhatsApp do telefone oficial do candidato para associar a linha à
                        instância Evolution e ao webhook do funil.
                      </div>
                      {selectedCandidate?.pairing_qr_code_url ? (
                        <div className="workflow-qrcode-preview">
                          <img
                            alt={`QR de conexão do WhatsApp de ${selectedCandidateName}`}
                            className="workflow-qrcode-image"
                            src={selectedCandidate.pairing_qr_code_url}
                          />
                          <div className="workflow-qrcode-caption">
                            <strong>QR de conexão do WhatsApp</strong>
                            <span>
                              Leia este QR no WhatsApp da nova linha oficial para concluir o
                              pareamento da campanha.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="workflow-empty-state">
                          Gere o QR de conexão para visualizar aqui o pareamento da linha oficial
                          do candidato.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {workflow === "governanca" ? (
                    <>
                      <div className="step-panel-callout">
                        Escolha primeiro o tipo de registro. A interface monta apenas os campos
                        necessários para reduzir erro operacional e evitar gravações desnecessárias.
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
                          <option value="">Selecione o tipo...</option>
                          <option value="agenda">Agenda</option>
                          <option value="evento">Evento ou reunião</option>
                          <option value="canal">Canal</option>
                        </select>
                      </label>

                      {!governanceResource ? (
                        <div className="workflow-empty-state">
                          Escolha um tipo de registro para montar o formulário correspondente.
                        </div>
                      ) : (
                        <>
                          <label className="step-note">
                            <span>Nome ou título</span>
                            <input
                              className="step-input"
                              defaultValue={isChannelGovernance ? "Canal de campanha" : "Agenda de campanha"}
                              name="governanceNome"
                              type="text"
                            />
                          </label>
                          <label className="step-note">
                            <span>Descrição</span>
                            <textarea
                              className="step-textarea"
                              defaultValue={
                                isChannelGovernance
                                  ? "Canal registrado pela plataforma para uso operacional da campanha."
                                  : "Evento gerado pela plataforma para organização da agenda de campanha."
                              }
                              name="governanceDescricao"
                              rows={3}
                            />
                          </label>

                          {isChannelGovernance ? (
                            <>
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
                              <div className="step-form-grid">
                                <label className="step-note">
                                  <span>Tipo complementar</span>
                                  <input
                                    className="step-input"
                                    defaultValue="whatsapp"
                                    name="governanceTipo"
                                    placeholder="Exemplo: whatsapp, instagram, telegram"
                                    type="text"
                                  />
                                </label>
                                <label className="step-note">
                                  <span>Status</span>
                                  <input
                                    className="step-input"
                                    defaultValue="ativo"
                                    name="governanceStatus"
                                    placeholder="Exemplo: ativo, pausado"
                                    type="text"
                                  />
                                </label>
                              </div>
                            </>
                          ) : null}

                          {isTimelineGovernance ? (
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
                                  <input className="step-input" defaultValue="DF" name="governanceUf" type="text" />
                                </label>
                              </div>
                              <div className="step-form-grid">
                                <label className="step-note">
                                  <span>Tipo complementar</span>
                                  <input
                                    className="step-input"
                                    defaultValue="reuniao"
                                    name="governanceTipo"
                                    placeholder="Exemplo: reuniao, evento, live"
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
                              <label className="step-note">
                                <span>Canal de confirmação</span>
                                <input
                                  className="step-input"
                                  defaultValue="Link público gerado automaticamente pela plataforma"
                                  name="governanceCanalConfirmacao"
                                  readOnly
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
                            <span>Referência</span>
                            <span className="step-field-hint">
                              Use apenas quando estiver atualizando um registro já existente. Se este
                              for um item novo, deixe em branco.
                            </span>
                            <input
                              className="step-input"
                              name="referenciaId"
                              placeholder="Exemplo: UUID de um item já cadastrado"
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
                      )}
                    </>
                  ) : null}

                  {workflow === "entrada_eleitor" || workflow === "cadencia" ? (
                    <>
                      {workflow === "cadencia" ? (
                        <div className="step-panel-callout">
                          A cadência deve ser acionada depois que já existir eleitor registrado na base
                          do candidato, seja por importação ou por entrada no funil.
                        </div>
                      ) : null}
                      <label className="step-note">
                        <span>Telefone</span>
                        <input
                          className="step-input"
                          defaultValue={selectedCandidate?.numero_agente_oficial ?? ""}
                          name="telefone"
                          placeholder="Use o número oficial do candidato."
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
                        ? "Este fluxo exige que o candidato já tenha registro mínimo de implantação no ambiente."
                        : "Este fluxo exige que o candidato já tenha número oficial registrado na implantação."}
                    </div>
                  ) : null}

                  <div className="workflow-card-footer">
                    <button className="button workflow-action-button" disabled={disabled} type="submit">
                      {buttonLabel}
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
