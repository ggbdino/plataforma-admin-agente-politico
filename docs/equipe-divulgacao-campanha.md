# Equipe de DivulgaÃƒÂ§ÃƒÂ£o da Campanha - V22.0.0

## Objetivo

A funcionalidade cria uma camada operacional para o Gestor da Campanha importar membros da Equipe de DivulgaÃƒÂ§ÃƒÂ£o, atribuir tarefas de mobilizaÃƒÂ§ÃƒÂ£o e acompanhar o nÃƒÂ­vel de realizaÃƒÂ§ÃƒÂ£o das aÃƒÂ§ÃƒÂµes na InteligÃƒÂªncia da Campanha.

## Perfis

- Gestor da campanha: importa a equipe, cria tarefas, valida evidÃƒÂªncias e acompanha desempenho.
- Administrador: pode acessar a mesma rotina quando houver permissÃƒÂ£o de implantaÃƒÂ§ÃƒÂ£o para o candidato.
- Analista: visualiza os indicadores consolidados na InteligÃƒÂªncia da Campanha quando tiver permissÃƒÂ£o de KPI, sem criar tarefas.

## ImportaÃƒÂ§ÃƒÂ£o da equipe

Arquivo CSV aceito na pÃƒÂ¡gina `/gestor/candidato/[idCandidato]/divulgacao`.

Colunas recomendadas:

```csv
nome,telefone,email,cidade,uf,bairro,grupo,papel
Maria Silva,61999990000,maria@email.com,BrasÃƒÂ­lia,DF,Asa Norte,LideranÃƒÂ§as,Coordenadora
```

O telefone ÃƒÂ© usado para atualizar membros jÃƒÂ¡ existentes sem apagar histÃƒÂ³rico de tarefas ou evidÃƒÂªncias.

## Tipos de tarefa

- Inserir novos contatos.
- Convidar para eventos.
- Captar eleitores.
- Visitar locais.
- Participar de reuniÃƒÂµes.
- Panfletar.
- Divulgar campanha em localidade.
- Outras aÃƒÂ§ÃƒÂµes.

## ValidaÃƒÂ§ÃƒÂ£o por WhatsApp e n8n

A plataforma expÃƒÂµe o endpoint abaixo para o workflow do WhatsApp/n8n registrar evidÃƒÂªncias extraÃƒÂ­das das conversas do candidato:

`POST /api/campanhas/[idCandidato]/divulgacao/evidencias`

CabeÃƒÂ§alhos:

```http
Authorization: Bearer <OUTREACH_EVIDENCE_API_KEY>
```

Corpo exemplo:

```json
{
  "taskId": "uuid-da-tarefa",
  "telefone": "5561999990000",
  "mensagem": "Confirmo que convidei 12 moradores para a reuniÃƒÂ£o no GuarÃƒÂ¡.",
  "quantidadeValidada": 12,
  "canal": "whatsapp",
  "origem": "n8n-whatsapp"
}
```

A variÃƒÂ¡vel `OUTREACH_EVIDENCE_API_KEY` deve ser configurada no serviÃƒÂ§o `plataforma_admin` antes de ativar o registro automÃƒÂ¡tico. Sem essa variÃƒÂ¡vel, a API retorna 503 e nÃƒÂ£o grava evidÃƒÂªncias.

## InteligÃƒÂªncia da Campanha

A pÃƒÂ¡gina de InteligÃƒÂªncia passa a apresentar:

- Membros ativos e total de membros da Equipe de DivulgaÃƒÂ§ÃƒÂ£o.
- Tarefas ativas, concluÃƒÂ­das e realizaÃƒÂ§ÃƒÂ£o mÃƒÂ©dia.
- Barras de realizaÃƒÂ§ÃƒÂ£o das tarefas.
- Desempenho individual por membro, com tarefas concluÃƒÂ­das e percentual de realizaÃƒÂ§ÃƒÂ£o.

## PrÃƒÂ³ximo avanÃƒÂ§o recomendado

Criar ou ajustar o workflow n8n de WhatsApp do candidato para classificar mensagens de membros da equipe, identificar tarefa, quantidade e evidÃƒÂªncia, e chamar o endpoint de evidÃƒÂªncias com a chave configurada.
## Workflows n8n individualizados - V22.1.0

O pacote de implantaÃƒÂ§ÃƒÂ£o por candidato passa a gerar o fluxo `22b_divulgacao_evidencias_{slug}_{id}.json`.

