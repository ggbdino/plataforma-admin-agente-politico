import { executeStepAction } from "@/lib/actions/execute-step-action";
import { ImplantationStatusPill } from "./implantation-status-pill";

type Step = {
  codigo_etapa: string;
  nome_etapa: string;
  ordem: number;
  status_etapa: string;
  workflow_nome: string | null;
  webhook_path: string | null;
  mensagem_status: string | null;
};

type StepListProps = {
  idCandidato: string;
  steps: Step[];
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
            </div>
            <ImplantationStatusPill status={step.status_etapa} />
          </div>

          <form action={executeStepAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="idCandidato" value={idCandidato} />
            <input type="hidden" name="codigoEtapa" value={step.codigo_etapa} />
            <button className="button" type="submit">
              Executar
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
