import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sendCampaignSmsAction } from "@/lib/actions/campaign-sms-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignSmsContext } from "@/lib/repositories/campaign-sms";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type CampaignSmsPageProps = {
  params: Promise<{ idCandidato: string }>;
  searchParams?: Promise<{ feedback?: string; mensagem?: string }>;
};

export default async function CampaignSmsPage({ params, searchParams }: CampaignSmsPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(`/gestor/candidato/${idCandidato}`);
  }

  const context = await getCampaignSmsContext(idCandidato);

  if (!context) {
    notFound();
  }

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Falha operacional."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Comunicação por SMS</span>
        <h1 className="title">Remessa de mensagens para celulares</h1>
        <p className="subtitle">
          Área exclusiva do gestor da campanha para enviar mensagens curtas aos telefones dos eleitores,
          com limite operacional, trilha de auditoria e integração com gateway SMS configurável.
        </p>
        <div className="hero-meta">
          <span className="pill">Candidato {context.nome_urna}</span>
          <span className="pill">Usuário {session.nome}</span>
          <span className="pill">Perfil gestor da campanha</span>
          <span className="pill">{APP_VERSION}</span>
        </div>
        <div className="actions">
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para a área do gestor
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/comunicacao/email`}>
            Remeter e-mails
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/comunicacao/whatsapp`}>
            Remeter WhatsApp
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos/gestao`}>
            Eventos da campanha
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card">
          <span className="metric-label">Eleitores com telefone</span>
          <strong className="metric-value">{context.total_eleitores_com_telefone}</strong>
          <div className="muted">Somente registros com telefone válido e sem opt-out entram na remessa.</div>
        </article>
        <article className="card email-summary-card">
          <span className="metric-label">Identificação do remetente</span>
          <strong className="metric-value email-summary-value">{context.sender_id ?? "Pendente"}</strong>
          <div className="muted">Pode ser o número oficial da campanha ou o sender configurado no gateway.</div>
        </article>
        <article className="card email-summary-card">
          <span className="metric-label">Gateway SMS</span>
          <strong className="metric-value email-summary-value">{labelProvider(context.provedor_envio)}</strong>
          <div className="muted">Sem gateway configurado, a remessa fica apenas planejada e auditada.</div>
        </article>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Preparar SMS</h2>
            <p className="subtitle">
              Escolha o público, escreva uma mensagem curta e confirme o envio para os celulares da base do candidato.
            </p>
          </div>
          <span className="pill">Exclusivo do gestor</span>
        </div>

        <form action={sendCampaignSmsAction} className="manager-auth-form">
          <input name="idCandidato" type="hidden" value={idCandidato} />

          <div className="step-form-grid">
            <label className="step-note">
              <span>Remetente/Sender</span>
              <input
                className="step-input"
                defaultValue={context.sender_id ?? ""}
                name="senderId"
                placeholder="Número da campanha ou sender do gateway"
                type="text"
              />
            </label>
            <label className="step-note">
              <span>Público da remessa</span>
              <select className="step-input" name="publico">
                <option value="todos_com_telefone">Todos os eleitores com telefone</option>
                <option value="eleitor_individual">Um eleitor específico</option>
                <option value="evento_todos">Todos os participantes de um evento</option>
                <option value="evento_confirmados">Confirmados em um evento</option>
                <option value="evento_presentes">Presentes em um evento</option>
              </select>
            </label>
            <label className="step-note">
              <span>Eleitor, quando aplicável</span>
              <select className="step-input" name="eleitorUid">
                <option value="">Sem eleitor individual</option>
                {context.eleitores.map((elector) => (
                  <option key={elector.eleitor_uid} value={elector.eleitor_uid}>
                    {(elector.nome ?? "Sem nome")} - {elector.telefone}
                  </option>
                ))}
              </select>
            </label>
            <label className="step-note">
              <span>Evento, quando aplicável</span>
              <select className="step-input" name="eventoId">
                <option value="">Sem filtro de evento</option>
                {context.eventos.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.nome_evento} - {formatDate(event.data_evento)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="step-note">
            <span>Texto do SMS</span>
            <textarea
              className="step-textarea"
              maxLength={320}
              name="mensagem"
              placeholder="Escreva uma mensagem objetiva para aparecer no aplicativo Mensagens do celular."
              required
              rows={5}
            />
            <small className="muted">Limite operacional: 320 caracteres. Mensagens maiores podem ser tarifadas em múltiplos segmentos pelo gateway.</small>
          </label>

          <div className="step-panel-callout">
            Use SMS apenas para contatos com base legítima, respeitando LGPD, legislação eleitoral, descadastro e limites anti-spam do provedor. Para testes, selecione um eleitor específico e mantenha SMS_MAX_RECIPIENTS_PER_DISPATCH baixo.
          </div>

          <div className="actions">
            <button className="button" type="submit">
              Registrar e enviar SMS
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Histórico de remessas SMS</h2>
            <p className="subtitle">Últimas mensagens SMS registradas para este candidato.</p>
          </div>
        </div>
        {context.ultimas_remessas.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Mensagem</th>
                  <th>Público</th>
                  <th>Provedor</th>
                  <th>Status</th>
                  <th>Destinatários</th>
                  <th>Enviados</th>
                  <th>Falhas</th>
                </tr>
              </thead>
              <tbody>
                {context.ultimas_remessas.map((dispatch) => (
                  <tr key={dispatch.id}>
                    <td>{formatDate(dispatch.criado_em)}</td>
                    <td>{dispatch.mensagem}</td>
                    <td>{labelAudience(dispatch.publico)}</td>
                    <td>{labelProvider(dispatch.provider)}</td>
                    <td>{labelStatus(dispatch.status)}</td>
                    <td>{dispatch.total_destinatarios}</td>
                    <td>{dispatch.total_enviados}</td>
                    <td>{dispatch.total_falhas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Nenhuma remessa SMS foi registrada para este candidato.</div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function labelProvider(value: string) {
  const labels: Record<string, string> = {
    webhook: "Webhook configurado",
    zenvia: "Zenvia configurado",
    twilio: "Twilio configurado",
    totalvoice: "TotalVoice configurado",
    sem_provedor: "Não configurado"
  };
  return labels[value] ?? value;
}

function labelAudience(value: string) {
  const labels: Record<string, string> = {
    todos_com_telefone: "Todos com telefone",
    eleitor_individual: "Eleitor individual",
    evento_todos: "Participantes do evento",
    evento_confirmados: "Confirmados no evento",
    evento_presentes: "Presentes no evento"
  };
  return labels[value] ?? value;
}

function labelStatus(value: string) {
  const labels: Record<string, string> = {
    em_processamento: "Em processamento",
    planejada_sem_provedor: "Planejada sem provedor",
    enviada: "Enviada",
    enviada_com_falhas: "Enviada com falhas",
    erro: "Erro"
  };
  return labels[value] ?? value;
}