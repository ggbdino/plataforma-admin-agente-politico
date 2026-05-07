import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  authenticateCampaignManagerAction,
  registerCampaignChannelAction
} from "@/lib/actions/campaign-manager-action";
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
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(`manager-access-${idCandidato}`)?.value === "ok";
  const data = await getCampaignManagerContext(idCandidato);

  if (!data) {
    notFound();
  }

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section
          className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}
        >
          <strong>{query.feedback === "sucesso" ? "Operacao concluida." : "Acesso ou registro falhou."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Gestor da campanha</span>
        <h1 className="title">Canal oficial e divulgacao da campanha</h1>
        <p className="subtitle">
          Area reservada para o Gestor da Campanha revisar dados vindos do formulario de
          entrada, ajustar o canal oficial do Agente Politico e registrar os canais de
          divulgacao que apontam para esse WhatsApp.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/candidatos/${idCandidato}`}>
            Voltar para implantacao
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="card manager-auth-card">
          <h2 className="section-title">Liberar acesso do Gestor da Campanha</h2>
          <p className="subtitle">
            Informe o numero do gestor da campanha ou a senha mestra <span className="mono">654321</span>.
          </p>
          <form action={authenticateCampaignManagerAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <label className="step-note">
              <span>Senha de acesso</span>
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
              <h2 className="section-title">Dados importados do formulario</h2>
              <div className="step-panel-callout">{data.observacao_padrao}</div>
              <div className="key-value" style={{ marginTop: 14 }}>
                <div>
                  <strong>Gestor responsavel</strong>
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
                  <strong>Numero oficial da campanha</strong>
                  <div className="mono">{data.numero_agente_oficial ?? "-"}</div>
                </div>
                <div>
                  <strong>Link oficial do WhatsApp</strong>
                  <div className="mono mono-wrap">{data.url_canal_oficial ?? "-"}</div>
                </div>
                <div>
                  <strong>Origem dos canais de divulgacao</strong>
                  <div>{data.canais_divulgacao_origem ?? "-"}</div>
                </div>
              </div>
            </article>

            <article className="card manager-info-card">
              <h2 className="section-title">Leitura operacional</h2>
              <div className="step-panel-callout">
                O QR Code exibido na tela do candidato deve ser configurado no telefone oficial da
                campanha para associar o numero ao Agente Politico. Todo eleitor captado por
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
                  <div className="muted">
                    Este mesmo QR Code pode ser reutilizado se a gestora trocar o aparelho da
                    campanha, desde que a leitura seja feita no telefone oficial vinculado ao
                    Agente Politico.
                  </div>
                </div>
              ) : null}
              <ul className="manager-checklist">
                <li>Numero oficial da campanha validado no nosso produto</li>
                <li>QR Code pronto para eventos, site e material grafico</li>
                <li>Canais de divulgacao apontando para o WhatsApp oficial</li>
                <li>Gestor da campanha responsavel pelas alteracoes e aprovacoes</li>
              </ul>
            </article>
          </section>

          <section className="card">
            <h2 className="section-title">Configurar canal oficial e divulgacao</h2>
            <form action={registerCampaignChannelAction} className="manager-auth-form">
              <input name="idCandidato" type="hidden" value={idCandidato} />
              <input name="tipo_canal" type="hidden" value="whatsapp_agente" />
              <div className="step-form-grid">
                <label className="step-note">
                  <span>Nome do canal oficial</span>
                  <input
                    className="step-input"
                    defaultValue={`Agente Politico ${data.nome_urna}`}
                    name="nome_canal"
                    type="text"
                  />
                </label>
                <label className="step-note">
                  <span>Numero oficial da campanha</span>
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
                    defaultValue={data.url_canal_oficial ?? (data.numero_agente_oficial ? `https://wa.me/${data.numero_agente_oficial}` : "")}
                    disabled
                    type="text"
                  />
                </label>
              </div>

              <div className="manager-channel-box">
                <strong>Canais de divulgacao</strong>
                <p className="muted">
                  Marque os canais que serao utilizados para divulgar o QR Code e o numero oficial
                  do Agente Politico.
                </p>
                <div className="manager-channel-options">
                  {data.canais_divulgacao.map((channel) => (
                    <label className="manager-channel-option" key={`${channel.tipo_canal}-${channel.nome_canal}`}>
                      <input
                        defaultChecked={channel.selecionado_por_padrao}
                        name="canais_divulgacao_item"
                        type="checkbox"
                        value={`${channel.nome_canal} (${channel.tipo_canal})${channel.url_canal ? ` - ${channel.url_canal}` : ""}`}
                      />
                      <span>
                        <strong>{channel.nome_canal}</strong>
                        <small className="muted">{channel.url_canal ?? channel.identificador_externo ?? "-"}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="step-note">
                <span>Sugerir novos canais de divulgacao</span>
                <textarea
                  className="step-textarea"
                  name="canais_divulgacao_extra"
                  placeholder="Ex.: comites regionais, influenciadores locais, carro de som, panfletagem com QR Code, novos perfis sociais ou parceiros de divulgacao."
                  rows={3}
                />
              </label>

              <label className="step-note">
                <span>Observacao do gestor</span>
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
