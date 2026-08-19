import Image from "next/image";
import { notFound } from "next/navigation";
import { PublicExitButton } from "@/components/public-exit-button";
import { confirmEventAttendanceAction } from "@/lib/actions/event-confirmation-action";
import { isPublicEventConfirmationWindowOpen } from "@/lib/public-events";
import { getCampaignEventConfirmationContextByPublicLink } from "@/lib/repositories/event-attendance";

export const dynamic = "force-dynamic";

type PublicEventConfirmationPageProps = {
  params: Promise<{
    publicToken: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    telefone?: string;
    nome?: string;
    cidade?: string;
  }>;
};

export default async function PublicEventConfirmationPage({
  params,
  searchParams
}: PublicEventConfirmationPageProps) {
  const { publicToken } = await params;
  const query = searchParams ? await searchParams : undefined;
  const publicLink = `/e/${publicToken}`;
  const data = await getCampaignEventConfirmationContextByPublicLink(publicLink);

  if (!data || !data.evento) {
    notFound();
  }

  const isConfirmationOpen = isPublicEventConfirmationWindowOpen(data.evento.data_evento);
  const politicalIdentity = buildPoliticalIdentity({
    nomeUrna: data.nome_urna,
    partido: data.partido,
    cargoDisputado: data.cargo_disputado,
    eventDate: data.evento.data_evento
  });
  const partyAcronym = normalizePartyAcronym(data.partido);
  const partyLogoPath = resolvePartyLogoPath(data.partido);
  const hasSuccessfulConfirmation = query?.feedback === "sucesso";

  return (
    <main className="page-shell">
      <section className="hero-card event-confirmation-shell">
        <div className="event-confirmation-header event-confirmation-header-split">
          <div className="event-confirmation-header-copy">
            <div className="event-confirmation-header">
              <span className="pill ok">{politicalIdentity.badge}</span>
              <span className="pill">{data.partido ?? "Sem legenda informada"}</span>
            </div>
            <h1 className="title">{politicalIdentity.headline}</h1>
          </div>
          <div className="event-party-mark" aria-label={`Legenda ${data.partido ?? "não informada"}`}>
            {partyLogoPath ? (
              <Image
                alt={`Logo do partido ${data.partido ?? ""}`}
                className="event-party-mark-image"
                height={78}
                src={partyLogoPath}
                unoptimized
                width={78}
              />
            ) : (
              <span className="event-party-mark-fallback">{partyAcronym || "?"}</span>
            )}
          </div>
        </div>
        <p className="subtitle event-wall-subtitle">
          {data.evento.nome_evento} • {formatDateTime(data.evento.data_evento)}
        </p>
        <div className="event-confirmation-meta">
          <div className="regional-card-metric">
            <span>Local</span>
            <strong style={{ fontSize: "1rem" }}>
              {data.evento.local_nome ??
                ([data.evento.cidade, data.evento.uf].filter(Boolean).join(" / ") || "A definir")}
            </strong>
          </div>
        </div>
      </section>

      <section className="card event-confirmation-grid">
        <div className="event-confirmation-form-panel">
          {hasSuccessfulConfirmation ? (
            <>
              <h2 className="section-title">Participação confirmada</h2>
              <p className="subtitle">
                Agradecemos sua participação, <strong>{query?.nome ?? "participante"}</strong>.
              </p>
              <section className="feedback-banner ok">
                <strong>Participação registrada com sucesso.</strong>
                <div style={{ marginTop: 6 }}>{query?.mensagem ?? "Contamos com sua presença!"}</div>
                {query?.telefone ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>{query.nome ?? "Participante"}</strong>
                    <span className="mono"> • {query.telefone}</span>
                  </div>
                ) : null}
              </section>
              <div className="step-panel-callout">Contamos com sua presença!</div>
              <div className="actions">
                <PublicExitButton />
              </div>
            </>
          ) : !isConfirmationOpen ? (
            <>
              <h2 className="section-title">Confirmacao encerrada</h2>
              <p className="subtitle">
                O evento existe, mas o prazo de confirmacao publica ja foi encerrado.
              </p>
              <section className="feedback-banner error">
                <strong>Confirmacao indisponivel.</strong>
                <div style={{ marginTop: 6 }}>
                  Para confirmar presenca ou regularizar a participacao, fale diretamente com a equipe da campanha.
                </div>
              </section>
              <div className="actions">
                <PublicExitButton />
              </div>
            </>
          ) : (
            <>
              <h2 className="section-title">Confirme sua participação</h2>
              <p className="subtitle">
                Preencha o número do seu telefone e confirme sua presença se já estiver cadastrado conosco.
                Caso não esteja, complemente com os demais dados e tecle para confirmar a presença no evento.
              </p>

              {query?.feedback && query?.mensagem ? (
                <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
                  <strong>{query.feedback === "sucesso" ? "Confirmação registrada." : "Falha no registro."}</strong>
                  <div style={{ marginTop: 6 }}>{query.mensagem}</div>
                  {query?.telefone ? (
                    <div style={{ marginTop: 8 }}>
                      <strong>{query.nome ?? "Participante"}</strong>
                      <span className="mono"> • {query.telefone}</span>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <form action={confirmEventAttendanceAction} className="manager-auth-form">
                <input name="idCandidato" type="hidden" value={data.id_candidato} />
                <input name="eventoId" type="hidden" value={data.evento.id} />
                <input name="redirectTo" type="hidden" value={publicLink} />
                <label className="step-note">
                  <span>Telefone</span>
                  <input
                    className="step-input"
                    defaultValue={query?.telefone ?? ""}
                    name="telefone"
                    placeholder="61999998888"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Nome</span>
                  <input
                    className="step-input"
                    defaultValue={query?.nome ?? ""}
                    name="nome"
                    placeholder="Nome completo"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Cidade</span>
                  <input
                    className="step-input"
                    defaultValue={query?.cidade ?? ""}
                    name="cidade"
                    placeholder="Cidade"
                    type="text"
                  />
                </label>
                <div className="actions">
                  <button className="button" type="submit">
                    Confirmar presença no evento
                  </button>
                  <PublicExitButton />
                </div>
              </form>
            </>
          )}
        </div>

        <aside className="event-attendance-self-service-card">
          <span className="pill ok">Canal oficial</span>
          <h2 className="section-title">Fale com a campanha</h2>
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
            {hasSuccessfulConfirmation
              ? "Contamos com sua presença!"
              : "Aponte a câmera do celular para o QR Code ou registre o telefone no WhatsApp para confirmar a presença."}
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildPoliticalIdentity(input: {
  nomeUrna: string;
  partido: string | null;
  cargoDisputado: string | null;
  eventDate: string;
}) {
  const eventDate = new Date(input.eventDate);
  const registrationDeadline = new Date(Date.UTC(eventDate.getUTCFullYear(), 7, 15, 2, 59, 59));
  const endOfElectionYear = new Date(Date.UTC(eventDate.getUTCFullYear(), 11, 31, 23, 59, 59));
  const now = new Date();

  if (now < registrationDeadline) {
    return {
      badge: "Pré-candidatura",
      headline: `Pré-candidato ${input.nomeUrna}`
    };
  }

  if (now <= endOfElectionYear) {
    return {
      badge: input.cargoDisputado ? `Candidato a ${input.cargoDisputado}` : "Candidatura em curso",
      headline: input.nomeUrna
    };
  }

  return {
    badge: input.cargoDisputado ? `${input.cargoDisputado} em exercício` : "Mandato em exercício",
    headline: input.nomeUrna
  };
}

function normalizePartyAcronym(partido: string | null) {
  return String(partido ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12)
    .toUpperCase();
}

function resolvePartyLogoPath(partido: string | null) {
  const acronym = normalizePartyAcronym(partido);

  if (!acronym) {
    return null;
  }

  const knownPartyLogos: Record<string, string> = {
    AGIR: "/partidos/agir.png",
    AVANTE: "/partidos/avante.png",
    CIDADANIA: "/partidos/cidadania.png",
    DC: "/partidos/dc.png",
    DEMOCRATA: "/partidos/democrata.png",
    MDB: "/partidos/mdb.png",
    MISSAO: "/partidos/missao.png",
    MOBILIZA: "/partidos/mobiliza.png",
    NOVO: "/partidos/novo.png",
    PCB: "/partidos/pcb.png",
    PCDOB: "/partidos/pcdob.png",
    PCO: "/partidos/pco.png",
    PDT: "/partidos/pdt.png",
    PL: "/partidos/pl.png",
    PODE: "/partidos/pode.png",
    PP: "/partidos/pp.png",
    PRD: "/partidos/prd.png",
    PRTB: "/partidos/prtb.png",
    PSB: "/partidos/psb.png",
    PSD: "/partidos/psd.png",
    PSDB: "/partidos/psdb.png",
    PSOL: "/partidos/psol.png",
    PSTU: "/partidos/pstu.png",
    PT: "/partidos/pt.png",
    PV: "/partidos/pv.png",
    REDE: "/partidos/rede.png",
    REPUBLICANOS: "/partidos/republicanos.png",
    SOLIDARIEDADE: "/partidos/solidariedade.png",
    UNIAO: "/partidos/uniao.png",
    UNIAOBRASIL: "/partidos/uniao.png",
    UP: "/partidos/up.png"
  };

  return knownPartyLogos[acronym] ?? null;
}
