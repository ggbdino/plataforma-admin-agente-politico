# Workflows por candidato

## Objetivo

Padronizar a geração do pacote de workflows específicos por candidato, mantendo isolamento de inbound, cadência, governança, eventos/KPI e QR Code.

## Pacote obrigatório

Cada candidato da base deve possuir os seguintes snapshots:

1. `02a_meta_webhook_verify_<slug>_<id>.json`
2. `02b_funil_eleitor_<slug>_<id>.json`
3. `04b_cadencia_<slug>_<id>.json`
4. `05b_governanca_<slug>_<id>.json`
5. `06b_participacao_eventos_<slug_underscore>_<id>.json`
6. `07_qrcode_canais_agentes_<slug_underscore>_<id>.json`

Observacoes:

- `06b` é individual por candidato, porque confirmacoes, presencas e conversas de evento precisam impactar apenas os KPIs daquela campanha.
- `slug` pode usar hifen; `slug_underscore` deve usar `_` quando o nome do workflow seguir esse padrao.

## Geracao automatizada

Com o manifesto default:

```powershell
Set-Location "C:\Desktop\FORMAÇÃO PÓS DOUTORADO\Política\Tratamento dos Dados\n8n-agente-politico\plataforma-admin"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\generate-candidate-workflows.ps1
```

Saidas:

- atualiza `..\workflows`
- atualiza `.\external-workflows-snapshot`

## Manifesto de candidatos

Arquivo base:

- [candidatos-workflows.json](/C:/Desktop/FORMAÇÃO%20PÓS%20DOUTORADO/Política/Tratamento%20dos%20Dados/n8n-agente-politico/plataforma-admin/scripts/candidatos-workflows.json)

Estrutura:

```json
[
  {
    "id": "0001",
    "nome": "Brunex",
    "slug": "brunex",
    "slug_underscore": "brunex"
  }
]
```