Arquivos gerados para a base atual:

- `22b_divulgacao_evidencias_brunex_0001.json`
- `22b_divulgacao_evidencias_eri-castro_1313.json`
- `22b_divulgacao_evidencias_ricardo-vale_ricardo-vale.json`

Cada fluxo possui um webhook dedicado:

- `agente-politico/0001/divulgacao/evidencias`
- `agente-politico/1313/divulgacao/evidencias`
- `agente-politico/ricardo-vale/divulgacao/evidencias`

VariÃƒÂ¡veis exigidas no n8n:

```env
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

O workflow `22b` deve ser chamado pelo fluxo de WhatsApp/classificaÃƒÂ§ÃƒÂ£o do prÃƒÂ³prio candidato quando uma conversa indicar realizaÃƒÂ§ÃƒÂ£o de tarefa da Equipe de DivulgaÃƒÂ§ÃƒÂ£o.
## IntegraÃƒÂ§ÃƒÂ£o com conversas do funil - V22.2.0

Os fluxos `02b` de WhatsApp/Meta e Datafy passaram a ter uma ramificaÃƒÂ§ÃƒÂ£o paralela para detectar evidÃƒÂªncias explÃƒÂ­citas da Equipe de DivulgaÃƒÂ§ÃƒÂ£o sem interromper o atendimento normal do eleitor.

A mensagem recebida sÃƒÂ³ aciona o registro quando houver um identificador de tarefa em formato UUID, por exemplo:

```text
Tarefa b7645ed6-d713-4f18-bdeb-23a195e93470: convidei 8 moradores para a reuniÃƒÂ£o.
```

O fluxo `02b` extrai:

- `taskId`: UUID informado na mensagem ou em `taskId/tarefaId` no payload.
- `telefone`: nÃƒÂºmero do remetente normalizado para o padrÃƒÂ£o brasileiro com DDI 55.
- `quantidade`: nÃƒÂºmero informado junto de termos como quantidade, contatos, convites, visitas ou realizado; quando nÃƒÂ£o houver nÃƒÂºmero claro, usa 1.
- `mensagem`: texto original recebido no WhatsApp/Datafy.

Depois da detecÃƒÂ§ÃƒÂ£o, o prÃƒÂ³prio `02b` chama o webhook individualizado `22b` do candidato, que mantÃƒÂ©m a validaÃƒÂ§ÃƒÂ£o por chave e grava a evidÃƒÂªncia na plataforma.

VariÃƒÂ¡veis exigidas no serviÃƒÂ§o n8n que executa os fluxos `02b` e `22b`:

```env
N8N_WEBHOOK_BASE_URL=https://n8n-n8n-start.kb0fgy.easypanel.host
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

Use `N8N_WEBHOOK_BASE_URL` sem `/webhook` no final. O fluxo acrescenta `/webhook/agente-politico/{idCandidato}/divulgacao/evidencias` automaticamente.
### Hotfix V22.2.1

O detector dos fluxos `02b` tambÃƒÂ©m reconhece os campos `chatInput` e `phone`, usados pelo Datafy Chat em execuÃƒÂ§ÃƒÂ£o real. Com isso, mensagens como `Tarefa <uuid>: convidei 8 moradores...` passam a acionar corretamente o `22b` mesmo quando a entrada nÃƒÂ£o vier nos campos padronizados `mensagem_eleitor` e `telefone`.

### Hotfix V22.2.2

O acionamento do `22b` pelos fluxos `02b` passa a enviar o payload de evidencia como objeto JSON e usa `https://n8n-n8n-start.kb0fgy.easypanel.host/webhook` como fallback quando `N8N_WEBHOOK_BASE_URL` nao estiver disponivel no executor do n8n. A variavel continua recomendada para ambientes futuros, mas deixa de bloquear o teste atual.

## Evidencias naturais por conversa - V22.3.0

A Equipe de Divulgacao nao precisa informar o ID tecnico da tarefa em campo. O membro pode enviar mensagens naturais ao WhatsApp do candidato, por exemplo: `contatei 5 novos numeros em Taguatinga` ou `convidei 3 moradores para a reuniao`. O `02b` detecta o padrao operacional, chama o `22b` e a plataforma associa a evidencia a uma tarefa ativa do membro pelo telefone, tipo da acao e territorio. Quando houver ambiguidade, a evidencia e rejeitada para validacao manual, preservando a trilha de auditoria.
