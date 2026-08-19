# Saneamento de Versionamento e OperaÃƒÂ§ÃƒÂ£o

## SituaÃƒÂ§ÃƒÂ£o atual

- O repositÃƒÂ³rio Git ativo estÃƒÂ¡ em `n8n-agente-politico/plataforma-admin`.
- O remoto configurado ÃƒÂ© `https://github.com/ggbdino/plataforma-admin-agente-politico.git`.
- As pastas `n8n-agente-politico/workflows`, `n8n-agente-politico/docs` e `n8n-agente-politico/deploy` estÃƒÂ£o fora do repositÃƒÂ³rio Git atual.
- Isso faz com que parte das mudanÃƒÂ§as da operaÃƒÂ§ÃƒÂ£o fique sem histÃƒÂ³rico de commit, especialmente:
  - JSONs de workflows do n8n
  - exemplos de ambiente do n8n
  - documentaÃƒÂ§ÃƒÂ£o operacional fora da aplicaÃƒÂ§ÃƒÂ£o

## Impacto prÃƒÂ¡tico

- Uma release da `plataforma-admin` pode ser implantada sem que os workflows correspondentes estejam rastreados no mesmo histÃƒÂ³rico.
- Ajustes manuais no n8n, Meta, Google Sheets e Easypanel podem funcionar no ambiente, mas ficar sem trilha de auditoria.
- Em caso de restauraÃƒÂ§ÃƒÂ£o, troca de servidor ou nova campanha, a reconstruÃƒÂ§ÃƒÂ£o do ambiente fica mais lenta e sujeita a erro.

## DecisÃƒÂ£o recomendada

Adotar duas camadas de controle:

1. `plataforma-admin` continua como repositÃƒÂ³rio de aplicaÃƒÂ§ÃƒÂ£o.
2. Os artefatos operacionais externos passam a ser espelhados periodicamente para dentro do repositÃƒÂ³rio.

## O que deve ser versionado junto da aplicaÃƒÂ§ÃƒÂ£o

- snapshots dos workflows ativos do n8n;
- exemplos de variÃƒÂ¡veis de ambiente;
- checklists de implantaÃƒÂ§ÃƒÂ£o;
- documentaÃƒÂ§ÃƒÂ£o de credenciais e integraÃƒÂ§ÃƒÂµes;
- roteiros de onboarding por candidato;
- referÃƒÂªncia da planilha usada na sincronizaÃƒÂ§ÃƒÂ£o.

## Fluxo recomendado de release

1. Ajustar cÃƒÂ³digo da `plataforma-admin`.
2. Ajustar workflows no n8n.
3. Exportar ou copiar os workflows atualizados para snapshot local.
4. Atualizar documentaÃƒÂ§ÃƒÂ£o operacional se houver nova dependÃƒÂªncia manual.
5. Incrementar a versÃƒÂ£o da aplicaÃƒÂ§ÃƒÂ£o em `lib/version.ts` e `package.json`/`package-lock.json`.
6. Validar localmente ou no ambiente de homologaÃƒÂ§ÃƒÂ£o.
7. Executar:
   - `git add .`
   - `git commit -m "fix: vX.Y.Z descriÃƒÂ§ÃƒÂ£o"`
   - `git push`
8. No Easypanel, executar rebuild manual do serviÃƒÂ§o `plataforma-admin` apÃƒÂ³s o `git push`. O serviÃƒÂ§o nÃƒÂ£o usa auto-deploy por decisÃƒÂ£o operacional, para permitir acompanhamento da instalaÃƒÂ§ÃƒÂ£o.
9. Registrar data, versÃƒÂ£o e observaÃƒÂ§ÃƒÂµes no histÃƒÂ³rico operacional.

## Release atual

- `V22.3.3`: incorpora os arquivos oficiais de logos partidarias em `public/partidos` e reativa a exibicao das marcas nas paginas publicas de confirmacao de eventos, mantendo fallback por sigla quando o partido nao tiver arquivo mapeado.

- `V22.3.2`: corrige exibicao das logos nas paginas publicas de confirmacao de eventos. A logo da GAP passa a ser carregada diretamente do diretorio publico e a legenda partidaria usa fallback por sigla enquanto nao houver arquivo oficial em `public/partidos`. Reforca que o dominio publico dos eventos e uma configuracao global da plataforma, nao uma configuracao por evento.

- `V22.3.1`: corrige links publicos de eventos, exibindo URL completa nas telas de gestao e presenca, preservando links antigos/absolutos e mostrando mensagem de confirmacao encerrada em vez de 404 quando o evento existe.

