import { NextResponse } from "next/server";
import { getCurrentPlatformSession } from "@/lib/auth";
import { getCandidateDeletionArchive } from "@/lib/repositories/admin-candidate-maintenance";

type ArchiveDownloadRouteProps = {
  params: Promise<{
    idArquivo: string;
  }>;
};

export async function GET(_request: Request, { params }: ArchiveDownloadRouteProps) {
  const session = await getCurrentPlatformSession();

  if (!session || session.perfil !== "administrador") {
    return NextResponse.json(
      { message: "Apenas administradores podem baixar arquivos de recuperação." },
      { status: 401 }
    );
  }

  const { idArquivo } = await params;
  const archive = await getCandidateDeletionArchive(idArquivo);

  if (!archive) {
    return NextResponse.json(
      { message: "Arquivo de recuperação não localizado." },
      { status: 404 }
    );
  }

  const body = JSON.stringify(archive.payload, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": `${archive.content_type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${archive.nome_arquivo}"`
    }
  });
}
