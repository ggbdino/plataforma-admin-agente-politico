export type CandidateListItem = {
  id_candidato: string;
  nome_urna: string;
  nome_completo: string;
  partido: string | null;
  cargo_disputado: string | null;
  estado: string | null;
  status_implantacao: string | null;
  instancia_evolution: string | null;
  numero_agente_oficial: string | null;
  qr_code_url: string | null;
  pairing_qr_code_url: string | null;
  evolution_connection_status: string | null;
  implantacao_atualizada_em: string | null;
  total_etapas: number;
  etapas_concluidas: number;
  etapas_com_erro: number;
  proxima_etapa: string | null;
  ultima_atualizacao_gestora_em: string | null;
  ultima_atualizacao_gestora_resumo: string | null;
};

export type ImplantationHeader = {
  id_candidato: string;
  nome_urna: string;
  nome_completo: string;
  partido: string | null;
  cargo_disputado: string | null;
  estado: string | null;
  status_implantacao: string;
  ambiente: string | null;
  instancia_evolution: string | null;
  numero_agente_oficial: string | null;
  webhook_inbound_url: string | null;
  webhook_outbound_url: string | null;
  qr_code_url: string | null;
  pairing_qr_code_url: string | null;
  evolution_connection_code: string | null;
  evolution_pairing_code: string | null;
  evolution_connection_status: string | null;
  observacoes: string | null;
  atualizado_em: string | null;
};

export type ImplantationStep = {
  codigo_etapa: string;
  nome_etapa: string;
  ordem: number;
  status_etapa: string;
  workflow_nome: string | null;
  webhook_path: string | null;
  executado_em: string | null;
  finalizado_em: string | null;
  mensagem_status: string | null;
  detalhes: Record<string, unknown> | null;
};

export type StepExecutionMode = "webhook" | "manual";

export type CampaignChannelOption = {
  nome_canal: string;
  tipo_canal: string;
  url_canal: string | null;
  identificador_externo: string | null;
  status: string;
  selecionado_por_padrao: boolean;
};

export type CampaignManagerContext = {
  id_candidato: string;
  nome_urna: string;
  telefone_responsavel: string | null;
  responsavel_preenchimento: string | null;
  email_responsavel: string | null;
  numero_agente_oficial: string | null;
  url_canal_oficial: string | null;
  qr_code_url: string | null;
  canais_divulgacao_origem: string | null;
  observacao_padrao: string;
  canais_divulgacao: CampaignChannelOption[];
};

export type CampaignEventAttendanceItem = {
  id: string;
  nome_evento: string;
  tipo_evento: string | null;
  data_evento: string;
  local_nome: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  total_confirmados: number;
  total_presentes: number;
};

export type CampaignEventAttendanceContext = {
  id_candidato: string;
  nome_urna: string;
  numero_agente_oficial: string | null;
  qr_code_url: string | null;
  eventos: CampaignEventAttendanceItem[];
};

export type CampaignActiveEventSnapshot = {
  ativo: boolean;
  evento: CampaignEventAttendanceItem | null;
};

export type CampaignAttendanceElectorLookup = {
  eleitor_uid: string;
  nome: string | null;
  telefone: string;
  cidade: string | null;
  uf: string | null;
};

export type ManagerUpdateSummary = {
  origem: string;
  status_execucao: string;
  executado_em: string | null;
  finalizado_em: string | null;
  observacao: string | null;
  resumo: string | null;
};

export type CampaignAnalyticsHeader = {
  id_candidato: string;
  nome_urna: string;
  nome_campanha: string | null;
  status_campanha: string | null;
  status_implantacao: string | null;
  cargo_disputado: string | null;
  partido: string | null;
  uf: string | null;
  numero_agente_oficial: string | null;
  meta_contatos_whatsapp: number | null;
  meta_conversao_votos: number | null;
};

