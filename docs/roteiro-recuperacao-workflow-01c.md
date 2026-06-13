# Roteiro de Recuperação do Workflow 01c

## Objetivo

Restabelecer o fluxo `01c_sync_candidato_webhook_incremental` para sincronizar candidatos a partir da planilha Google sem depender da lista visual do n8n.

## Arquivos de referência

- Workflow de recovery:
  - `..\workflows\01c_sync_candidato_webhook_incremental_recovery.json`
- Snapshot local:
  - `external-workflows-snapshot\01c_sync_candidato_webhook_incremental_recovery.json`

## Dados fixos da planilha

- Documento:
  - `Dados dos Políticos`
- Spreadsheet ID:
  - `1c9uVQ4uKoz1Q_nDHlhTEGl6rjDrguIgMxamRR9yyt5M`
- Aba de leitura:
  - `Respostas ao formulário 1`
- GID da aba de leitura:
  - `215487439`
- Aba de log:
  - `log_intake_candidato`
- GID da aba de log:
  - `390030896`

## Passo a passo no n8n

1. Importe o arquivo `01c_sync_candidato_webhook_incremental_recovery.json`.
2. Abra o node `Ler Planilha via Webhook`.
3. Vincule a credencial ativa `Google Sheets account`.
4. Confirme se os campos aparecem assim:
   - `Document`: `Dados dos Políticos`
   - `Sheet`: `Respostas ao formulário 1`
5. Se a lista visual falhar:
   - ajuste `Document` para `By ID`
   - valor: `1c9uVQ4uKoz1Q_nDHlhTEGl6rjDrguIgMxamRR9yyt5M`
   - ajuste `Sheet` para `By ID`
   - valor: `215487439`
6. Repita o mesmo no node `Ler Planilha via Agendamento`.
7. No node `Log de Sincronização`, confirme:
   - `Document`: mesmo spreadsheet ID
   - `Sheet`: `log_intake_candidato` ou `390030896`
8. Salve o workflow.
9. Execute primeiro o node `Ler Planilha via Webhook`.
10. Se ele funcionar, execute o workflow completo a partir do webhook ou do cron.

## O que significa o erro atual

Erro:

`Can not get sheet 'undefined' with a value of 'undefined'`

Leitura prática:

- o n8n não conseguiu resolver a aba;
- isso normalmente ocorre quando `Document` ou `Sheet` ficou salvo com modo inválido;
- também pode acontecer se a credencial ativa não estiver realmente aplicada ao node correto.

## Teste mínimo esperado

Quando o node `Ler Planilha via Webhook` estiver correto, ele deve retornar pelo menos as linhas da aba `Respostas ao formulário 1`, incluindo os campos:

- `Nome do Candidato`
- `Número no TRE/TSE`
- `Telefone direto do candidato?`

## Se ainda falhar

Se, mesmo com os IDs acima, o node continuar retornando `undefined`, a saída recomendada é substituir os 3 nodes `Google Sheets` por `HTTP Request` contra a Google Sheets API. Isso elimina a dependência do seletor visual interno do n8n.
