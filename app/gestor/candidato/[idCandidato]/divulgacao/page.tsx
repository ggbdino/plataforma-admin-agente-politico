import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  createOutreachTaskAction,
  importOutreachTeamMembersAction,
  recordOutreachEvidenceAction
} from "@/lib/actions/campaign-outreach-action";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { getOutreachTeamContext } from "@/lib/repositories/campaign-outreach-team";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type OutreachPageProps = {
  params: Promise<{ idCandidato: string }>;
  searchParams?: Promise<{ feedback?: string; mensagem?: string }>;
};

const taskTypes = [
  ["inserir_contatos", "Inserir novos contatos"],
  ["convidar_eventos", "Convidar para eventos"],
  ["captar_eleitores", "Captar eleitores"],
  ["visitar_locais", "Visitar locais"],
  ["participar_reunioes", "Participar de reuniões"],
  ["panfletar", "Panfletar"],
  ["divulgar_localidade", "Divulgar em localidade"],
  ["outros", "Outras ações"]
] as const;

export default async function OutreachTeamPage({ params, searchParams }: OutreachPageProps) {
  const { idCandidato } = await params;
  const query = searchParams ? await searchParams : undefined;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_implantar");
  const canManage = Boolean(session && ["gestor_campanha", "administrador"].includes(session.perfil) && hasAccess);

  if (!canManage) {
    redirect(`/gestor/candidato/${idCandidato}?feedback=erro&mensagem=${encodeURIComponent("A Equipe de Divulgação é restrita ao gestor da campanha e ao administrador.")}`);
  }

  const context = await getOutreachTeamContext(idCandidato);
  if (!context) {
    notFound();
  }

  const redirectTo = `/gestor/candidato/${idCandidato}/divulgacao`;
  const activeMembers = context.membros.filter((member) => member.status === "ativo");

  return (
    <main className="page-shell">
      {query?.feedback && query?.mensagem ? (
        <section className={`feedback-banner ${query.feedback === "sucesso" ? "ok" : "error"}`}>
          <strong>{query.feedback === "sucesso" ? "Operação concluída." : "Falha operacional."}</strong>
          <div style={{ marginTop: 6 }}>{query.mensagem}</div>
        </section>
      ) : null}

      <section className="hero-card">
        <span className="pill">Equipe de Divulgação</span>
        <h1 className="title">Mobilização territorial da campanha</h1>
        <p className="subtitle">
          Importe a equipe de divulgação, crie tarefas de campo e acompanhe a realização por membro a partir das evidências validadas pela gestão e pelas conversas do WhatsApp do candidato.
        </p>
        <div className="hero-meta">
          <span className="pill">Candidato {context.nome_urna}</span>
          <span className="pill">Usuário {session?.nome ?? session?.email}</span>
          <span className="pill">Perfil {session?.perfil}</span>
          <span className="pill">{APP_VERSION}</span>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}`}>
            Voltar para a área do gestor
          </Link>
          <Link className="button secondary" href={`/campanhas/${idCandidato}/inteligencia`}>
            Inteligência da campanha
          </Link>
          <Link className="button secondary" href={`/gestor/candidato/${idCandidato}/eventos/gestao`}>
            Eventos da campanha
          </Link>
        </div>
      </section>

      <section className="grid grid-4" style={{ marginBottom: 20 }}>
        {renderMetric("Membros ativos", context.resumo.membros_ativos, `${context.resumo.total_membros} no cadastro`)}
        {renderMetric("Tarefas ativas", context.resumo.tarefas_ativas, `${context.resumo.tarefas_concluidas} concluída(s)`)}
        {renderMetric("Realização média", `${formatPercent(context.resumo.percentual_realizacao_medio)}`, "Média das tarefas")}
        {renderMetric("WhatsApp oficial", context.numero_agente_oficial ?? "Não definido", "Canal de validação")}
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">IDs técnicos das tarefas para teste n8n</h2>
            <p className="subtitle">
              Use estes identificadores no campo <span className="mono">taskId</span> do workflow 22b ou na validação automática das evidências recebidas pelo WhatsApp.
            </p>
          </div>
          <span className="pill">Teste operacional</span>
        </div>
        {context.tarefas.length > 0 ? (
          <div className="key-value">
            {context.tarefas.map((task) => (
              <div key={task.id}>
                <strong>{task.titulo}</strong>
                <span className="mono mono-wrap">{task.id}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="step-panel-callout">Crie uma tarefa de mobilização para exibir o ID técnico usado pelo n8n.</div>
        )}
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Importar equipe</h2>
              <p className="subtitle">Envie um CSV com nome, telefone, e-mail, cidade, UF, bairro, grupo e papel.</p>
            </div>
            <span className="pill">CSV</span>
          </div>
          <form action={importOutreachTeamMembersAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <input name="origemImportacao" type="hidden" value="gestor_divulgacao" />
            <label className="step-note">
              <span>Arquivo da Equipe de Divulgação</span>
              <input className="step-input" name="arquivoEquipe" type="file" accept=".csv,text/csv" required />
            </label>
            <button className="button" type="submit">Importar equipe</button>
          </form>
          <div className="step-panel-callout" style={{ marginTop: 14 }}>
            A importação atualiza membros já cadastrados pelo telefone e preserva o histórico de tarefas e evidências.
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Criar tarefa de mobilização</h2>
              <p className="subtitle">Defina a ação, a meta, o território e os membros responsáveis.</p>
            </div>
            <span className="pill">Gestão</span>
          </div>
          <form action={createOutreachTaskAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <label className="step-note">
              <span>Título da tarefa</span>
              <input className="step-input" name="titulo" placeholder="Ex.: Convidar moradores do Guará para reunião" required />
            </label>
            <div className="grid grid-2">
              <label className="step-note">
                <span>Tipo de ação</span>
                <select className="step-input" name="tipoTarefa" defaultValue="captar_eleitores">
                  {taskTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="step-note">
                <span>Meta total</span>
                <input className="step-input" name="metaQuantidade" type="number" min="0" defaultValue="0" />
              </label>
            </div>
            <label className="step-note">
              <span>Descrição operacional</span>
              <textarea className="step-input" name="descricao" rows={4} placeholder="Oriente o que deve ser feito e como a equipe deve relatar a execução." />
            </label>
            <div className="grid grid-4">
              <label className="step-note">
                <span>Localidade</span>
                <input className="step-input" name="localidade" />
              </label>
              <label className="step-note">
                <span>Cidade</span>
                <input className="step-input" name="cidade" />
              </label>
              <label className="step-note">
                <span>UF</span>
                <input className="step-input" name="uf" maxLength={2} />
              </label>
              <label className="step-note">
                <span>Prazo</span>
                <input className="step-input" name="dataLimite" type="datetime-local" />
              </label>
            </div>
            <label className="step-note">
              <span>Membros responsáveis</span>
              <select className="step-input" name="membroId" multiple size={Math.min(Math.max(activeMembers.length, 3), 8)}>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.nome} {member.cidade ? `- ${member.cidade}` : ""}</option>
                ))}
              </select>
            </label>
            <div className="step-panel-callout">Sem seleção manual, a tarefa será atribuída a todos os membros ativos.</div>
            <button className="button" type="submit" disabled={activeMembers.length === 0}>Criar tarefa</button>
          </form>
        </article>
      </section>

      <section className="card analytics-panel" style={{ marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">Tarefas da Equipe de Divulgação</h2>
            <p className="subtitle">Acompanhamento consolidado das ações, metas e evidências registradas.</p>
          </div>
          <span className="pill ok">{context.tarefas.length} tarefa(s)</span>
        </div>
        {context.tarefas.length > 0 ? (
          <div className="analytics-stack">
            {context.tarefas.map((task, index) => (
              <div className="analytics-bar-row" key={task.id}>
                <div className="analytics-bar-label">
                  <strong>{task.titulo}</strong>
                  <span className="muted">
                    {labelTaskType(task.tipo_tarefa)} | {task.total_membros} membro(s) | {task.realizado_total}/{task.meta_quantidade || 0} realizado(s) | {labelStatus(task.status)}
                  </span>
                  <div className="step-panel-callout" style={{ marginTop: 8 }}>
                    ID técnico para n8n: <span className="mono mono-wrap">{task.id}</span>
                  </div>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: `${Math.max(Math.min(task.percentual_realizacao, 100), 4)}%`, background: getColor(index) }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="step-panel-callout">Nenhuma tarefa de divulgação criada para esta campanha.</div>
        )}
      </section>

      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Validar evidência</h2>
              <p className="subtitle">Use esta área para registrar manualmente uma realização informada por WhatsApp, reunião ou conferência da gestão.</p>
            </div>
            <span className="pill">Auditoria</span>
          </div>
          <form action={recordOutreachEvidenceAction} className="manager-auth-form">
            <input name="idCandidato" type="hidden" value={idCandidato} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <label className="step-note">
              <span>Tarefa</span>
              <select className="step-input" name="taskId" required>
                <option value="">Selecione uma tarefa</option>
                {context.tarefas.map((task) => <option key={task.id} value={task.id}>{task.titulo}</option>)}
              </select>
            </label>
            <label className="step-note">
              <span>Membro</span>
              <select className="step-input" name="memberId" required>
                <option value="">Selecione um membro</option>
                {context.membros.map((member) => <option key={member.id} value={member.id}>{member.nome}</option>)}
              </select>
            </label>
            <label className="step-note">
              <span>Quantidade validada</span>
              <input className="step-input" name="quantidadeValidada" type="number" min="1" defaultValue="1" />
            </label>
            <label className="step-note">
              <span>Mensagem ou evidência</span>
              <textarea className="step-input" name="mensagem" rows={4} placeholder="Ex.: Membro confirmou 12 convites enviados no grupo de WhatsApp." />
            </label>
            <button className="button" type="submit" disabled={context.tarefas.length === 0 || context.membros.length === 0}>Registrar evidência</button>
          </form>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Validação por WhatsApp</h2>
              <p className="subtitle">Modelo operacional para a próxima automação no n8n.</p>
            </div>
            <span className="pill">Preparado</span>
          </div>
          <div className="step-panel-callout">
            As conversas do WhatsApp do candidato devem identificar o membro, a tarefa mencionada, a quantidade realizada e a evidência textual. O registro alimenta a mesma trilha de validação exibida nesta página e na Inteligência da Campanha.
          </div>
          <div className="key-value" style={{ marginTop: 14 }}>
            <div><strong>Canal</strong><span>WhatsApp do candidato</span></div>
            <div><strong>Validação</strong><span>Evidência por membro e tarefa</span></div>
            <div><strong>Resultado</strong><span>Atualização do nível de realização</span></div>
          </div>
        </article>
      </section>

      <section className="card analytics-panel">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Desempenho por membro</h2>
            <p className="subtitle">Leitura individual da Equipe de Divulgação para avaliação do trabalho de campo.</p>
          </div>
          <span className="pill">{context.membros.length} membro(s)</span>
        </div>
        <div className="responsive-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Território</th>
                <th>Grupo</th>
                <th>Tarefas</th>
                <th>Realização</th>
              </tr>
            </thead>
            <tbody>
              {context.membros.map((member) => (
                <tr key={member.id}>
                  <td><strong>{member.nome}</strong><br /><span className="muted">{member.papel ?? "Membro"}</span></td>
                  <td>{member.telefone ?? "-"}</td>
                  <td>{[member.cidade, member.uf].filter(Boolean).join("/") || member.bairro || "-"}</td>
                  <td>{member.grupo ?? "-"}</td>
                  <td>{member.tarefas_concluidas}/{member.total_tarefas}</td>
                  <td>
                    <div className="analytics-bar-track">
                      <div className="analytics-bar-fill" style={{ width: `${Math.max(Math.min(member.percentual_realizacao, 100), member.total_tarefas > 0 ? 4 : 0)}%` }} />
                    </div>
                    <span className="muted">{formatPercent(member.percentual_realizacao)}</span>
                  </td>
                </tr>
              ))}
              {context.membros.length === 0 ? (
                <tr><td colSpan={6}>Importe a Equipe de Divulgação para iniciar a gestão das ações.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function renderMetric(label: string, value: string | number, hint: string) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="muted">{hint}</span>
    </article>
  );
}

function labelTaskType(value: string) {
  return taskTypes.find(([key]) => key === value)?.[1] ?? "Outras ações";
}

function labelStatus(value: string) {
  const labels: Record<string, string> = {
    ativa: "Ativa",
    planejada: "Planejada",
    concluida: "Concluída",
    cancelada: "Cancelada",
    pendente: "Pendente",
    em_andamento: "Em andamento"
  };
  return labels[value] ?? value;
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function getColor(index: number) {
  const colors = ["#1d8fe3", "#36c2a5", "#ff7a59", "#9b72f2", "#f5b833", "#e8548b", "#2563eb", "#14b8a6"];
  return colors[index % colors.length];
}