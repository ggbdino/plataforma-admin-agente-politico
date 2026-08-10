import { NextResponse } from "next/server";
import { recordOutreachEvidence } from "@/lib/repositories/campaign-outreach-team";

type EvidenceRouteProps = {
  params: Promise<{ idCandidato: string }>;
};

export async function POST(request: Request, { params }: EvidenceRouteProps) {
  const { idCandidato } = await params;
  const configuredKey = process.env.OUTREACH_EVIDENCE_API_KEY;
  const providedKey = getProvidedApiKey(request);

  if (!configuredKey) {
    return NextResponse.json(
      {
        success: false,
        message: "Configure OUTREACH_EVIDENCE_API_KEY para habilitar o registro automático de evidências da Equipe de Divulgação."
      },
      { status: 503 }
    );
  }

  if (providedKey !== configuredKey) {
    return NextResponse.json({ success: false, message: "Chave de integração inválida." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const taskId = String(body.taskId ?? body.tarefaId ?? "").trim();
    const memberId = String(body.memberId ?? body.membroId ?? "").trim() || null;
    const memberPhone = String(body.memberPhone ?? body.telefone ?? body.whatsapp ?? "").trim() || null;
    const mensagem = String(body.mensagem ?? body.message ?? body.evidencia ?? "").trim();

    if (!taskId) {
      return NextResponse.json({ success: false, message: "Informe taskId ou tarefaId." }, { status: 400 });
    }

    if (!memberId && !memberPhone) {
      return NextResponse.json({ success: false, message: "Informe memberId/membroId ou telefone do membro." }, { status: 400 });
    }

    await recordOutreachEvidence({
      idCandidato,
      taskId,
      memberId,
      memberPhone,
      mensagem,
      quantidadeValidada: body.quantidadeValidada ?? body.quantidade ?? 1,
      canal: body.canal ?? "whatsapp",
      origem: body.origem ?? "n8n-whatsapp"
    });

    return NextResponse.json({ success: true, idCandidato, taskId, memberId, memberPhone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar evidência da Equipe de Divulgação.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

function getProvidedApiKey(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-api-key") ?? "";
}