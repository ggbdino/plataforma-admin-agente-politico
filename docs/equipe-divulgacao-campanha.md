# Equipe de Divulgação da Campanha - V22.0.0

## Objetivo

A funcionalidade cria uma camada operacional para o Gestor da Campanha importar membros da Equipe de Divulgação, atribuir tarefas de mobilização e acompanhar o nível de realização das ações na Inteligência da Campanha.

## Perfis

- Gestor da campanha: importa a equipe, cria tarefas, valida evidências e acompanha desempenho.
- Administrador: pode acessar a mesma rotina quando houver permissão de implantação para o candidato.
- Analista: visualiza os indicadores consolidados na Inteligência da Campanha quando tiver permissão de KPI, sem criar tarefas.

## Importação da equipe

Arquivo CSV aceito na página `/gestor/candidato/[idCandidato]/divulgacao`.

Colunas recomendadas:

```csv
nome,telefone,email,cidade,uf,bairro,grupo,papel
Maria Silva,61999990000,maria@email.com,Brasília,DF,Asa Norte,Lideranças,Coordenadora
```

O telefone é usado para atualizar membros já existentes sem apagar histórico de tarefas ou evidências.

## Tipos de tarefa

- Inserir novos contatos.
- Convidar para eventos.
- Captar eleitores.
- Visitar locais.
- Participar de reuniões.
- Panfletar.
- Divulgar campanha em localidade.
- Outras ações.

## Validação por WhatsApp e n8n

A plataforma expõe o endpoint abaixo para o workflow do WhatsApp/n8n registrar evidências extraídas das conversas do candidato:

`POST /api/campanhas/[idCandidato]/divulgacao/evidencias`

Cabeçalhos:

```http
Authorization: Bearer <OUTREACH_EVIDENCE_API_KEY>
```

Corpo exemplo:

```json
{
  "taskId": "uuid-da-tarefa",
  "telefone": "5561999990000",
  "mensagem": "Confirmo que convidei 12 moradores para a reunião no Guará.",
  "quantidadeValidada": 12,
  "canal": "whatsapp",
  "origem": "n8n-whatsapp"
}
```

A variável `OUTREACH_EVIDENCE_API_KEY` deve ser configurada no serviço `plataforma_admin` antes de ativar o registro automático. Sem essa variável, a API retorna 503 e não grava evidências.

## Inteligência da Campanha

A página de Inteligência passa a apresentar:

- Membros ativos e total de membros da Equipe de Divulgação.
- Tarefas ativas, concluídas e realização média.
- Barras de realização das tarefas.
- Desempenho individual por membro, com tarefas concluídas e percentual de realização.

## Próximo avanço recomendado

Criar ou ajustar o workflow n8n de WhatsApp do candidato para classificar mensagens de membros da equipe, identificar tarefa, quantidade e evidência, e chamar o endpoint de evidências com a chave configurada.
## Workflows n8n individualizados - V22.1.0

O pacote de implantação por candidato passa a gerar o fluxo `22b_divulgacao_evidencias_{slug}_{id}.json`.

Arquivos gerados para a base atual:

- `22b_divulgacao_evidencias_brunex_0001.json`
- `22b_divulgacao_evidencias_eri-castro_1313.json`
- `22b_divulgacao_evidencias_ricardo-vale_ricardo-vale.json`

Cada fluxo possui um webhook dedicado:

- `agente-politico/0001/divulgacao/evidencias`
- `agente-politico/1313/divulgacao/evidencias`
- `agente-politico/ricardo-vale/divulgacao/evidencias`

Variáveis exigidas no n8n:

```env
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

O workflow `22b` deve ser chamado pelo fluxo de WhatsApp/classificação do próprio candidato quando uma conversa indicar realização de tarefa da Equipe de Divulgação.
## Integração com conversas do funil - V22.2.0

Os fluxos `02b` de WhatsApp/Meta e Datafy passaram a ter uma ramificação paralela para detectar evidências explícitas da Equipe de Divulgação sem interromper o atendimento normal do eleitor.

A mensagem recebida só aciona o registro quando houver um identificador de tarefa em formato UUID, por exemplo:

```text
Tarefa b7645ed6-d713-4f18-bdeb-23a195e93470: convidei 8 moradores para a reunião.
```

O fluxo `02b` extrai:

- `taskId`: UUID informado na mensagem ou em `taskId/tarefaId` no payload.
- `telefone`: número do remetente normalizado para o padrão brasileiro com DDI 55.
- `quantidade`: número informado junto de termos como quantidade, contatos, convites, visitas ou realizado; quando não houver número claro, usa 1.
- `mensagem`: texto original recebido no WhatsApp/Datafy.

Depois da detecção, o próprio `02b` chama o webhook individualizado `22b` do candidato, que mantém a validação por chave e grava a evidência na plataforma.

Variáveis exigidas no serviço n8n que executa os fluxos `02b` e `22b`:

```env
N8N_WEBHOOK_BASE_URL=https://n8n-n8n-start.kb0fgy.easypanel.host
PLATAFORMA_ADMIN_BASE_URL=https://n8n-plataforma-admin.kb0fgy.easypanel.host
OUTREACH_EVIDENCE_API_KEY=<mesma chave configurada no plataforma_admin>
```

Use `N8N_WEBHOOK_BASE_URL` sem `/webhook` no final. O fluxo acrescenta `/webhook/agente-politico/{idCandidato}/divulgacao/evidencias` automaticamente.
