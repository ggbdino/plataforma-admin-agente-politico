import { executeStepAction } from "@/lib/actions/execute-step-action";
import type { ImplantationStep } from "@/lib/types";
import { ImplantationStatusPill } from "./implantation-status-pill";

type StepListProps = {
  idCandidato: string;
  candidateName: string;
  officialNumber: string | null;
  steps: ImplantationStep[];
};

export function StepList({ idCandidato, candidateName, officialNumber, steps }: StepListProps) {
  const firstPendingStep = steps.find(
    (step) => step.status_etapa !== "concluida"
  );

  return (
    <div className="step-list">
      {steps.map((step) => (
        <article
          className={`step-item ${isStepBlocked(step, firstPendingStep?.codigo_etapa) ? "is-blocked" : ""}`}
          key={step.codigo_etapa}
        >
          <div className="step-head">
            <div>
              <strong>
                {step.ordem}. {step.nome_etapa}
              </strong>
              <div className="muted mono" style={{ marginTop: 6 }}>
                {step.workflow_nome ?? "Etapa manual"}
              </div>
              <div className="step-badges">
                <span className="pill">
                  {getStepMode(step.codigo_etapa) === "manual" ? "Etapa manual" : "Webhook n8n"}
                </span>
                {firstPendingStep?.codigo_etapa === step.codigo_etapa ? (
                  <span className="pill ok">Proxima etapa recomendada</span>
                ) : null}
              </div>
              {step.webhook_path ? (
                <div className="muted mono mono-wrap">{step.webhook_path}</div>
              ) : null}
              {step.mensagem_status ? (
                <div className="muted" style={{ marginTop: 8 }}>
                  {step.mensagem_status}
                </div>
              ) : null}
              {isStepBlocked(step, firstPendingStep?.codigo_etapa) ? (
                <div className="step-warning">
                  Esta etapa fica disponivel somente apos concluir a etapa anterior da sequencia.
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
            {step.codigo_etapa === "configurar_canais" ? (
              <div className="step-channel-panel">
                <div className="step-panel-callout">
                  O WhatsApp oficial do Agente Politico e o unico canal operacional do produto.
                  O QR Code da campanha deve apontar para esse numero, e todos os outros canais
                  de divulgacao devem tracionar o eleitor para esse contato.
                </div>
                <div className="step-form-grid">
                  <label className="step-note">
                    <span>Nome do canal oficial</span>
                    <input
                      className="step-input"
                      defaultValue={`Agente Politico ${candidateName}`}
                      name="nome_canal"
                      type="text"
                    />
                  </label>
                  <label className="step-note">
                    <span>Tipo do canal oficial</span>
                    <input
                      className="step-input"
                      defaultValue="whatsapp_agente"
                      name="tipo_canal"
                      readOnly
                      type="text"
                    />
                  </label>
                  <label className="step-note">
                    <span>Numero oficial da campanha</span>
                    <input
                      className="step-input"
                      defaultValue={officialNumber ?? ""}
                      name="identificador_externo"
                      type="text"
                    />
                  </label>
                  <label className="step-note">
                    <span>Link oficial do WhatsApp</span>
                    <input
                      className="step-input"
                      defaultValue={officialNumber ? `https://wa.me/${officialNumber}` : ""}
                      name="url_canal"
                      type="text"
                    />
                  </label>
                </div>
                <label className="step-note">
                  <span>Canais de divulgacao que apontam para esse WhatsApp</span>
                  <textarea
                    className="step-textarea"
                    name="canais_divulgacao"
                    placeholder="Ex.: Instagram oficial, site da campanha, materiais graficos, landing page e redes sociais que divulgam o QR Code e o numero do Agente Politico."
                    rows={3}
                  />
                </label>
              </div>
            ) : null}
            {getStepMode(step.codigo_etapa) === "manual" ? (
              <label className="step-note">
                <span>Observacao do gestor</span>
                <textarea
                  className="step-textarea"
                  name="observacao"
                  placeholder="Descreva a evidencia ou a acao manual realizada nesta etapa."
                  rows={3}
                />
              </label>
            ) : null}
            <button
              className="button"
              disabled={
                step.status_etapa === "em_andamento" ||
                isStepBlocked(step, firstPendingStep?.codigo_etapa)
              }
              type="submit"
            >
              {getStepMode(step.codigo_etapa) === "manual"
                ? "Registrar etapa"
                : step.status_etapa === "concluida" || step.status_etapa === "com_erro"
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

function getStepMode(codigoEtapa: string) {
  if (
    codigoEtapa === "configurar_canais" ||
    codigoEtapa === "configurar_evolution" ||
    codigoEtapa === "validar_outbound" ||
    codigoEtapa === "ativar_campanha"
  ) {
    return "manual";
  }

  return "webhook";
}

function isStepBlocked(step: ImplantationStep, firstPendingStepCode?: string) {
  if (!firstPendingStepCode) {
    return false;
  }

  if (step.status_etapa === "concluida") {
    return false;
  }

  return step.codigo_etapa !== firstPendingStepCode;
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
