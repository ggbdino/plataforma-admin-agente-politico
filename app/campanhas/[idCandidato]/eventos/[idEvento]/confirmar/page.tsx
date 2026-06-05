import Image from "next/image";
import { notFound } from "next/navigation";
import { confirmEventAttendanceAction } from "@/lib/actions/event-confirmation-action";
import { getCampaignEventConfirmationContext } from "@/lib/repositories/event-attendance";

export const dynamic = "force-dynamic";

type EventConfirmationPageProps = {
  params: Promise<{
    idCandidato: string;
    idEvento: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
    telefone?: string;
    nome?: string;
    cidade?: string;
  }>;
};

export default async function EventConfirmationPage({
  params,
  searchParams
}: EventConfirmationPageProps) {
  const { idCandidato, idEvento } = await params;
  const query = searchParams ? await searchParams : undefined;
  const data = await getCampaignEventConfirmationContext(idCandidato, idEvento);

  if (!data || !data.evento) {
    notFound();
  }

  const politicalIdentity = buildPoliticalIdentity({
    nomeUrna: data.nome_urna,
    partido: data.partido,
    cargoDisputado: data.cargo_disputado,
    eventDate: data.evento.data_evento
  });

  return (
    <main className="page-shell">
      <section className="hero-card event-confirmation-shell">
        <div className="event-confirmation-header">
          <span className="pill ok">{politicalIdentity.badge}</span>
          <span className="pill">{data.partido ?? "Sem legenda informada"}</span>
        </div>
        <h1 className="title">{politicalIdentity.headline}</h1>
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
          <div className="regional-card-metric">
            <span>Confirmados</span>
            <strong>{data.evento.total_confirmados}</strong>
          </div>
        </div>
      </section>

      <section className="card event-confirmation-grid">
        <div className="event-confirmation-form-panel">
          <h2 className="section-title">Confirme sua participação</h2>
          <p className="subtitle">
            Preencha os dados básicos para confirmar presença antecipada neste evento e iniciar o
            relacionamento com a campanha.
          </p>

          {query?.feedback && query?.mensagem ? (
            <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
              <strong>{query.feedback === "sucesso" ? "Confirmação registrada." : "Falha no registro."}</strong>
              <div style={{ marginTop: 6 }}>{query.mensagem}</div>
              {query.telefone ? (
                <div style={{ marginTop: 8 }}>
                  <strong>{query.nome ?? "Participante"}</strong>
                  <span className="mono"> • {query.telefone}</span>
                </div>
              ) : null}
            </section>
          ) : null}

          <form action={confirmEventAttendanceAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="eventoId" type="hidden" value={idEvento} />
            <input
              name="redirectTo"
              type="hidden"
              value={`/campanhas/${idCandidato}/eventos/${idEvento}/confirmar`}
            />
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
            <button className="button" type="submit">
              Confirmar participação no evento
            </button>
          </form>
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
            Se preferir, você também pode iniciar contato direto com a campanha pelo QR Code ou
            pelo número oficial do WhatsApp.
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
