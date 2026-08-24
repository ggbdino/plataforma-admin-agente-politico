import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PasswordInput } from "@/components/password-input";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { registerEventAttendanceByPhoneAction } from "@/lib/actions/event-attendance-action";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { buildPublicEventUrl } from "@/lib/public-events";
import {
  findCampaignElectorByPhone,
  getCampaignEventAttendanceContext
} from "@/lib/repositories/event-attendance";

export const dynamic = "force-dynamic";

type CampaignEventAttendancePageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    evento?: string;
    telefone?: string;
    nome?: string;
  }>;
};

type AttendanceWindowState = {
  isOpen: boolean;
  label: string;
  message: string;
};

export default async function CampaignEventAttendancePage({
  params,
  searchParams
}: CampaignEventAttendancePageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const canOperateEvents = await hasCampaignAccess(session, idCandidato, "pode_operar_eventos");
  const canImplant = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const hasAccess = canOperateEvents || canImplant;
  const data = await getCampaignEventAttendanceContext(idCandidato);

  if (!data) {
    notFound();
  }

  const selectedEventId = query?.evento || data.eventos[0]?.id || "";
  const selectedEvent = data.eventos.find((event) => event.id === selectedEventId) ?? data.eventos[0] ?? null;
  const selectedEventPublicUrl = selectedEvent?.link_confirmacao
    ? buildPublicEventUrl(selectedEvent.link_confirmacao)
    : null;
  const typedPhone = String(query?.telefone ?? "").trim();
  const justRegisteredAttendance = query?.feedback === "sucesso";
  const electorLookup =
    hasAccess && typedPhone ? await findCampaignElectorByPhone(idCandidato, typedPhone) : null;
  const needsElectorCompletion = Boolean(
    electorLookup && (!normalizeText(electorLookup.nome) || !normalizeText(electorLookup.cidade))
  );
  const windowState = selectedEvent ? getAttendanceWindowState(selectedEvent.data_evento) : null;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Controle de eventos</span>
        <h1 className="title">Presença e autoatendimento da campanha {data.nome_urna}</h1>
        <p className="subtitle">
          Tela operacional dedicada ao evento atual, com entrada por telefone para a equipe e modo
          separado de autoatendimento com QR Code e número oficial da campanha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para a área da gestora
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso ao controle de eventos</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuário com permissão para operar eventos ou implantar a
            campanha deste candidato.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/gestor/candidato/${idCandidato}/eventos`} />
            <input name="contexto" type="hidden" value="gestora" />
            <label className="step-note">
              <span>E-mail do usuário</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuário</span>
              <PasswordInput name="senha" />
            </label>
            <button className="button" type="submit">
              Entrar no controle de eventos
            </button>
          </form>
        </section>
      ) : (
        <section className="card event-attendance-hero-panel">
          <div className="event-attendance-hero-grid">
            <div className="event-attendance-operator">
              <div className="event-attendance-combo">
                <div>
                  <span className="metric-label">Evento em operação</span>
                  <h2 className="section-title" style={{ marginTop: 6 }}>
                    {selectedEvent ? selectedEvent.nome_evento : "Nenhum evento disponível"}
                  </h2>
                  <p className="subtitle" style={{ maxWidth: "none" }}>
                    {selectedEvent
                      ? `${formatDateTime(selectedEvent.data_evento)} • ${selectedEvent.local_nome ?? selectedEvent.cidade ?? "Local a definir"}`
                      : "Cadastre um evento para habilitar o controle de presença."}
                  </p>
                </div>
                <form className="event-attendance-event-form" method="get">
                  <label className="step-note" style={{ marginBottom: 0 }}>
                    <span>Selecionar evento</span>
                    <select className="step-input" defaultValue={selectedEventId} name="evento">
                      {data.eventos.length === 0 ? (
                        <option value="">Nenhum evento disponível</option>
                      ) : (
                        data.eventos.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.nome_evento} • {formatDateTime(event.data_evento)}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <button className="button secondary" disabled={data.eventos.length === 0} type="submit">
                    Fixar evento
                  </button>
                </form>
                {selectedEvent ? (
                  <div className="actions">
                    <Link
                      className="button secondary"
                      href={selectedEventPublicUrl ?? "#"}
                      target="_blank"
                    >
                      Abrir página de confirmação
                    </Link>
                    <Link
                      className="button secondary"
                      href={`/gestor/candidato/${idCandidato}/eventos/telao?evento=${encodeURIComponent(selectedEvent.id)}`}
                      target="_blank"
                    >
                      Abrir modo telão
                    </Link>
                  </div>
                ) : null}
              </div>

              {windowState ? (
                <div className={`event-window-banner ${windowState.isOpen ? "ok" : "warn"}`}>
                  <strong>{windowState.label}</strong>
                  <span>{windowState.message}</span>
                </div>
              ) : null}

              <div className="event-attendance-summary-grid">
                <div className="regional-card-metric">
                  <span>Presentes</span>
                  <strong>{selectedEvent?.total_presentes ?? 0}</strong>
                </div>
                <div className="regional-card-metric">
                  <span>Confirmados</span>
                  <strong>{selectedEvent?.total_confirmados ?? 0}</strong>
                </div>
                <div className="regional-card-metric">
                  <span>Praça</span>
                  <strong style={{ fontSize: "1rem" }}>
                    {[selectedEvent?.cidade, selectedEvent?.uf].filter(Boolean).join(" / ") || "-"}
                  </strong>
                </div>
                <div className="regional-card-metric">
                  <span>Status</span>
                  <strong style={{ fontSize: "1rem" }}>{selectedEvent?.status ?? "-"}</strong>
                </div>
              </div>

              <section
                className="event-attendance-flow"
                id="entrada-telefone"
                style={{ scrollMarginTop: 120 }}
              >
                <h2 className="section-title">Entrada por telefone</h2>
                <p className="event-attendance-instruction">Solicite o telefone para registrar a presença.</p>

                {query?.feedback && query?.mensagem ? (
                  <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
                    <strong>{query.feedback === "sucesso" ? "Registro confirmado." : "Falha operacional."}</strong>
                    <div style={{ marginTop: 6 }}>{query.mensagem}</div>
                    {query.telefone ? (
                      <div style={{ marginTop: 8 }}>
                        <strong>{query.nome ?? "Participante"}</strong>
                        <span className="mono"> • {query.telefone}</span>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <form action={registerEventAttendanceByPhoneAction} className="event-attendance-phone-form">
                  <input name="idCandidato" type="hidden" value={idCandidato} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={`/gestor/candidato/${idCandidato}/eventos?evento=${encodeURIComponent(selectedEventId)}#entrada-telefone`}
                  />
                  <input name="eventoId" type="hidden" value={selectedEventId} />
                  <label className="step-note" style={{ marginBottom: 0 }}>
                    <span>Telefone do participante</span>
                    <input
                      className="step-input event-attendance-phone-input"
                      defaultValue={justRegisteredAttendance ? "" : typedPhone}
                      name="telefone"
                      placeholder="61999998888"
                      type="text"
                    />
                  </label>
                  <button className="button" disabled={!selectedEvent} type="submit">
                    Validar telefone
                  </button>
                </form>

                {typedPhone && !justRegisteredAttendance ? (
                  electorLookup ? (
                    <article className="card event-attendance-result-card">
                      <span className="pill ok">Telefone encontrado na base</span>
                      <strong className="metric-title">{electorLookup.nome ?? "Participante sem nome"}</strong>
                      <div className="muted">
                        {[electorLookup.cidade, electorLookup.uf].filter(Boolean).join(" / ") ||
                          "Cidade não informada"}
                      </div>
                      {needsElectorCompletion ? (
                        <>
                          <div className="step-panel-callout">
                            Antes de registrar a presença, complete os dados básicos para melhorar a qualidade
                            do cadastro.
                          </div>
                          <form action={registerEventAttendanceByPhoneAction} className="manager-auth-form">
                            <input name="idCandidato" type="hidden" value={idCandidato} />
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={`/gestor/candidato/${idCandidato}/eventos?evento=${encodeURIComponent(selectedEventId)}#entrada-telefone`}
                            />
                            <input name="eventoId" type="hidden" value={selectedEventId} />
                            <input name="telefone" type="hidden" value={electorLookup.telefone} />
                            <label className="step-note">
                              <span>Nome</span>
                              <input
                                className="step-input"
                                defaultValue={electorLookup.nome ?? ""}
                                name="nome"
                                placeholder="Nome do participante"
                                type="text"
                              />
                            </label>
                            <label className="step-note">
                              <span>Cidade</span>
                              <input
                                className="step-input"
                                defaultValue={electorLookup.cidade ?? ""}
                                name="cidade"
                                placeholder="Cidade do participante"
                                type="text"
                              />
                            </label>
                            <button className="button" type="submit">
                              Atualizar cadastro e registrar presença
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="step-panel-callout">
                          Cadastro completo localizado. Ao validar o telefone, a presença é registrada
                          automaticamente para <strong>{electorLookup.nome ?? "este participante"}</strong>.
                        </div>
                      )}
                    </article>
                  ) : (
                    <article className="card event-attendance-result-card">
                      <span className="pill warn">Telefone ainda não cadastrado</span>
                      <strong className="metric-title">Novo usuário</strong>
                      <div className="step-panel-callout">
                        Complete nome e cidade para criar o cadastro e registrar a presença no evento.
                      </div>
                      <form action={registerEventAttendanceByPhoneAction} className="manager-auth-form">
                        <input name="idCandidato" type="hidden" value={idCandidato} />
                        <input
                          name="redirectTo"
                          type="hidden"
                          value={`/gestor/candidato/${idCandidato}/eventos?evento=${encodeURIComponent(selectedEventId)}#entrada-telefone`}
                        />
                        <input name="eventoId" type="hidden" value={selectedEventId} />
                        <input name="telefone" type="hidden" value={typedPhone} />
                        <label className="step-note">
                          <span>Nome</span>
                          <input className="step-input" name="nome" placeholder="Nome do participante" type="text" />
                        </label>
                        <label className="step-note">
                          <span>Cidade</span>
                          <input className="step-input" name="cidade" placeholder="Cidade do participante" type="text" />
                        </label>
                        <button className="button" type="submit">
                          Cadastrar novo usuário e registrar presença
                        </button>
                      </form>
                    </article>
                  )
                ) : (
                  <article className="card event-attendance-result-card event-attendance-idle-card">
                    <span className="pill">Fluxo rápido</span>
                    <strong className="metric-title">Atendimento focado no telefone</strong>
                    <div className="muted">
                      Com o evento fixado, o atendente só precisa validar o telefone. Se o contato existir e
                      estiver completo, a presença é confirmada no ato.
                    </div>
                  </article>
                )}

                <article className="card event-attendance-result-card">
                  <span className="metric-label">Presentes no evento atual</span>
                  <strong className="metric-value">{selectedEvent?.total_presentes ?? 0}</strong>
                  <div className="muted">Total de presenças computadas até este momento no evento selecionado.</div>
                </article>
              </section>
            </div>

            <aside className="event-attendance-self-service">
              <div className="event-attendance-self-service-card">
                <span className="pill ok">Autoatendimento</span>
                <h2 className="section-title">Confirme sua presença no evento</h2>
                {data.qr_code_url ? (
                  <Image
                    alt={`QR Code oficial de ${data.nome_urna}`}
                    className="qr-image"
                    height={260}
                    src={data.qr_code_url}
                    unoptimized
                    width={260}
                  />
                ) : (
                  <div className="step-panel-callout">QR Code oficial ainda não disponível para esta campanha.</div>
                )}
                <div className="event-attendance-number-highlight">
                  <span>Número oficial</span>
                  <strong>{data.numero_agente_oficial ?? "pendente"}</strong>
                </div>
                <div className="event-attendance-self-service-copy">
                  Aponte a câmera do celular para o QR Code ou registre o telefone no WhatsApp para
                  confirmar a presença.
                </div>
                {selectedEvent ? (
                  <Link
                    className="button secondary"
                    href={selectedEventPublicUrl ?? "#"}
                    target="_blank"
                  >
                    Abrir página de confirmação
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </section>
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

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function getAttendanceWindowState(eventDate: string): AttendanceWindowState {
  const eventTime = new Date(eventDate).getTime();
  const now = Date.now();
  const fourHoursInMs = 4 * 60 * 60 * 1000;
  const endTime = eventTime + fourHoursInMs;

  if (now >= eventTime && now <= endTime) {
    return {
      isOpen: true,
      label: "Janela de presença aberta",
      message: `As presenças serão computadas normalmente até ${formatDateTime(new Date(endTime).toISOString())}.`
    };
  }

  if (now < eventTime) {
    return {
      isOpen: false,
      label: "Evento ainda não iniciado",
      message: "Cadastros realizados agora não serão computados como presença até o início oficial do evento."
    };
  }

  return {
    isOpen: false,
    label: "Fora da janela de presença",
    message: "Cadastros realizados agora não serão computados como presença, apenas como atualização ou inclusão na base."
  };
}