export type CampaignAnalyticsSummary = {
  total_eleitores: number;
  leads_novos: number;
  leads_qualificados: number;
  leads_engajados: number;
  apoiadores: number;
  indecisos: number;
  opt_outs: number;
  interacoes_total: number;
  interacoes_24h: number;
  inbound_total: number;
  outbound_total: number;
  eventos_ativos: number;
  confirmacoes_evento: number;
  comparecimentos_evento: number;
  score_engajamento_medio: number;
  score_propensao_medio: number;
  taxa_conversao_percentual: number;
  meta_contatos_percentual: number;
};

export type CampaignPeriodSummary = {
  periodo_dias: number;
  novos_leads_periodo: number;
  interacoes_periodo: number;
  inbound_periodo: number;
  outbound_periodo: number;
  apoiadores_periodo: number;
  conversao_periodo_percentual: number;
};

export type CampaignGoalProgress = {
  meta_contatos_whatsapp: number;
  base_total_atual: number;
  gap_contatos: number;
  realizado_contatos_percentual: number;
  meta_conversao_votos: number;
  apoiadores_atuais: number;
  gap_conversao: number;
  realizado_conversao_percentual: number;
};

export type CampaignStageMetric = {
  etapa_funil: string;
  total: number;
};

export type CampaignOriginMetric = {
  origem_captacao: string;
  total: number;
};

export type CampaignDailyMetric = {
  data_referencia: string;
  novos_leads: number;
  interacoes: number;
};

export type CampaignBaseGrowthPoint = {
  data_referencia: string;
  total_acumulado: number;
};

export type CampaignThemeMetric = {
  tema: string;
  total: number;
};

export type CampaignRegionalMetric = {
  uf: string;
  cidade_destaque: string | null;
  total: number;
  apoiadores: number;
  taxa_conversao_percentual: number;
  cidades_mapeadas: number;
  total_cidade_destaque: number;
};

export type CampaignDataQualitySummary = {
  total_registros: number;
  sem_nome: number;
  sem_telefone: number;
  sem_email: number;
  duplicidades_telefone: number;
  sem_interacoes: number;
  sem_contato_30_dias: number;
  opt_outs: number;
  confiabilidade_percentual: number;
  email_disponivel: boolean;
};

export type CampaignFunnelHealthSummary = {
  leads_sem_contato_7_dias: number;
  qualificados_sem_contato_7_dias: number;
  engajados_sem_contato_14_dias: number;
  apoiadores_sem_contato_21_dias: number;
  leads_parados_total: number;
  semaforo_funil: "ok" | "warning" | "error";
};

export type CampaignOperationalAlert = {
  codigo: string;
  titulo: string;
  descricao: string;
  criticidade: "ok" | "warning" | "error";
  total: number;
};

export type CampaignRecentConversation = {
  eleitor_uid: string;
  eleitor_id: string;
  nome: string | null;
  telefone: string | null;
  origem_captacao: string | null;
  etapa_funil: string | null;
  sentimento: string | null;
  intencao_voto: string | null;
  score_engajamento: number | null;
  score_propensao_voto: number | null;
  ultimo_contato_em: string | null;
  canal_ultimo_contato: string | null;
  direcao_ultimo_contato: string | null;
  ultima_mensagem: string | null;
  total_interacoes: number;
};

export type CampaignConversationTimelineItem = {
  id: string;
  canal: string;
  direcao: string;
  mensagem: string | null;
  resposta_eleitor: string | null;
  tema_classificado: string | null;
  sentimento: string | null;
  intencao_voto: string | null;
  etapa_sugerida: string | null;
  risco_compliance: string | null;
  status_envio: string | null;
  criado_em: string;
};

export type CampaignConversationFilters = {
  busca: string;
  etapa: string;
  origem: string;
  sentimento: string;
};

export type CampaignConversationExplorer = {
  cabecalho: CampaignAnalyticsHeader;
  filtros: CampaignConversationFilters;
  opcoes: {
    etapas: string[];
    origens: string[];
    sentimentos: string[];
  };
  conversas: CampaignRecentConversation[];
  conversaSelecionada:
    | {
        resumo: CampaignRecentConversation;
        historico: CampaignConversationTimelineItem[];
      }
    | null;
};

