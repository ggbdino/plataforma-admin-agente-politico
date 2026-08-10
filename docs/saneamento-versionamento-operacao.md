# Saneamento de Versionamento e Operação

## Situação atual

- O repositório Git ativo está em `n8n-agente-politico/plataforma-admin`.
- O remoto configurado é `https://github.com/ggbdino/plataforma-admin-agente-politico.git`.
- As pastas `n8n-agente-politico/workflows`, `n8n-agente-politico/docs` e `n8n-agente-politico/deploy` estão fora do repositório Git atual.
- Isso faz com que parte das mudanças da operação fique sem histórico de commit, especialmente:
  - JSONs de workflows do n8n
  - exemplos de ambiente do n8n
  - documentação operacional fora da aplicação

## Impacto prático

- Uma release da `plataforma-admin` pode ser implantada sem que os workflows correspondentes estejam rastreados no mesmo histórico.
- Ajustes manuais no n8n, Meta, Google Sheets e Easypanel podem funcionar no ambiente, mas ficar sem trilha de auditoria.
- Em caso de restauração, troca de servidor ou nova campanha, a reconstrução do ambiente fica mais lenta e sujeita a erro.

## Decisão recomendada

Adotar duas camadas de controle:

1. `plataforma-admin` continua como repositório de aplicação.
2. Os artefatos operacionais externos passam a ser espelhados periodicamente para dentro do repositório.

## O que deve ser versionado junto da aplicação

- snapshots dos workflows ativos do n8n;
- exemplos de variáveis de ambiente;
- checklists de implantação;
- documentação de credenciais e integrações;
- roteiros de onboarding por candidato;
- referência da planilha usada na sincronização.

## Fluxo recomendado de release

1. Ajustar código da `plataforma-admin`.
2. Ajustar workflows no n8n.
3. Exportar ou copiar os workflows atualizados para snapshot local.
4. Atualizar documentação operacional se houver nova dependência manual.
5. Incrementar a versão da aplicação em `lib/version.ts` e `package.json`/`package-lock.json`.
6. Validar localmente ou no ambiente de homologação.
7. Executar:
   - `git add .`
   - `git commit -m "fix: vX.Y.Z descrição"`
   - `git push`
8. No Easypanel, executar rebuild manual do serviço `plataforma-admin` após o `git push`. O serviço não usa auto-deploy por decisão operacional, para permitir acompanhamento da instalação.
9. Registrar data, versão e observações no histórico operacional.

## Release atual

- `V22.1.1`: corrige registro de evidências da Equipe de Divulgação garantindo vínculo entre tarefa e membro, atualização transacional do percentual e exibição do ID da tarefa para testes no n8n.

- `V22.1.0`: adiciona o workflow n8n individualizado `22b` para registrar evidências da Equipe de Divulgação por candidato, gerando os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.2`: remove URL/token técnico da tela do gestor de SMS e associa automaticamente o webhook n8n individualizado do candidato pela plataforma.

- `V21.1.1`: inclui o workflow n8n SMS individualizado (`21b`) no pacote de geração por candidato e gera os artefatos atuais para Brunex, Eri Castro e Ricardo Vale.

- `V21.1.0`: padroniza a remessa SMS por candidato, com gateway, chave, remetente e limite próprios, preservando fallback global apenas para homologação e mantendo os custos vinculados ao contrato do candidato.

- `V20.0.1`: hotfix de implantação que corrige o checksum técnico do `package-lock.json` e mantém a funcionalidade de remessa WhatsApp por padrão de mensagem.
- `V20.0.0`: adiciona remessa WhatsApp por padrão de mensagem para celulares de eleitores cadastrados na base do candidato, mantendo template aprovado da Meta, auditoria e rebuild manual no Easypanel.

## Procedimento mínimo para sincronizar workflows externos

O script `scripts/snapshot-workflows.ps1` copia os arquivos JSON da pasta externa `..\workflows` para `plataforma-admin\external-workflows-snapshot`.

Isso não substitui a exportação oficial do n8n quando houver alteração dentro da interface, mas reduz o risco de perder o estado dos fluxos que já estão salvos no workspace.

## Pendências estruturais

- Consolidar, no futuro, um repositório raiz para `n8n-agente-politico` inteiro.
- Definir se `workflows` será mantido:
  - dentro do mesmo repositório da aplicação; ou
  - em um repositório operacional separado.
- Criar um checklist único para:
  - Meta Cloud API
  - Google Sheets OAuth
  - n8n start/webhook/worker
  - Easypanel
  - Postgres

## Estado confirmado nesta auditoria

- Última release encontrada no repositório Git da aplicação:
  - `fix: v14.5.8 ajusta chamada do webhook de sincronizacao`
- Não foram encontradas alterações locais pendentes dentro do repositório `plataforma-admin` no momento desta auditoria.
