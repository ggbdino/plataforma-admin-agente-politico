import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { registerCampaignChannelAction } from "@/lib/actions/campaign-manager-action";
import { authenticatePlatformAreaAction } from "@/lib/actions/platform-user-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getCampaignManagerContext } from "@/lib/repositories/implantation";

export const dynamic = "force-dynamic";

type CampaignManagerPageProps = {
  params: Promise<{
    idCandidato: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    mensagem?: string;
  }>;
};

export default async function CampaignManagerPage({
  params,
  searchParams
}: CampaignManagerPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const data = await getCampaignManagerContext(idCandidato);

  if (!data) {
    notFound();
  }

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>
            {query.feedback === "sucesso" ? "Operação concluída." : "Acesso ou registro falhou."}
          </strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Gestor da campanha</span>
        <h1 className="title">Canal oficial e divulgação da campanha</h1>
        <p className="subtitle">
          Área reservada para revisar dados do formulário de entrada, ajustar o canal oficial do
          Agente Político e registrar os canais de divulgação que apontam para esse WhatsApp.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/candidatos/${idCandidato}`}>
            Voltar para implantação
          </Link>
          <Link className="button secondary" href="/admin/usuarios">
            Equipe da campanha
          </Link>
          <Link className="button secondary" href={`/campanhas/${idCandidato}/inteligencia`}>
            Inteligência da campanha
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos/gestao`}>
            Gerir eventos da campanha
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos`}>
            Controlar presença de eventos
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso do Gestor da Campanha</h2>
          <p className="subtitle">
            Informe o e-mail e a senha de um usuário previamente cadastrado com permissão de
            implantação para esta campanha.
          </p>
          <form action={authenticatePlatformAreaAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={`/gestor/candidato/${idCandidato}`} />
            <input name="contexto" type="hidden" value="gestora" />
            <label className="step-note">
              <span>E-mail do usuário</span>
              <input className="step-input" name="email" type="email" />
            </label>
            <label className="step-note">
              <span>Senha do usuário</span>
              <input className="step-input" name="senha" type="password" />
            </label>
            <button className="button" type="submit">
              Entrar como gestor
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid grid-2" style={{ marginBottom: 20 }}>
            <article className="card manager-info-card">
              <h2 className="section-title">Dados importados do formulário</h2>
              <div className="step-panel-callout">{data.observacao_padrao}</div>
              <div className="key-value" style={{ marginTop: 14 }}>
                <div>
                  <strong>Usuário autenticado</strong>
                  <div>{session?.nome ?? "-"}</div>
                </div>
                <div>
                  <strong>Gestor responsável</strong>
                  <div>{data.responsavel_preenchimento ?? "-"}</div>
                </div>
                <div>
                  <strong>Telefone do gestor</strong>
                  <div className="mono">{data.telefone_responsavel ?? "-"}</div>
                </div>
                <div>
                  <strong>E-mail do gestor</strong>
                  <div>{data.email_responsavel ?? "-"}</div>
                </div>
                <div>
                  <strong>Número oficial da campanha</strong>
                  <div className="mono">{data.numero_agente_oficial ?? "-"}</div>
                </div>
                <div>
                  <strong>Link oficial do WhatsApp</strong>
                  <div className="mono mono-wrap">{data.url_canal_oficial ?? "-"}</div>
                </div>
              </div>
            </article>

            <article className="card manager-info-card">
              <h2 className="section-title">Leitura operacional</h2>
              <div className="step-panel-callout">
                O QR Code exibido na tela do candidato deve ser configurado no telefone oficial da
                campanha para associar o número ao Agente Político. Todo eleitor captado por
                qualquer canal deve ser direcionado para esse contato no WhatsApp.
              </div>
              {data.qr_code_url ? (
                <div className="manager-qr-panel">
                  <strong>QR Code oficial da campanha</strong>
                  <Image
                    alt={`QR Code oficial de ${data.nome_urna}`}
                    className="qr-image"
                    height={220}
                    src={data.qr_code_url}
                    unoptimized
                    width={220}
                  />
                </div>
              ) : null}
              <ul className="manager-checklist">
                <li>Número oficial da campanha validado no produto</li>
                <li>QR Code pronto para eventos, site e material gráfico</li>
                <li>Canais de divulgação apontando para o WhatsApp oficial</li>
                <li>Gestor da campanha responsável pelas alterações e aprovações</li>
              </ul>
            </article>
          </section>

          <section className="card">
            <h2 className="section-title">Configurar canal oficial e divulgação</h2>
            <form action={registerCampaignChannelAction} className="manager-auth-form">
              <input name="idCandidato" type="hidden" value={idCandidato} />
              <input name="tipo_canal" type="hidden" value="whatsapp_agente" />
              <div className="step-form-grid">
                <label className="step-note">
                  <span>Nome do canal oficial</span>
                  <input
                    className="step-input"
                    defaultValue={`Agente Político ${data.nome_urna}`}
                    name="nome_canal"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Número oficial da campanha</span>
                  <input
                    className="step-input"
                    defaultValue={data.numero_agente_oficial ?? ""}
                    name="identificador_externo"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Link oficial derivado automaticamente</span>
                  <input
                    className="step-input"
                    defaultValue={
                      data.url_canal_oficial ??
                      (data.numero_agente_oficial ? `https://wa.me/${data.numero_agente_oficial}` : "")
                    }
                    disabled
                    type="text"
                  />
                </label>
              </div>

              <div className="manager-channel-box">
                <strong>Canais de divulgação</strong>
                <p className="muted">
                  Marque os canais que serão utilizados para divulgar o QR Code e o número oficial
                  do Agente Político.
                </p>
                <div className="manager-channel-options">
                  {data.canais_divulgacao.map((channel) => (
                    <label
                      className="manager-channel-option"
                      key={`${channel.tipo_canal}-${channel.nome_canal}`}
                    >
                      <input
                        defaultChecked={channel.selecionado_por_padrao}
                        name="canais_divulgacao_item"
                        type="checkbox"
                        value={JSON.stringify({
                          nome_canal: channel.nome_canal,
                          tipo_canal: channel.tipo_canal,
                          url_canal: channel.url_canal,
                          identificador_externo: channel.identificador_externo,
                          status: channel.status
                        })}
                      />
                      <span>
                        <strong>{channel.nome_canal}</strong>
                        <small className="muted">
                          {channel.url_canal ?? channel.identificador_externo ?? "-"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="step-note">
                <span>Sugerir novos canais de divulgação</span>
                <textarea
                  className="step-textarea"
                  name="canais_divulgacao_extra"
                  placeholder="Ex.: comitês regionais, influenciadores locais, carro de som, panfletagem com QR Code e novos perfis sociais."
                  rows={3}
                />
              </label>

              <label className="step-note">
                <span>Observação do gestor</span>
                <textarea
                  className="step-textarea"
                  defaultValue={data.observacao_padrao}
                  name="observacao"
                  rows={4}
                />
              </label>

              <div className="actions">
                <button className="button" type="submit">
                  Registrar canal oficial
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