export type CampaignAnalyticsSnapshot = {
  cabecalho: CampaignAnalyticsHeader;
  resumo: CampaignAnalyticsSummary;
  resumoPeriodo: CampaignPeriodSummary;
  metas: CampaignGoalProgress;
  qualidade: CampaignDataQualitySummary;
  saudeFunil: CampaignFunnelHealthSummary;
  alertas: CampaignOperationalAlert[];
  periodoSelecionadoDias: number;
  funil: CampaignStageMetric[];
  origens: CampaignOriginMetric[];
  temas: CampaignThemeMetric[];
  distribuicaoRegional: CampaignRegionalMetric[];
  evolucaoDiaria: CampaignDailyMetric[];
  crescimentoBase: CampaignBaseGrowthPoint[];
  conversasRecentes: CampaignRecentConversation[];
};

export type AdminCampaignStatItem = {
  id_candidato: string;
  nome_urna: string;
  nome_campanha: string | null;
  status_campanha: string | null;
  total_eleitores: number;
  leads_engajados: number;
  apoiadores: number;
  interacoes_total: number;
  interacoes_24h: number;
  taxa_conversao_percentual: number;
  score_engajamento_medio: number;
  meta_contatos_whatsapp: number | null;
  meta_conversao_votos: number | null;
  meta_contatos_percentual: number;
  meta_conversao_percentual: number;
  sem_nome: number;
  sem_telefone: number;
  sem_email: number;
  duplicidades_telefone: number;
  sem_interacoes: number;
  sem_contato_30_dias: number;
  confiabilidade_percentual: number;
};

export type AdminRankingItem = {
  id_candidato: string;
  nome_urna: string;
  valor: number;
  rotulo: string;
};

export type AdminCampaignStatsSnapshot = {
  totais: {
    campanhas: number;
    eleitores: number;
    interacoes: number;
    apoiadores: number;
    interacoes_24h: number;
    registros_sem_nome: number;
    registros_sem_telefone: number;
    registros_sem_email: number;
    duplicidades_telefone: number;
    registros_sem_interacoes: number;
    registros_sem_contato_30_dias: number;
    confiabilidade_media_percentual: number;
    email_disponivel: boolean;
  };
  campanhas: AdminCampaignStatItem[];
  rankings: {
    conversao: AdminRankingItem[];
    atividade_24h: AdminRankingItem[];
    cobertura_meta: AdminRankingItem[];
    confiabilidade: AdminRankingItem[];
  };
};

export type GovernanceAuditItem = {
  id: string;
  id_candidato: string | null;
  nome_urna: string | null;
  escopo: string;
  ator: string;
  categoria: string;
  acao: string;
  descricao: string;
  status: "sucesso" | "erro" | "aviso";
  origem: string | null;
  criado_em: string;
};

export type CampaignGovernanceSnapshot = {
  totais: {
    total_acoes: number;
    acoes_sucesso_7_dias: number;
    erros_30_dias: number;
    importacoes_30_dias: number;
    exportacoes_30_dias: number;
    recalculos_30_dias: number;
  };
  recentes: GovernanceAuditItem[];
};

export type AdminGovernanceCampaignItem = {
  id_candidato: string;
  nome_urna: string;
  total_acoes: number;
  erros_30_dias: number;
  importacoes_30_dias: number;
  exportacoes_30_dias: number;
  recalculos_30_dias: number;
  ultimo_evento_em: string | null;
  criticidade: "ok" | "warning" | "error";
};

export type AdminGovernanceSnapshot = {
  totais: {
    campanhas_auditadas: number;
    acoes_7_dias: number;
    erros_7_dias: number;
    importacoes_30_dias: number;
    exportacoes_30_dias: number;
    recalculos_30_dias: number;
  };
  campanhas: AdminGovernanceCampaignItem[];
  recentes: GovernanceAuditItem[];
};
