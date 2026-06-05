import { NextResponse } from "next/server";
import {
  confirmActiveEventAttendanceByPhone,
  getActiveCampaignEvent
} from "@/lib/repositories/event-attendance";

type RouteContext = {
  params: Promise<{
    idCandidato: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { idCandidato } = await context.params;
  const snapshot = await getActiveCampaignEvent(idCandidato);

  return NextResponse.json(snapshot);
}

export async function POST(request: Request, context: RouteContext) {
  const { idCandidato } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await confirmActiveEventAttendanceByPhone({
      idCandidato,
      telefone: String(body.telefone ?? ""),
      nome: typeof body.nome === "string" ? body.nome : undefined,
      cidade: typeof body.cidade === "string" ? body.cidade : undefined,
      observacao:
        typeof body.observacao === "string"
          ? body.observacao
          : "confirmacao_automatica_evento",
      confirmouParticipacao: body.confirmouParticipacao === true
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao confirmar a presenca do evento ativo.";

    return NextResponse.json(
      {
        eventoAtivo: false,
        presencaRegistrada: false,
        message
      },
      { status: 400 }
    );
  }
}
