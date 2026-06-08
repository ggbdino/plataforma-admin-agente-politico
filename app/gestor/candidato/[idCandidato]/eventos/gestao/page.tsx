import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import {
  createCampaignEventAction,
  deleteCampaignEventAction
} from "@/lib/actions/event-management-action";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignEventManagementContext } from "@/lib/repositories/event-attendance";
import type { CampaignEventParticipantStatusFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

type CampaignEventManagementPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    evento?: string;
    status?: string;
    confirmarExclusao?: string;
  }>;
};

export default async function CampaignEventManagementPage({
  params,
  searchParams
}: CampaignEventManagementPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const participantStatusFilter = normalizeParticipantStatusFilter(query?.status);
  const session = await getCurrentPlatformSession();
  const canOperateEvents = await hasCampaignAccess(session, idCandidato, "pode_operar_eventos");
  const canImplant = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const hasAccess = canOperateEvents || canImplant;
  const data = await getCampaignEventManagementContext(
    idCandidato,
    query?.evento,
    participantStatusFilter
  );

  if (!data) {
    notFound();
  }

  const selectedEvent = data.eventoSelecionado;
  const publicLink = selectedEvent?.link_confirmacao ?? null;
  const deletableSelectedEvent =
    selectedEvent && new Date(selectedEvent.data_evento).getTime() > Date.now() ? selectedEvent : null;
  const isDeleteConfirmationOpen = deletableSelectedEvent
    ? query?.confirmarExclusao === deletableSelectedEvent.id
    : false;

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>
            {query.feedback === "sucesso"
              ? "Operação concluída."
              : "Não foi possível concluir a operação."}
          </strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Gestão de eventos</span>
        <h1 className="title">Eventos, confirmações e participantes da campanha</h1>
        <p className="subtitle">
          Cadastre eventos, acompanhe confirmados e presentes, copie o link público de divulgação e
          acesse rapidamente a operação de presença e o modo telão.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para a área da gestora
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos`}>
            Abrir controle de presença
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso à gestão de eventos</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuário com permissão para operar eventos ou implantar a campanha.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input
              name="redirectTo"
              type="hidden"
              value={`/gestor/candidato/${idCandidato}/eventos/gestao`}
            />
            <input name="contexto" type="hidden" value="gestora" />
            <label className="step-note">
              <span>E-mail do usuário</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuário</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar na gestão de eventos
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid grid-2" style={{ marginBottom: 20 }}>
            <article className="card manager-info-card">
              <h2 className="section-title">Cadastro de novo evento</h2>
              <p className="subtitle">
                Esta área é da gestora da campanha e centraliza a criação do evento e a futura divulgação do link público.
              </p>
              <form action={createCampaignEventAction} className="manager-auth-form">
                <input name="idCandidato" type="hidden" value={idCandidato} />
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/gestor/candidato/${idCandidato}/eventos/gestao`}
                />
                <div className="step-form-grid">
                  <label className="step-note">
                    <span>Nome do evento</span>
                    <input className="step-input" name="nomeEvento" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Data e horário</span>
                    <input className="step-input" name="dataEvento" type="datetime-local" />
                  </label>
                  <label className="step-note">
                    <span>Tipo</span>
                    <select className="step-input" defaultValue="reuniao" name="tipoEvento">
                      <option value="reuniao">Reunião</option>
                      <option value="evento_presencial">Evento presencial</option>
                      <option value="palestra">Palestra</option>
                      <option value="caminhada">Caminhada</option>
                      <option value="comicio">Comício</option>
                    </select>
                  </label>
                  <label className="step-note">
                    <span>Status</span>
                    <select className="step-input" defaultValue="ativo" name="status">
                      <option value="ativo">Ativo</option>
                      <option value="planejado">Planejado</option>
                      <option value="encerrado">Encerrado</option>
                    </select>
                  </label>
                  <label className="step-note">
                    <span>Local</span>
                    <input className="step-input" name="localNome" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Endereço</span>
                    <input className="step-input" name="endereco" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Cidade</span>
                    <input className="step-input" name="cidade" type="text" />
                  </label>
                  <label className="step-note">
                    <span>UF</span>
                    <input className="step-input" maxLength={2} name="uf" type="text" />
                  </label>
                  <label className="step-note">
                    <span>Capacidade estimada</span>
                    <input className="step-input" min={0} name="capacidadeEstimada" type="number" />
                  </label>
                </div>
                <label className="step-note">
                  <span>Descrição</span>
                  <textarea className="step-textarea" name="descricao" rows={3} />
                </label>
                <button className="button" type="submit">
                  Cadastrar evento
                </button>
              </form>
            </article>

            <article className="card manager-info-card">
              <h2 className="section-title">Evento selecionado para gestão</h2>
              {selectedEvent ? (
                <>
                  <div className="regional-card-grid" style={{ marginTop: 12 }}>
                    <div className="regional-card-metric">
                      <span>Confirmados</span>
                      <strong>{selectedEvent.total_confirmados}</strong>
                    </div>
                    <div className="regional-card-metric">
                      <span>Presentes</span>
                      <strong>{selectedEvent.total_presentes}</strong>
                    </div>
                    <div className="regional-card-metric">
                      <span>Praça</span>
                      <strong style={{ fontSize: "1rem" }}>
                        {[selectedEvent.cidade, selectedEvent.uf].filter(Boolean).join(" / ") || "-"}
                      </strong>
                    </div>
                    <div className="regional-card-metric">
                      <span>Status</span>
                      <strong style={{ fontSize: "1rem" }}>{selectedEvent.status}</strong>
                    </div>
                  </div>
                  <div className="key-value" style={{ marginTop: 16 }}>
                    <div>
                      <strong>Evento</strong>
                      <div>{selectedEvent.nome_evento}</div>
                    </div>
                    <div>
                      <strong>Data</strong>
                      <div>{formatDateTime(selectedEvent.data_evento)}</div>
                    </div>
                    <div>
                      <strong>Local</strong>
                      <div>{selectedEvent.local_nome ?? selectedEvent.endereco ?? "-"}</div>
                    </div>
                    <div>
                      <strong>Link público</strong>
                      <div className="mono mono-wrap">
                        {publicLink ?? "-"}
                      </div>
                    </div>
                  </div>
                  {publicLink ? (
                    <div className="actions" style={{ marginTop: 12 }}>
                      <CopyLinkButton value={publicLink} />
                    </div>
                  ) : null}
                  <div className="actions" style={{ marginTop: 16 }}>
                    <Link
                      className="button secondary"
                      href={`/gestor/candidato/${idCandidato}/eventos?evento=${selectedEvent.id}`}
                    >
                      Operar presença
                    </Link>
                    <Link
                      className="button secondary"
                      href={`/gestor/candidato/${idCandidato}/eventos/telao?evento=${selectedEvent.id}`}
                      target="_blank"
                    >
                      Abrir modo telão
                    </Link>
                    <Link className="button secondary" href={publicLink ?? "#"} target="_blank">
                      Abrir link de divulgação
                    </Link>
                  </div>
                  {deletableSelectedEvent ? (
                    isDeleteConfirmationOpen ? (
                      <section className="feedback-banner error" style={{ marginTop: 16 }}>
                        <strong>Confirmar exclusÃ£o do evento</strong>
                        <div style={{ marginTop: 6 }}>
                          VocÃª estÃ¡ prestes a excluir <strong>{deletableSelectedEvent.nome_evento}</strong>. Esta aÃ§Ã£o
                          tambÃ©m remove confirmados e presentes vinculados ao evento.
                        </div>
                        <div className="actions" style={{ marginTop: 12 }}>
                          <form action={deleteCampaignEventAction}>
                            <input name="idCandidato" type="hidden" value={idCandidato} />
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={`/gestor/candidato/${idCandidato}/eventos/gestao`}
                            />
                            <input name="eventoId" type="hidden" value={deletableSelectedEvent.id} />
                            <input name="nomeEvento" type="hidden" value={deletableSelectedEvent.nome_evento} />
                            <input name="confirmouExclusao" type="hidden" value="sim" />
                            <button className="button" type="submit">
                              Confirmar exclusÃ£o definitiva
                            </button>
                          </form>
                          <Link
                            className="button secondary"
                            href={`/gestor/candidato/${idCandidato}/eventos/gestao?evento=${deletableSelectedEvent.id}&status=${data.filtroParticipantes}`}
                          >
                            Cancelar
                          </Link>
                        </div>
                      </section>
                    ) : (
                      <div className="actions" style={{ marginTop: 12 }}>
                        <Link
                          className="button secondary"
                          href={`/gestor/candidato/${idCandidato}/eventos/gestao?evento=${deletableSelectedEvent.id}&status=${data.filtroParticipantes}&confirmarExclusao=${deletableSelectedEvent.id}`}
                        >
                          Excluir evento
                        </Link>
                      </div>
                    )
                  ) : null}
                </>
              ) : (
                <div className="step-panel-callout">
                  Cadastre o primeiro evento para liberar o painel gerencial e o link público.
                </div>
              )}
            </article>
          </section>

          <section className="grid grid-2" style={{ alignItems: "start" }}>
            <article className="card">
              <div className="regional-card-head">
                <div>
                  <h2 className="section-title" style={{ marginBottom: 6 }}>
                    Eventos cadastrados
                  </h2>
                  <p className="subtitle">
                    Selecione um evento para ver participantes, métricas e o link público de confirmação.
                  </p>
                </div>
                <span className="pill">{data.eventos.length} evento(s)</span>
              </div>
              <div className="grid" style={{ marginTop: 16 }}>
                {data.eventos.map((event) => (
                  <article className="regional-card" key={event.id}>
                    <div className="regional-card-head">
                      <div>
                        <div className="metric-label">{event.tipo_evento ?? "evento"}</div>
                        <div className="regional-card-title">{event.nome_evento}</div>
                        <div className="muted">
                          {formatDateTime(event.data_evento)} • {event.local_nome ?? event.cidade ?? "Local a definir"}
                        </div>
                      </div>
                      <span
                        className={`status-pill ${String(event.status).replace(/\s+/g, "_").toLowerCase()}`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <div className="regional-card-grid">
                      <div className="regional-card-metric">
                        <span>Confirmados</span>
                        <strong>{event.total_confirmados}</strong>
                      </div>
                      <div className="regional-card-metric">
                        <span>Presentes</span>
                        <strong>{event.total_presentes}</strong>
                      </div>
                    </div>
                    <div className="actions">
                      <Link
                        className="button secondary"
                        href={`/gestor/candidato/${idCandidato}/eventos/gestao?evento=${event.id}&status=${data.filtroParticipantes}`}
                      >
                        Ver participantes
                      </Link>
                      <Link
                        className="button secondary"
                        href={event.link_confirmacao ?? "#"}
                        target="_blank"
                      >
                        Link do evento
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="card">
              <div className="regional-card-head">
                <div>
                  <h2 className="section-title">Participantes do evento selecionado</h2>
                  <p className="subtitle">
                    Lista operacional de confirmados e presentes já captados no evento.
                  </p>
                </div>
                {selectedEvent ? (
                  <form method="get" style={{ minWidth: 220 }}>
                    <input name="evento" type="hidden" value={selectedEvent.id} />
                    <label className="step-note" style={{ gap: 6 }}>
                      <span>Filtrar participantes</span>
                      <select className="step-input" defaultValue={data.filtroParticipantes} name="status">
                        <option value="todos">Todos</option>
                        <option value="confirmados">Confirmados</option>
                        <option value="presentes">Presentes</option>
                      </select>
                    </label>
                    <button className="button secondary" style={{ marginTop: 10 }} type="submit">
                      Aplicar filtro
                    </button>
                  </form>
                ) : null}
              </div>
              {selectedEvent ? (
                data.participantesEventoSelecionado.length > 0 ? (
                  <div className="table-responsive" style={{ marginTop: 16 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Telefone</th>
                          <th>Cidade</th>
                          <th>Status</th>
                          <th>Origem</th>
                          <th>Registro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.participantesEventoSelecionado.map((participant) => (
                          <tr key={`${participant.eleitor_uid}-${participant.registrado_em ?? "sem_data"}`}>
                            <td>{participant.nome ?? "Sem nome"}</td>
                            <td className="mono">{participant.telefone ?? "-"}</td>
                            <td>{[participant.cidade, participant.uf].filter(Boolean).join(" / ") || "-"}</td>
                            <td>{participant.status_participacao}</td>
                            <td>{participant.origem_registro ?? participant.canal_registro ?? "-"}</td>
                            <td>{participant.registrado_em ? formatDateTime(participant.registrado_em) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="step-panel-callout" style={{ marginTop: 16 }}>
                    Não há participantes para o filtro selecionado neste evento.
                  </div>
                )
              ) : (
                <div className="step-panel-callout" style={{ marginTop: 16 }}>
                  Selecione um evento para ver a base de confirmados e presentes.
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeParticipantStatusFilter(value?: string): CampaignEventParticipantStatusFilter {
  if (value === "confirmados" || value === "presentes") {
    return value;
  }

  return "todos";
}
