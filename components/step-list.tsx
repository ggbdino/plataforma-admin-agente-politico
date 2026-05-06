import { executeStepAction } from "@/lib/actions/execute-step-action";
import type { ImplantationStep } from "@/lib/types";
import { ImplantationStatusPill } from "./implantation-status-pill";

type StepListProps = {
  idCandidato: string;
  steps: ImplantationStep[];
};

export function StepList({ idCandidato, steps }: StepListProps) {
  return (
    <div className="step-list">
      {steps.map((step) => (
        <article className="step-item" key={step.codigo_etapa}>
          <div className="step-head">
            <div>
              <strong>
                {step.ordem}. {step.nome_etapa}
              </strong>
              <div className="muted mono" style={{ marginTop: 6 }}>
                {step.workflow_nome ?? "Etapa manual"}
              </div>
              {step.webhook_path ? (
                <div className="muted mono mono-wrap">{step.webhook_path}</div>
              ) : null}
              {step.mensagem_status ? (
                <div className="muted" style={{ marginTop: 8 }}>
                  {step.mensagem_status}
                </div>
              ) : null}
              <div className="step-meta">
                <span>
                  <strong>Execucao:</strong>{" "}
                  {step.executado_em ? formatDateTime(step.executado_em) : "ainda nao iniciada"}
                </span>
                <span>
                  <strong>Finalizacao:</strong>{" "}
                  {step.finalizado_em ? formatDateTime(step.finalizado_em) : "pendente"}
                </span>
              </div>
            </div>
            <ImplantationStatusPill status={step.status_etapa} />
          </div>

          <form action={executeStepAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="idCandidato" value={idCandidato} />
            <input type="hidden" name="codigoEtapa" value={step.codigo_etapa} />
            <button
              className="button"
              disabled={step.status_etapa === "em_andamento"}
              type="submit"
            >
              {step.status_etapa === "concluida" || step.status_etapa === "com_erro"
                ? "Reprocessar"
                : step.status_etapa === "em_andamento"
                  ? "Executando..."
                  : "Executar"}
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}
