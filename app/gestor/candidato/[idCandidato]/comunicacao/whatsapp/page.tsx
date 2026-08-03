import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sendCampaignWhatsAppAction } from "@/lib/actions/campaign-whatsapp-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignWhatsAppContext } from "@/lib/repositories/campaign-whatsapp";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type CampaignWhatsAppPageProps = {
  params: Promise<{ idCandidato: string }>;
  searchParams?: Promise<{ feedback?: string; mensagem?: string }>;
};

export default async function CampaignWhatsAppPage({ params, searchParams }: CampaignWhatsAppPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");

  if (!session || !hasAccess || session.perfil !== "gestor_campanha") {
    redirect(`/gestor/candidato/${idCandidato}`);
  }

  const context = await getCampaignWhatsAppContext(idCandidato);

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
        <span className="pill">Comunicação por WhatsApp</span>
        <h1 className="title">Remessa de mensagens por template</h1>
        <p className="subtitle">
          Área exclusiva do gestor da campanha para enviar mensagens pelo WhatsApp oficial do candidato,
          usando modelos aprovados na Meta, limite operacional e trilha de auditoria.
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
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/comunicacao/sms`}>
            Remeter SMS
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
          <span className="metric-label">Número do candidato</span>
          <strong className="metric-value email-summary-value">{context.numero_campanha ?? "Pendente"}</strong>
          <div className="muted">Esse número deve estar associado ao WhatsApp Business da Meta.</div>
        </article>
        <article className="card email-summary-card">
          <span className="metric-label">Meta Cloud API</span>
          <strong className="metric-value email-summary-value">
            {context.meta_configurada ? "Configurada" : "Pendente"}
          </strong>
          <div className="muted">O envio real exige phone_number_id, token válido e template aprovado.</div>
        </article>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Preparar remessa</h2>
            <p className="subtitle">
              Escolha um padrão de mensagem, selecione o público da base do candidato e preencha as variáveis exatamente na ordem
              configurada no template aprovado pela Meta.
            </p>
          </div>
          <span className="pill">Exclusivo do gestor</span>
        </div>

        <form action={sendCampaignWhatsAppAction} className="manager-auth-form">
          <input name="idCandidato" type="hidden" value={idCandidato} />

          <div className="step-form-grid">
            <label className="step-note">
              <span>Phone number ID da Meta</span>
              <input
                className="step-input"
                defaultValue={context.phone_number_id ?? ""}
                name="phoneNumberId"
                placeholder="Ex.: 1201921212997882"
                type="text"
              />
            </label>
            <label className="step-note">
              <span>Conta do WhatsApp Business</span>
              <input
                className="step-input"
                defaultValue={context.business_account_id ?? ""}
                name="businessAccountId"
                placeholder="WhatsApp Business Account ID"
                type="text"
              />
            </label>
            <label className="step-note">
              <span>Número oficial da campanha</span>
              <input
                className="step-input"
                defaultValue={context.numero_campanha ?? ""}
                name="numeroCampanha"
                placeholder="5561..."
                type="text"
              />
            </label>
          </div>

          <label className="step-note">
            <span>Token de acesso da Meta</span>
            <input
              className="step-input"
              name="accessToken"
              placeholder="Cole o token apenas quando quiser atualizar a credencial salva"
              type="password"
            />
            <small className="muted">O token é necessário para envio real. Deixe em branco para usar o token já registrado ou a variável de ambiente.</small>
          </label>

          <div className="step-form-grid">
            <label className="step-note">
              <span>Padrão de mensagem</span>
              <select className="step-input" name="padraoMensagem">
                {context.modelos_padrao.map((modelo) => (
                  <option key={modelo.id} value={modelo.id}>
                    {modelo.nome} - template {modelo.template_sugerido}
                  </option>
                ))}
              </select>
              <small className="muted">Use esta seleção para auditar a finalidade da remessa.</small>
            </label>
            <label className="step-note">
              <span>Nome técnico do template Meta</span>
              <input
                className="step-input"
                defaultValue={context.template_padrao ?? context.modelos_padrao[0]?.template_sugerido ?? ""}
                list="modelos-whatsapp-meta"
                name="templateName"
                placeholder="nome_do_template_aprovado"
                required
                type="text"
              />
              <datalist id="modelos-whatsapp-meta">
                {context.modelos_padrao.map((modelo) => (
                  <option key={modelo.id} value={modelo.template_sugerido} />
                ))}
              </datalist>
            </label>
            <label className="step-note">
              <span>Idioma do template</span>
              <input className="step-input" defaultValue={context.language_code} name="languageCode" type="text" />
            </label>
            <label className="step-note">
              <span>Público da base do candidato</span>
              <select className="step-input" name="publico">
                <option value="todos_com_telefone">Todos os eleitores com celular/telefone</option>
                <option value="eleitor_individual">Um eleitor específico</option>
                <option value="evento_todos">Todos os participantes de um evento</option>
                <option value="evento_confirmados">Confirmados em um evento</option>
                <option value="evento_presentes">Presentes em um evento</option>
              </select>
            </label>
          </div>

          <div className="step-form-grid">
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

          <div className="step-form-grid">
            {[1, 2, 3, 4, 5].map((index) => (
              <label className="step-note" key={index}>
                <span>{`Variável ${index}`}</span>
                <input
                  className="step-input"
                  name={`variavel${index}`}
                  placeholder={index === 1 ? "Ex.: nome do eleitor" : "Opcional"}
                  type="text"
                />
              </label>
            ))}
          </div>

          <div className="step-panel-callout">
            Esta opção envia mensagens do candidato para celulares de eleitores cadastrados na base selecionada. Mensagens iniciadas pela campanha devem usar template aprovado pela Meta. Custos, limites,
            qualidade do número e bloqueios ficam associados ao número do candidato e à respectiva conta
            de WhatsApp Business. Para testes, use público individual e limite baixo em WHATSAPP_MAX_RECIPIENTS_PER_DISPATCH.
          </div>

          <div className="actions">
            <button className="button" type="submit">
              Registrar e enviar remessa WhatsApp
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Histórico de remessas</h2>
            <p className="subtitle">Últimas mensagens de WhatsApp registradas para este candidato.</p>
          </div>
        </div>
        {context.ultimas_remessas.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Template</th>
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
                    <td>{dispatch.template_name}</td>
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
          <div className="empty-state">Nenhuma remessa de WhatsApp foi registrada para este candidato.</div>
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

