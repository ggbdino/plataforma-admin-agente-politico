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
