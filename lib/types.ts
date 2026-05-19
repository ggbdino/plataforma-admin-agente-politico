export type CandidateListItem = {
  id_candidato: string;
  nome_urna: string;
  nome_completo: string;
  partido: string;
  cargo_disputado: string;
  estado: string | null;
  status_implantacao: string | null;
  instancia_evolution: string | null;
  numero_agente_oficial: string | null;
  qr_code_url: string | null;
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
  partido: string;
  cargo_disputado: string;
  estado: string | null;
  status_implantacao: string;
  ambiente: string | null;
  instancia_evolution: string | null;
  numero_agente_oficial: string | null;
  webhook_inbound_url: string | null;
  webhook_outbound_url: string | null;
  qr_code_url: string | null;
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

export type CampaignThemeMetric = {
  tema: string;
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
  periodoSelecionadoDias: number;
  funil: CampaignStageMetric[];
  origens: CampaignOriginMetric[];
  temas: CampaignThemeMetric[];
  evolucaoDiaria: CampaignDailyMetric[];
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
  };
  campanhas: AdminCampaignStatItem[];
  rankings: {
    conversao: AdminRankingItem[];
    atividade_24h: AdminRankingItem[];
    cobertura_meta: AdminRankingItem[];
  };
};
