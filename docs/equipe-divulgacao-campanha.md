# Equipe de DivulgaÃ§Ã£o da Campanha - V22.0.0

## Objetivo

A funcionalidade cria uma camada operacional para o Gestor da Campanha importar membros da Equipe de DivulgaÃ§Ã£o, atribuir tarefas de mobilizaÃ§Ã£o e acompanhar o nÃ­vel de realizaÃ§Ã£o das aÃ§Ãµes na InteligÃªncia da Campanha.

## Perfis

- Gestor da campanha: importa a equipe, cria tarefas, valida evidÃªncias e acompanha desempenho.
- Administrador: pode acessar a mesma rotina quando houver permissÃ£o de implantaÃ§Ã£o para o candidato.
- Analista: visualiza os indicadores consolidados na InteligÃªncia da Campanha quando tiver permissÃ£o de KPI, sem criar tarefas.

## ImportaÃ§Ã£o da equipe

Arquivo CSV aceito na pÃ¡gina `/gestor/candidato/[idCandidato]/divulgacao`.

Colunas recomendadas:

```csv
nome,telefone,email,cidade,uf,bairro,grupo,papel
Maria Silva,61999990000,maria@email.com,BrasÃ­lia,DF,Asa Norte,LideranÃ§as,Coordenadora
```

O telefone Ã© usado para atualizar membros jÃ¡ existentes sem apagar histÃ³rico de tarefas ou evidÃªncias.

## Tipos de tarefa

- Inserir novos contatos.
- Convidar para eventos.
- Captar eleitores.
- Visitar locais.
- Participar de reuniÃµes.
- Panfletar.
- Divulgar campanha em localidade.
- Outras aÃ§Ãµes.

## ValidaÃ§Ã£o por WhatsApp e n8n

A plataforma expÃµe o endpoint abaixo para o workflow do WhatsApp/n8n registrar evidÃªncias extraÃ­das das conversas do candidato:

`POST /api/campanhas/[idCandidato]/divulgacao/evidencias`

CabeÃ§alhos:

```http
Authorization: Bearer <OUTREACH_EVIDENCE_API_KEY>
```

Corpo exemplo:

```json
{
  "taskId": "uuid-da-tarefa",
  "telefone": "5561999990000",
  "mensagem": "Confirmo que convidei 12 moradores para a reuniÃ£o no GuarÃ¡.",
  "quantidadeValidada": 12,
  "canal": "whatsapp",
  "origem": "n8n-whatsapp"
}
```

A variÃ¡vel `OUTREACH_EVIDENCE_API_KEY` deve ser configurada no serviÃ§o `plataforma_admin` antes de ativar o registro automÃ¡tico. Sem essa variÃ¡vel, a API retorna 503 e nÃ£o grava evidÃªncias.

## InteligÃªncia da Campanha

A pÃ¡gina de InteligÃªncia passa a apresentar:

- Membros ativos e total de membros da Equipe de DivulgaÃ§Ã£o.
- Tarefas ativas, concluÃ­das e realizaÃ§Ã£o mÃ©dia.
- Barras de realizaÃ§Ã£o das tarefas.
- Desempenho individual por membro, com tarefas concluÃ­das e percentual de realizaÃ§Ã£o.

## PrÃ³ximo avanÃ§o recomendado

Criar ou ajustar o workflow n8n de WhatsApp do candidato para classificar mensagens de membros da equipe, identificar tarefa, quantidade e evidÃªncia, e chamar o endpoint de evidÃªncias com a chave configurada.
## Workflows n8n individualizados - V22.1.0

O pacote de implantaÃ§Ã£o por candidato passa a gerar o fluxo `22b_divulgacao_evidencias_{slug}_{id}.json`.

Arquivos gerados para a base atual:

- `22b_divulgacao_evidencias_brunex_0001.json`
- `22b_divulgacao_evidencias_eri-castro_1313.json`
- `22b_divulgacao_evidencias_ricardo-vale_ricardo-vale.json`

Cada fluxo possui um webhook dedicado:

- `agente-politico/0001/divulgacao/evidencias`
- `agente-politico/1313/divulgacao/evidencias`
- `agente-politico/ricardo-vale/divulgacao/evidencias`

VariÃ¡veis exigidas no n8n:

```env
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

O workflow `22b` deve ser chamado pelo fluxo de WhatsApp/classificaÃ§Ã£o do prÃ³prio candidato quando uma conversa indicar realizaÃ§Ã£o de tarefa da Equipe de DivulgaÃ§Ã£o.
## IntegraÃ§Ã£o com conversas do funil - V22.2.0

Os fluxos `02b` de WhatsApp/Meta e Datafy passaram a ter uma ramificaÃ§Ã£o paralela para detectar evidÃªncias explÃ­citas da Equipe de DivulgaÃ§Ã£o sem interromper o atendimento normal do eleitor.

A mensagem recebida sÃ³ aciona o registro quando houver um identificador de tarefa em formato UUID, por exemplo:

```text
Tarefa b7645ed6-d713-4f18-bdeb-23a195e93470: convidei 8 moradores para a reuniÃ£o.
```

O fluxo `02b` extrai:

- `taskId`: UUID informado na mensagem ou em `taskId/tarefaId` no payload.
- `telefone`: nÃºmero do remetente normalizado para o padrÃ£o brasileiro com DDI 55.
- `quantidade`: nÃºmero informado junto de termos como quantidade, contatos, convites, visitas ou realizado; quando nÃ£o houver nÃºmero claro, usa 1.
- `mensagem`: texto original recebido no WhatsApp/Datafy.

Depois da detecÃ§Ã£o, o prÃ³prio `02b` chama o webhook individualizado `22b` do candidato, que mantÃ©m a validaÃ§Ã£o por chave e grava a evidÃªncia na plataforma.

VariÃ¡veis exigidas no serviÃ§o n8n que executa os fluxos `02b` e `22b`:

```env
N8N_WEBHOOK_BASE_URL=https://n8n-n8n-start.kb0fgy.easypanel.host
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

Use `N8N_WEBHOOK_BASE_URL` sem `/webhook` no final. O fluxo acrescenta `/webhook/agente-politico/{idCandidato}/divulgacao/evidencias` automaticamente.
### Hotfix V22.2.1

O detector dos fluxos `02b` tambÃ©m reconhece os campos `chatInput` e `phone`, usados pelo Datafy Chat em execuÃ§Ã£o real. Com isso, mensagens como `Tarefa <uuid>: convidei 8 moradores...` passam a acionar corretamente o `22b` mesmo quando a entrada nÃ£o vier nos campos padronizados `mensagem_eleitor` e `telefone`.

### Hotfix V22.2.2

O acionamento do `22b` pelos fluxos `02b` passa a enviar o payload de evidencia como objeto JSON e usa `https://n8n-n8n-start.kb0fgy.easypanel.host/webhook` como fallback quando `N8N_WEBHOOK_BASE_URL` nao estiver disponivel no executor do n8n. A variavel continua recomendada para ambientes futuros, mas deixa de bloquear o teste atual.
