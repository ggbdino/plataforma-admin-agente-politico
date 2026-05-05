import { NextResponse } from "next/server";
import { getCandidateImplantation } from "@/lib/repositories/implantation";

type RouteContext = {
  params: Promise<{
    idCandidato: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { idCandidato } = await context.params;
  const data = await getCandidateImplantation(idCandidato);

  if (!data) {
    return NextResponse.json(
      {
        message: "Candidato ou implantacao nao encontrados."
      },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
