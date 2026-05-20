import { NextResponse } from "next/server";
import { getCurrentPlatformSession } from "@/lib/auth";
import { executeImplantationStep } from "@/lib/services/implantation-service";

type RouteContext = {
  params: Promise<{
    idCandidato: string;
    codigoEtapa: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { idCandidato, codigoEtapa } = await context.params;
  const body = await request.json().catch(() => ({}));
  const session = await getCurrentPlatformSession();

  try {
    const result = await executeImplantationStep({
      idCandidato,
      codigoEtapa,
      executedBy: body.executado_por ?? session?.email ?? "operador@plataforma.local",
      source: body.origem ?? "frontend_admin",
      payload: body.payload_complementar ?? {}
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao executar etapa de implantacao.";

    return NextResponse.json(
      {
        status: "com_erro",
        codigo_etapa: codigoEtapa,
        mensagem: message
      },
      { status: 500 }
    );
  }
}
