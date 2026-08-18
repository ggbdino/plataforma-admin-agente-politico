# Saneamento de Versionamento e OperaÃ§Ã£o

## SituaÃ§Ã£o atual

- O repositÃ³rio Git ativo estÃ¡ em `n8n-agente-politico/plataforma-admin`.
- O remoto configurado Ã© `https://github.com/ggbdino/plataforma-admin-agente-politico.git`.
- As pastas `n8n-agente-politico/workflows`, `n8n-agente-politico/docs` e `n8n-agente-politico/deploy` estÃ£o fora do repositÃ³rio Git atual.
- Isso faz com que parte das mudanÃ§as da operaÃ§Ã£o fique sem histÃ³rico de commit, especialmente:
  - JSONs de workflows do n8n
  - exemplos de ambiente do n8n
  - documentaÃ§Ã£o operacional fora da aplicaÃ§Ã£o

## Impacto prÃ¡tico

- Uma release da `plataforma-admin` pode ser implantada sem que os workflows correspondentes estejam rastreados no mesmo histÃ³rico.
- Ajustes manuais no n8n, Meta, Google Sheets e Easypanel podem funcionar no ambiente, mas ficar sem trilha de auditoria.
- Em caso de restauraÃ§Ã£o, troca de servidor ou nova campanha, a reconstruÃ§Ã£o do ambiente fica mais lenta e sujeita a erro.

## DecisÃ£o recomendada

Adotar duas camadas de controle:

1. `plataforma-admin` continua como repositÃ³rio de aplicaÃ§Ã£o.
2. Os artefatos operacionais externos passam a ser espelhados periodicamente para dentro do repositÃ³rio.

## O que deve ser versionado junto da aplicaÃ§Ã£o

- snapshots dos workflows ativos do n8n;
- exemplos de variÃ¡veis de ambiente;
- checklists de implantaÃ§Ã£o;
- documentaÃ§Ã£o de credenciais e integraÃ§Ãµes;
- roteiros de onboarding por candidato;
- referÃªncia da planilha usada na sincronizaÃ§Ã£o.

## Fluxo recomendado de release

1. Ajustar cÃ³digo da `plataforma-admin`.
2. Ajustar workflows no n8n.
3. Exportar ou copiar os workflows atualizados para snapshot local.
4. Atualizar documentaÃ§Ã£o operacional se houver nova dependÃªncia manual.
5. Incrementar a versÃ£o da aplicaÃ§Ã£o em `lib/version.ts` e `package.json`/`package-lock.json`.
6. Validar localmente ou no ambiente de homologaÃ§Ã£o.
7. Executar:
   - `git add .`
   - `git commit -m "fix: vX.Y.Z descriÃ§Ã£o"`
   - `git push`
8. No Easypanel, executar rebuild manual do serviÃ§o `plataforma-admin` apÃ³s o `git push`. O serviÃ§o nÃ£o usa auto-deploy por decisÃ£o operacional, para permitir acompanhamento da instalaÃ§Ã£o.
9. Registrar data, versÃ£o e observaÃ§Ãµes no histÃ³rico operacional.

## Release atual

- `V22.2.2`: corrige o acionamento do `22b` pelos fluxos `02b`, enviando o payload de evidencia como objeto JSON e usando fallback para o webhook de producao quando a variavel `N8N_WEBHOOK_BASE_URL` nao estiver disponivel no executor do n8n.

- `V22.2.1`: corrige a detecÃ§Ã£o de evidÃªncias no `02b` Datafy para reconhecer os campos reais `chatInput` e `phone`, garantindo a chamada automÃ¡tica ao `22b`.

- `V22.2.0`: integra os fluxos `02b` de WhatsApp/Datafy com o workflow `22b`, detectando evidÃªncias explÃ­citas de tarefas da Equipe de DivulgaÃ§Ã£o nas conversas e acionando o registro automÃ¡tico por candidato.

- `V22.1.2`: destaca os IDs tÃ©cnicos das tarefas da Equipe de DivulgaÃ§Ã£o em bloco prÃ³prio para teste operacional no n8n e no fluxo de validaÃ§Ã£o por WhatsApp.

- `V22.1.1`: corrige registro de evidÃªncias da Equipe de DivulgaÃ§Ã£o garantindo vÃ­nculo entre tarefa e membro, atualizaÃ§Ã£o transacional do percentual e exibiÃ§Ã£o do ID da tarefa para testes no n8n.

- `V22.1.0`: adiciona o workflow n8n individualizado `22b` para registrar evidÃªncias da Equipe de DivulgaÃ§Ã£o por candidato, gerando os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.2`: remove URL/token tÃ©cnico da tela do gestor de SMS e associa automaticamente o webhook n8n individualizado do candidato pela plataforma.

- `V21.1.1`: inclui o workflow n8n SMS individualizado (`21b`) no pacote de geraÃ§Ã£o por candidato e gera os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.0`: padroniza a remessa SMS por candidato, com gateway, chave, remetente e limite prÃ³prios, preservando fallback global apenas para homologaÃ§Ã£o e mantendo os custos vinculados ao contrato do candidato.

- `V20.0.1`: hotfix de implantaÃ§Ã£o que corrige o checksum tÃ©cnico do `package-lock.json` e mantÃ©m a funcionalidade de remessa WhatsApp por padrÃ£o de mensagem.
- `V20.0.0`: adiciona remessa WhatsApp por padrÃ£o de mensagem para celulares de eleitores cadastrados na base do candidato, mantendo template aprovado da Meta, auditoria e rebuild manual no Easypanel.

## Procedimento mÃ­nimo para sincronizar workflows externos

O script `scripts/snapshot-workflows.ps1` copia os arquivos JSON da pasta externa `..\workflows` para `plataforma-admin\external-workflows-snapshot`.

Isso nÃ£o substitui a exportaÃ§Ã£o oficial do n8n quando houver alteraÃ§Ã£o dentro da interface, mas reduz o risco de perder o estado dos fluxos que jÃ¡ estÃ£o salvos no workspace.

## PendÃªncias estruturais

- Consolidar, no futuro, um repositÃ³rio raiz para `n8n-agente-politico` inteiro.
- Definir se `workflows` serÃ¡ mantido:
  - dentro do mesmo repositÃ³rio da aplicaÃ§Ã£o; ou
  - em um repositÃ³rio operacional separado.
- Criar um checklist Ãºnico para:
  - Meta Cloud API
  - Google Sheets OAuth
  - n8n start/webhook/worker
  - Easypanel
  - Postgres

## Estado confirmado nesta auditoria

- Ãšltima release encontrada no repositÃ³rio Git da aplicaÃ§Ã£o:
  - `fix: v14.5.8 ajusta chamada do webhook de sincronizacao`
- NÃ£o foram encontradas alteraÃ§Ãµes locais pendentes dentro do repositÃ³rio `plataforma-admin` no momento desta auditoria.
