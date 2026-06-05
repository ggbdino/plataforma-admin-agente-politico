import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignEventAttendanceContext } from "@/lib/repositories/event-attendance";

export const dynamic = "force-dynamic";

type CampaignEventWallPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    evento?: string;
  }>;
};

export default async function CampaignEventWallPage({
  params,
  searchParams
}: CampaignEventWallPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const canOperateEvents = await hasCampaignAccess(session, idCandidato, "pode_operar_eventos");
  const canImplant = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!canOperateEvents && !canImplant) {
    notFound();
  }

  const data = await getCampaignEventAttendanceContext(idCandidato);

  if (!data) {
    notFound();
  }

  const selectedEventId = query?.evento || data.eventos[0]?.id || "";
  const selectedEvent = data.eventos.find((event) => event.id === selectedEventId) ?? data.eventos[0] ?? null;

  return (
    <main className="page-shell">
      <section className="hero-card event-wall-shell">
        <span className="pill ok">Autoatendimento</span>
        <h1 className="title">Confirme sua presença no evento</h1>
        <p className="subtitle event-wall-subtitle">
          {selectedEvent
            ? `${selectedEvent.nome_evento} • ${formatDateTime(selectedEvent.data_evento)}`
            : `Campanha ${data.nome_urna}`}
        </p>
        {data.qr_code_url ? (
          <Image
            alt={`QR Code oficial de ${data.nome_urna}`}
            className="event-wall-qr"
            height={360}
            src={data.qr_code_url}
            unoptimized
            width={360}
          />
        ) : (
          <div className="step-panel-callout">QR Code oficial ainda não disponível para esta campanha.</div>
        )}
        <div className="event-wall-number">
          <span>Número oficial da campanha</span>
          <strong>{data.numero_agente_oficial ?? "pendente"}</strong>
        </div>
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
