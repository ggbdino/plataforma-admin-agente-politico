import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sendCampaignEmailAction } from "@/lib/actions/campaign-email-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignEmailContext } from "@/lib/repositories/campaign-email";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type CampaignEmailPageProps = {
  params: Promise<{ idCandidato: string }>;
  searchParams?: Promise<{ feedback?: string; mensagem?: string }>;
};

export default async function CampaignEmailPage({ params, searchParams }: CampaignEmailPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(`/gestor/candidato/${idCandidato}`);
  }

  const context = await getCampaignEmailContext(idCandidato);

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
        <span className="pill">Comunicação por e-mail</span>
        <h1 className="title">Remessa de mensagens da campanha</h1>
        <p className="subtitle">
          Área exclusiva do gestor da campanha para enviar mensagens por e-mail aos eleitores do
          candidato, com remetente institucional do próprio candidato e trilha de auditoria.
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
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos/gestao`}>
            Eventos da campanha
          </Link>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="card">
          <span className="metric-label">Eleitores com e-mail</span>
          <strong className="metric-value">{context.total_eleitores_com_email}</strong>
          <div className="muted">Somente registros com e-mail válido e sem opt-out entram na remessa.</div>
        </article>
        <article className="card">
          <span className="metric-label">Remetente do candidato</span>
          <strong className="metric-value compact-text">{context.email_remetente ?? "Pendente"}</strong>
          <div className="muted">Quando não houver e-mail registrado, informe-o no formulário abaixo.</div>
        </article>
        <article className="card">
          <span className="metric-label">Provedor de envio</span>
          <strong className="metric-value compact-text">
            {labelProvider(context.provedor_envio)}
          </strong>
          <div className="muted">Modo ativo para envio externo. Sem provedor, a remessa fica apenas planejada e auditada.</div>
        </article>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Preparar mensagem</h2>
            <p className="subtitle">
              Escolha o público, escreva a mensagem e inclua, se necessário, uma imagem por URL,
              um arquivo local e o QR Code oficial da campanha.
            </p>
          </div>
          <span className="pill">Exclusivo do gestor</span>
        </div>

        <form action={sendCampaignEmailAction} className="manager-auth-form" encType="multipart/form-data">
          <input name="idCandidato" type="hidden" value={idCandidato} />

          <div className="step-form-grid">
            <label className="step-note">
              <span>E-mail remetente do candidato</span>
              <input
                className="step-input"
                defaultValue={context.email_remetente ?? ""}
                name="emailRemetente"
                placeholder="candidato@dominio.com.br"
                required
                type="email"
              />
            </label>
            <label className="step-note">
              <span>Público da remessa</span>
              <select className="step-input" name="publico">
                <option value="todos_com_email">Todos os eleitores com e-mail</option>
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
                    {(elector.nome ?? "Sem nome")} - {elector.email}
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
            <span>Assunto</span>
            <input className="step-input" maxLength={180} name="assunto" required type="text" />
          </label>

          <label className="step-note">
            <span>Texto da mensagem</span>
            <textarea
              className="step-textarea"
              name="mensagem"
              placeholder="Escreva a mensagem que será enviada aos eleitores selecionados."
              required
              rows={8}
            />
          </label>

          <div className="step-form-grid">
            <label className="step-note">
              <span>URL de imagem da campanha</span>
              <input className="step-input" name="imagemUrl" placeholder="https://..." type="url" />
            </label>
            <label className="step-note">
              <span>Imagem do computador</span>
              <input className="step-input" accept="image/*" name="imagemArquivo" type="file" />
              <small className="muted">Opcional. A imagem será anexada ao e-mail. Tamanho máximo: 2 MB.</small>
            </label>
            <label className="manager-channel-option">
              <input
                defaultChecked={Boolean(context.qr_code_url)}
                disabled={!context.qr_code_url}
                name="incluirQrCode"
                type="checkbox"
              />
              <span>
                <strong>Incluir QR Code oficial</strong>
                <small className="muted">
                  {context.qr_code_url
                    ? "O QR Code atual do candidato será incluído no corpo do e-mail."
                    : "Não há QR Code oficial registrado para este candidato."}
                </small>
              </span>
            </label>
          </div>

          <div className="step-panel-callout">
            A remessa deve respeitar a legislação eleitoral, a LGPD e as políticas anti-spam do
            provedor. Use apenas públicos com base legítima de contato.
          </div>

          <div className="actions">
            <button className="button" type="submit">
              Registrar e enviar remessa
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Histórico de remessas</h2>
            <p className="subtitle">Últimas mensagens registradas para este candidato.</p>
          </div>
        </div>
        {context.ultimas_remessas.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Assunto</th>
                  <th>Público</th>
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
                    <td>{dispatch.assunto}</td>
                    <td>{labelAudience(dispatch.publico)}</td>
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
          <div className="empty-state">Nenhuma remessa foi registrada para este candidato.</div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

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
    smtp: "SMTP configurado",
    resend: "Resend configurado",
    sem_provedor: "Não configurado"
  };

  return labels[value] ?? value;
}

function labelAudience(value: string) {
  const labels: Record<string, string> = {
    todos_com_email: "Todos com e-mail",
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
