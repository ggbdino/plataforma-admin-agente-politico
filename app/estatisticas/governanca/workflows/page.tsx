import { getCurrentPlatformSession } from "@/lib/auth";
import { triggerGovernanceWorkflowAction } from "@/lib/actions/workflow-center-action";
import { WorkflowCenterPanel } from "@/components/workflow-center-panel";
import { listCandidates } from "@/lib/repositories/candidates";

type WorkflowCenterPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function WorkflowCenterPage({ searchParams }: WorkflowCenterPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const candidates = await listCandidates();
  const defaultCandidateId = candidates[0]?.id_candidato ?? "0001";

  return (
    <WorkflowCenterPanel
      candidates={candidates}
      defaultCandidateId={defaultCandidateId}
      feedback={query}
      isAdmin={session?.perfil === "administrador"}
      triggerAction={triggerGovernanceWorkflowAction}
    />
  );
}
