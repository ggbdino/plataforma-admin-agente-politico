import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { registerEventAttendanceByPhoneAction } from "@/lib/actions/event-attendance-action";
import { getCampaignEventAttendanceContext } from "@/lib/repositories/event-attendance";

export const dynamic = "force-dynamic";

type CampaignEventAttendancePageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
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

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Falha operacional."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Controle de eventos</span>
        <h1 className="title">Entrada e presença da campanha {data.nome_urna}</h1>
        <p className="subtitle">
          Painel para validar presença por telefone na entrada do evento, criar contato mínimo quando
          necessário e estimular o início do relacionamento pelo QR Code oficial da campanha.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para área da gestora
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso ao controle de eventos</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuário com permissão para operar eventos ou implantar
            a campanha deste candidato.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input
              name="redirectTo"
              type="hidden"
              value={`/gestor/candidato/${idCandidato}/eventos`}
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
              Entrar no controle de eventos
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid grid-2" style={{ marginBottom: 20 }}>
            <article className="card manager-info-card">
              <h2 className="section-title">Registrar entrada pelo telefone</h2>
              <div className="step-panel-callout">
                Durante a janela do evento, qualquer pessoa registrada por aqui é considerada como
                presente. Para cadastros novos, telefone, nome e cidade são obrigatórios.
              </div>
              <form action={registerEventAttendanceByPhoneAction} className="manager-auth-form" style={{ marginTop: 16 }}>
                <input name="idCandidato" type="hidden" value={idCandidato} />
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/gestor/candidato/${idCandidato}/eventos`}
                />
                <label className="step-note">
                  <span>Evento da campanha</span>
                  <select className="step-input" defaultValue={data.eventos[0]?.id ?? ""} name="eventoId">
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
                <label className="step-note">
                  <span>Telefone do participante</span>
                  <input className="step-input" name="telefone" placeholder="61999998888" type="text" />
                </label>
                <label className="step-note">
                  <span>Nome do participante</span>
                  <input
                    className="step-input"
                    name="nome"
                    placeholder="Obrigatório para novo cadastro"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Cidade do participante</span>
                  <input
                    className="step-input"
                    name="cidade"
                    placeholder="Obrigatória para novo cadastro"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Observação do controle</span>
                  <textarea
                    className="step-textarea"
                    name="observacao"
                    placeholder="Ex.: entrada pelo credenciamento, convidado especial, apoio local."
                    rows={3}
                  />
                </label>
                <div className="actions">
                  <button className="button" disabled={data.eventos.length === 0} type="submit">
                    Registrar entrada
                  </button>
                </div>
              </form>
            </article>

            <article className="card manager-info-card">
              <h2 className="section-title">QR Code e canal oficial</h2>
              <div className="step-panel-callout">
                Deixe esta tela visível nos computadores do evento para facilitar a entrada espontânea
                do participante no canal oficial da campanha.
              </div>
              {data.qr_code_url ? (
                <div className="manager-qr-panel">
                  <strong>QR Code oficial da campanha</strong>
                  <Image
                    alt={`QR Code oficial de ${data.nome_urna}`}
                    className="qr-image"
                    height={220}
                    src={data.qr_code_url}
                    unoptimized
                    width={220}
                  />
                </div>
              ) : (
                <div className="step-panel-callout" style={{ marginTop: 16 }}>
                  QR Code oficial ainda não disponível para esta campanha.
                </div>
              )}
              <div className="step-panel-callout" style={{ marginTop: 18 }}>
                Número oficial da campanha: <span className="mono">{data.numero_agente_oficial ?? "pendente"}</span>
              </div>
              <ul className="manager-checklist">
                <li>Se o contato iniciar conversa durante a janela do evento, a campanha já pode qualificar esse eleitor.</li>
                <li>Cadastros feitos fora da janela não contam como presença, mas podem entrar na base para relacionamento.</li>
                <li>O telefone continua sendo a chave principal de validação do participante.</li>
              </ul>
            </article>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2 className="section-title">Eventos disponíveis para controle</h2>
                <p className="subtitle">
                  Resumo da agenda operacional com totais de presentes já computados na campanha.
                </p>
              </div>
              <span className="pill">{data.eventos.length} evento(s)</span>
            </div>
            {data.eventos.length === 0 ? (
              <div className="step-panel-callout">
                Ainda não há eventos cadastrados para esta campanha. Cadastre a agenda antes de iniciar o
                controle de presença.
              </div>
            ) : (
              <div className="grid grid-2">
                {data.eventos.map((event) => (
                  <article className="card metric-card" key={event.id} style={{ border: "1px solid var(--border-soft)" }}>
                    <span className="metric-label">{event.tipo_evento ?? "evento"}</span>
                    <strong className="metric-value" style={{ fontSize: "1.25rem" }}>
                      {event.nome_evento}
                    </strong>
                    <span className="muted">
                      {formatDateTime(event.data_evento)} • {event.local_nome ?? event.cidade ?? "local a definir"}
                    </span>
                    <div className="key-value" style={{ marginTop: 12 }}>
                      <div>
                        <strong>Status</strong>
                        <div>{event.status}</div>
                      </div>
                      <div>
                        <strong>Confirmados</strong>
                        <div>{event.total_confirmados}</div>
                      </div>
                      <div>
                        <strong>Presentes</strong>
                        <div>{event.total_presentes}</div>
                      </div>
                      <div>
                        <strong>Praça</strong>
                        <div>{[event.cidade, event.uf].filter(Boolean).join(" / ") || "-"}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