- `V22.3.0`: adiciona evidencias naturais da Equipe de Divulgacao. Os fluxos `02b` passam a detectar frases operacionais sem UUID, como `contatei 5 novos numeros em Taguatinga`, e o endpoint da plataforma associa a evidencia a tarefa ativa do membro por telefone, tipo de acao e territorio para auditoria posterior.

- `V22.2.2`: corrige o acionamento do `22b` pelos fluxos `02b`, enviando o payload de evidencia como objeto JSON e usando fallback para o webhook de producao quando a variavel `N8N_WEBHOOK_BASE_URL` nao estiver disponivel no executor do n8n.

- `V22.2.1`: corrige a detecÃƒÂ§ÃƒÂ£o de evidÃƒÂªncias no `02b` Datafy para reconhecer os campos reais `chatInput` e `phone`, garantindo a chamada automÃƒÂ¡tica ao `22b`.

- `V22.2.0`: integra os fluxos `02b` de WhatsApp/Datafy com o workflow `22b`, detectando evidÃƒÂªncias explÃƒÂ­citas de tarefas da Equipe de DivulgaÃƒÂ§ÃƒÂ£o nas conversas e acionando o registro automÃƒÂ¡tico por candidato.

- `V22.1.2`: destaca os IDs tÃƒÂ©cnicos das tarefas da Equipe de DivulgaÃƒÂ§ÃƒÂ£o em bloco prÃƒÂ³prio para teste operacional no n8n e no fluxo de validaÃƒÂ§ÃƒÂ£o por WhatsApp.

- `V22.1.1`: corrige registro de evidÃƒÂªncias da Equipe de DivulgaÃƒÂ§ÃƒÂ£o garantindo vÃƒÂ­nculo entre tarefa e membro, atualizaÃƒÂ§ÃƒÂ£o transacional do percentual e exibiÃƒÂ§ÃƒÂ£o do ID da tarefa para testes no n8n.

- `V22.1.0`: adiciona o workflow n8n individualizado `22b` para registrar evidÃƒÂªncias da Equipe de DivulgaÃƒÂ§ÃƒÂ£o por candidato, gerando os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.2`: remove URL/token tÃƒÂ©cnico da tela do gestor de SMS e associa automaticamente o webhook n8n individualizado do candidato pela plataforma.

- `V21.1.1`: inclui o workflow n8n SMS individualizado (`21b`) no pacote de geraÃƒÂ§ÃƒÂ£o por candidato e gera os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.0`: padroniza a remessa SMS por candidato, com gateway, chave, remetente e limite prÃƒÂ³prios, preservando fallback global apenas para homologaÃƒÂ§ÃƒÂ£o e mantendo os custos vinculados ao contrato do candidato.

- `V20.0.1`: hotfix de implantaÃƒÂ§ÃƒÂ£o que corrige o checksum tÃƒÂ©cnico do `package-lock.json` e mantÃƒÂ©m a funcionalidade de remessa WhatsApp por padrÃƒÂ£o de mensagem.
- `V20.0.0`: adiciona remessa WhatsApp por padrÃƒÂ£o de mensagem para celulares de eleitores cadastrados na base do candidato, mantendo template aprovado da Meta, auditoria e rebuild manual no Easypanel.

## Procedimento mÃƒÂ­nimo para sincronizar workflows externos

O script `scripts/snapshot-workflows.ps1` copia os arquivos JSON da pasta externa `..\workflows` para `plataforma-admin\external-workflows-snapshot`.

Isso nÃƒÂ£o substitui a exportaÃƒÂ§ÃƒÂ£o oficial do n8n quando houver alteraÃƒÂ§ÃƒÂ£o dentro da interface, mas reduz o risco de perder o estado dos fluxos que jÃƒÂ¡ estÃƒÂ£o salvos no workspace.

## PendÃƒÂªncias estruturais

- Consolidar, no futuro, um repositÃƒÂ³rio raiz para `n8n-agente-politico` inteiro.
- Definir se `workflows` serÃƒÂ¡ mantido:
  - dentro do mesmo repositÃƒÂ³rio da aplicaÃƒÂ§ÃƒÂ£o; ou
  - em um repositÃƒÂ³rio operacional separado.
- Criar um checklist ÃƒÂºnico para:
  - Meta Cloud API
  - Google Sheets OAuth
  - n8n start/webhook/worker
  - Easypanel
  - Postgres

## Estado confirmado nesta auditoria

- ÃƒÅ¡ltima release encontrada no repositÃƒÂ³rio Git da aplicaÃƒÂ§ÃƒÂ£o:
  - `fix: v14.5.8 ajusta chamada do webhook de sincronizacao`
- NÃƒÂ£o foram encontradas alteraÃƒÂ§ÃƒÂµes locais pendentes dentro do repositÃƒÂ³rio `plataforma-admin` no momento desta auditoria.
