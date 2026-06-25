import { db } from "@/lib/db";
import type { CandidateListItem } from "@/lib/types";

export async function listCandidates(): Promise<CandidateListItem[]> {
  await ensureImplantationQrColumns();

  const result = await db.query<CandidateListItem>(
    `
      select
        c.id_candidato,
        c.nome_urna,
        c.numero_tre_tse,
        c.nome_completo,
        c.partido,
        c.cargo_disputado,
        c.estado,
        ic.status_implantacao,
        ic.instancia_evolution,
        ic.numero_agente_oficial,
        coalesce(
          official.metadata ->> 'qr_code_url',
          case
            when official.url_canal is not null and btrim(official.url_canal) <> ''
              then 'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' || replace(official.url_canal, '&', '%26')
            else ic.qr_code_url
          end
        ) as qr_code_url,
        ic.pairing_qr_code_url,
        ic.evolution_connection_status,
        ic.atualizado_em::text as implantacao_atualizada_em,
        coalesce(stats.total_etapas, 0) as total_etapas,
        coalesce(stats.etapas_concluidas, 0) as etapas_concluidas,
        coalesce(stats.etapas_com_erro, 0) as etapas_com_erro,
        stats.proxima_etapa,
        manager_update.executado_em::text as ultima_atualizacao_gestora_em,
        manager_update.resumo as ultima_atualizacao_gestora_resumo
      from candidatos c
      left join implantacoes_candidato ic
        on ic.id_candidato = c.id_candidato
      left join lateral (
        select
          ci.url_canal,
          ci.metadata
        from canais_integracao ci
        where ci.id_candidato = c.id_candidato
          and ci.tipo_canal = 'whatsapp_agente'
        order by ci.atualizado_em desc
        limit 1
      ) official on true
      left join lateral (
        select
          count(*)::int as total_etapas,
          count(*) filter (where iec.status_etapa = 'concluida')::int as etapas_concluidas,
          count(*) filter (where iec.status_etapa = 'com_erro')::int as etapas_com_erro,
          (
            select nome_etapa
            from implantacao_etapas_candidato next_step
            where next_step.id_candidato = c.id_candidato
              and next_step.status_etapa <> 'concluida'
            order by next_step.ordem
            limit 1
          ) as proxima_etapa
        from implantacao_etapas_candidato iec
        where iec.id_candidato = c.id_candidato
      ) stats on true
      left join lateral (
        select
          ei.iniciado_em as executado_em,
          coalesce(
            ei.payload_enviado ->> 'observacao',
            iec.mensagem_status,
            'Atualizacao registrada pela gestora'
          ) as resumo
        from execucoes_implantacao ei
        join implantacao_etapas_candidato iec
          on iec.id = ei.etapa_id
        where ei.id_candidato = c.id_candidato
          and iec.codigo_etapa = 'configurar_canais'
          and ei.origem = 'gestor_campanha'
        order by ei.iniciado_em desc
        limit 1
      ) manager_update on true
      where c.nome_urna is not null
        and btrim(c.nome_urna) <> ''
      order by
        lower(coalesce(nullif(btrim(c.nome_urna), ''), c.nome_completo, c.id_candidato)),
        c.id_candidato
    `
  );

  return result.rows;
}

async function ensureImplantationQrColumns() {
  await db.query(`
    alter table implantacoes_candidato
      add column if not exists pairing_qr_code_url text,
      add column if not exists evolution_connection_code text,
      add column if not exists evolution_pairing_code text,
      add column if not exists evolution_connection_status text
  `);
}
