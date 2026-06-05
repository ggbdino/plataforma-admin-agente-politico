import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { registerEventAttendanceByPhoneAction } from "@/lib/actions/event-attendance-action";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
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
  const typedPhone = String(query?.telefone ?? "").trim();
  const electorLookup =
    hasAccess && typedPhone ? await findCampaignElectorByPhone(idCandidato, typedPhone) : null;
  const needsElectorCompletion = Boolean(
    electorLookup && (!normalizeText(electorLookup.nome) || !normalizeText(electorLookup.cidade))
  );

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="pill">Controle de eventos</span>
        <h1 className="title">Presenca e autoatendimento da campanha {data.nome_urna}</h1>
        <p className="subtitle">
          Tela operacional dedicada ao evento atual, com entrada por telefone para a equipe e um modo separado
          de autoatendimento para QR Code e numero oficial da campanha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para area da gestora
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso ao controle de eventos</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuario com permissao para operar eventos ou implantar a
            campanha deste candidato.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/gestor/candidato/${idCandidato}/eventos`} />
            <input name="contexto" type="hidden" value="gestora" />
            <label className="step-note">
              <span>E-mail do usuario</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuario</span>
              <input className="step-input" name="senha" type="password" />
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
                  <span className="metric-label">Evento em operacao</span>
                  <h2 className="section-title" style={{ marginTop: 6 }}>
                    {selectedEvent ? selectedEvent.nome_evento : "Nenhum evento disponivel"}
                  </h2>
                  <p className="subtitle" style={{ maxWidth: "none" }}>
                    {selectedEvent
                      ? `${formatDateTime(selectedEvent.data_evento)} • ${selectedEvent.local_nome ?? selectedEvent.cidade ?? "local a definir"}`
                      : "Cadastre um evento para habilitar o controle de presenca."}
                  </p>
                </div>
                <form className="event-attendance-event-form" method="get">
                  <label className="step-note" style={{ marginBottom: 0 }}>
                    <span>Selecionar evento</span>
                    <select className="step-input" defaultValue={selectedEventId} name="evento">
                      {data.eventos.length === 0 ? (
                        <option value="">Nenhum evento disponivel</option>
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
              </div>

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
                  <span>Praca</span>
                  <strong style={{ fontSize: "1rem" }}>
                    {[selectedEvent?.cidade, selectedEvent?.uf].filter(Boolean).join(" / ") || "-"}
                  </strong>
                </div>
                <div className="regional-card-metric">
                  <span>Status</span>
                  <strong style={{ fontSize: "1rem" }}>{selectedEvent?.status ?? "-"}</strong>
                </div>
              </div>

              <div className="event-attendance-flow">
                <div id="entrada-telefone" />
                <h2 className="section-title">Entrada por telefone</h2>
                <p className="event-attendance-instruction">Solicite o telefone para registrar a presenca.</p>

                {query?.feedback && query?.mensagem ? (
                  <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
                    <strong>{query.feedback === "sucesso" ? "Registro confirmado." : "Falha operacional."}</strong>
                    <div style={{ marginTop: 6 }}>{query.mensagem}</div>
                    {query.feedback === "sucesso" ? (
                      <div style={{ marginTop: 8 }}>
                        <strong>{query.nome ?? "Participante"}</strong>
                        {query.telefone ? <span className="mono"> • {query.telefone}</span> : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <form className="event-attendance-phone-form" method="get">
                  <input name="evento" type="hidden" value={selectedEventId} />
                  <label className="step-note" style={{ marginBottom: 0 }}>
                    <span>Telefone do participante</span>
                    <input
                      className="step-input event-attendance-phone-input"
                      defaultValue={typedPhone}
                      name="telefone"
                      placeholder="61999998888"
                      type="text"
                    />
                  </label>
                  <button className="button" disabled={!selectedEvent} type="submit">
                    Validar telefone
                  </button>
                </form>

                {typedPhone ? (
                  electorLookup ? (
                    <article className="card event-attendance-result-card">
                      <span className="pill ok">Telefone encontrado na base</span>
                      <strong className="metric-title">{electorLookup.nome ?? "Participante sem nome"}</strong>
                      <div className="muted">
                        {[electorLookup.cidade, electorLookup.uf].filter(Boolean).join(" / ") || "Cidade nao informada"}
                      </div>
                      {needsElectorCompletion ? (
                        <>
                          <div className="step-panel-callout">
                            Antes de registrar a presenca, complete os dados basicos para melhorar a qualidade do cadastro.
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
                              Atualizar cadastro e registrar presenca
                            </button>
                          </form>
                        </>
                      ) : (
                        <>
                          <div className="step-panel-callout">
                            Ao confirmar abaixo, a presenca sera registrada para <strong>{electorLookup.nome ?? "este participante"}</strong>.
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
                            <input name="nome" type="hidden" value={electorLookup.nome ?? ""} />
                            <input name="cidade" type="hidden" value={electorLookup.cidade ?? ""} />
                            <button className="button" type="submit">
                              Registrar presenca de {electorLookup.nome ?? "participante"}
                            </button>
                          </form>
                        </>
                      )}
                    </article>
                  ) : (
                    <article className="card event-attendance-result-card">
                      <span className="pill warn">Telefone ainda nao cadastrado</span>
                      <strong className="metric-title">Novo usuario</strong>
                      <div className="step-panel-callout">
                        Complete nome e cidade para criar o cadastro e registrar a presenca no evento.
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
                          Cadastrar novo usuario e registrar presenca
                        </button>
                      </form>
                    </article>
                  )
                ) : (
                  <article className="card event-attendance-result-card event-attendance-idle-card">
                    <span className="pill">Fluxo rapido</span>
                    <strong className="metric-title">Atendimento focado no telefone</strong>
                    <div className="muted">
                      Com o evento fixado, o atendente so precisa validar o telefone. Se o contato existir, a presenca e confirmada no ato.
                    </div>
                  </article>
                )}

                <article className="card event-attendance-result-card">
                  <span className="metric-label">Presentes no evento atual</span>
                  <strong className="metric-value">{selectedEvent?.total_presentes ?? 0}</strong>
                  <div className="muted">Total de presencas computadas ate este momento no evento selecionado.</div>
                </article>
              </div>
            </div>

            <aside className="event-attendance-self-service">
              <div className="event-attendance-self-service-card">
                <span className="pill ok">Autoatendimento</span>
                <h2 className="section-title">Confirme sua presenca no evento</h2>
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
                  <div className="step-panel-callout">QR Code oficial ainda nao disponivel para esta campanha.</div>
                )}
                <div className="event-attendance-number-highlight">
                  <span>Numero oficial</span>
                  <strong>{data.numero_agente_oficial ?? "pendente"}</strong>
                </div>
                <div className="event-attendance-self-service-copy">
                  Aponte a camera do celular para o QR Code ou registre o telefone no WhatsApp para confirmar a presenca.
                </div>
                <Link
                  className="button secondary"
                  href={`/gestor/candidato/${idCandidato}/eventos/telao?evento=${encodeURIComponent(selectedEventId)}`}
                  target="_blank"
                >
                  Abrir modo telao
                </Link>
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
