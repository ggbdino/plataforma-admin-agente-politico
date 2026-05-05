type ImplantationStatusPillProps = {
  status: string | null;
};

const LABELS: Record<string, string> = {
  ativo: "Ativo",
  concluida: "Concluida",
  em_preparacao: "Em preparacao",
  em_andamento: "Em andamento",
  nao_iniciado: "Nao iniciado",
  com_erro: "Com erro"
};

export function ImplantationStatusPill({ status }: ImplantationStatusPillProps) {
  const normalized = status ?? "nao_iniciado";
  const className = normalized === "com_erro" ? "pill warn" : "pill ok";

  return <span className={className}>{LABELS[normalized] ?? normalized}</span>;
}
