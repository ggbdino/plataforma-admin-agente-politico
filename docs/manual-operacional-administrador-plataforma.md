# Manual Operacional do Administrador da Plataforma

## Objetivo

Este manual orienta a equipe tecnica da GAP Consult na operacao administrativa da Plataforma Administrativa do Agente Politico.

O foco deste roteiro e permitir que tecnicos executem com seguranca as tarefas do administrador da plataforma, incluindo:

- acesso e controle de perfis
- sincronizacao de candidatos
- geracao de workflows por candidato
- importacao e ajuste dos workflows no n8n
- gestao de eventos e operacao de campanha
- saneamento administrativo e exclusao de dados
- diagnostico inicial de falhas

## Escopo de responsabilidade

### Administrador da plataforma

O perfil `administrador` possui visao global e pode:

- acessar a trilha administrativa completa
- sincronizar candidatos da planilha-base
- gerar pacotes de workflows por candidato
- revisar governanca consolidada
- excluir candidatos e dados vinculados
- criar usuarios e conceder permissoes
- acessar qualquer campanha da base

### Gestor de campanha

O perfil `gestor` deve ficar vinculado a um candidato especifico e pode:

- acessar apenas a campanha vinculada
- operar eventos, presencas e confirmacoes da propria campanha
- acompanhar indicadores e dados operacionais do proprio candidato
- cadastrar usuarios operacionais e analistas da propria campanha, quando essa permissao estiver habilitada

Nao deve visualizar:

- outras campanhas
- trilha global de governanca
- saneamento global da base

### Operador

O perfil `operador` deve ficar vinculado a um candidato especifico e pode:

- operar presenca em eventos
- consultar dados operacionais da campanha
- apoiar atendimento e relacionamento

Nao deve:

- excluir dados
- criar workflows
- acessar governanca global

### Analista

O perfil `analista` deve ficar vinculado a um candidato especifico e pode:

- consultar indicadores da campanha
- revisar eventos, eleitores, interacoes e conversoes
- apoiar leitura analitica da operacao

Nao deve:

- excluir dados
- alterar configuracoes globais
- operar campanhas de outros candidatos

## Arquitetura operacional resumida

O ecossistema atual esta dividido em quatro camadas:

1. `plataforma_admin`
   Painel administrativo web da GAP para governanca, usuarios, eventos e operacao.

2. `n8n_start`, `n8n_webhook` e `n8n_worker`
   Ambiente de automacao onde os workflows sao executados.

3. Banco de dados PostgreSQL
   Base central dos candidatos, eleitores, eventos, presencas, prompts, perfis e registros operacionais.

4. Servicos externos
   Meta Cloud API, Google Sheets e demais integracoes.

## Observacao importante sobre o env do servico `plataforma_admin`

Para a fase atual de geracao local dos workflows por candidato, **nao foi criada nenhuma variavel nova obrigatoria no env do servico `plataforma_admin`**.

Isso significa que:

- a nova etapa da Central de Workflows funciona com o ambiente atual
- a geracao dos arquivos acontece a partir do projeto local e da base
- nao e necessario incluir nova chave apenas para gerar o pacote local de workflows

Continuam sendo importantes no `plataforma_admin`:

- conexao com banco
- URLs internas da plataforma
- variaveis ja existentes de integracao administrativa

Atencao:

- ajustes da Meta Cloud API tendem a ocorrer principalmente no n8n e nos workflows
- ajustes de Google Sheets tendem a ocorrer na credencial do n8n
- a geracao local do pacote nao substitui a importacao manual no n8n

## Fluxo operacional padrao para novo candidato

Quando um novo candidato entrar na plataforma, o tecnico deve seguir esta sequencia:

1. confirmar se o candidato foi registrado corretamente na planilha-base
2. sincronizar candidatos na Central de Workflows
3. validar se o candidato apareceu na base da plataforma
4. gerar o pacote de workflows do candidato
5. importar os arquivos JSON gerados no ambiente n8n
6. ajustar credenciais, URLs e parametros especificos, se necessario
7. ativar os workflows do candidato
8. revisar canais, eventos, QR code e indicadores da campanha

## Rotina 1 - Sincronizar candidatos

### Onde executar

Na tela:

- `Central de workflows`

### Finalidade

Ler a planilha-base `Dados dos Politicos` e refletir novos candidatos ou alteracoes na base.

### Procedimento

1. abrir a Central de Workflows
2. localizar a etapa `Sincronizar candidatos`
3. acionar o botao `Sincronizar candidatos`
4. aguardar a mensagem de retorno
5. validar se o novo candidato apareceu na lista da base

### Resultado esperado

Mensagem semelhante a:

- `Sincronizacao de candidatos concluida`

### Se houver falha

Verificar:

- credencial Google Sheets no n8n
- documento correto da planilha
- aba correta da planilha
- webhook de sincronizacao configurado
- execucao do workflow `01c_sync_candidato_webhook_incremental_recovery`

## Rotina 2 - Gerar workflows por candidato

### Onde executar

Na tela:

- `Central de workflows`

### Finalidade

Criar localmente o pacote de workflows especificos do candidato usando os dados ja sincronizados na base.

### O que essa etapa gera

O pacote padrao inclui:

1. `02a_meta_webhook_verify_<slug>_<id>.json`
2. `02b_funil_eleitor_<slug>_<id>.json`
3. `04b_cadencia_<slug>_<id>.json`
4. `05b_governanca_<slug>_<id>.json`
5. `06b_participacao_eventos_<slug_underscore>_<id>.json`
6. `07_qrcode_canais_agentes_<slug_underscore>_<id>.json`

### Onde os arquivos sao gravados

No repositorio local:

- `C:\Desktop\FORMAÇÃO PÓS DOUTORADO\Política\Tratamento dos Dados\n8n-agente-politico\workflows`
- `C:\Desktop\FORMAÇÃO PÓS DOUTORADO\Política\Tratamento dos Dados\n8n-agente-politico\plataforma-admin\external-workflows-snapshot`

### Procedimento

1. na Central de Workflows, localizar o candidato desejado
2. acionar a etapa `Gerar workflows do candidato`
3. aguardar a mensagem de sucesso
4. conferir se os arquivos foram efetivamente criados nas pastas acima

### Importante

Essa etapa **nao importa automaticamente** os arquivos para o n8n.

Ela apenas:

- monta os JSONs padronizados
- grava os arquivos no repositorio local
- deixa o pacote pronto para importacao manual

## Rotina 3 - Importar os workflows no n8n

### Onde executar

No ambiente n8n.

### Procedimento

1. abrir o n8n
2. importar cada arquivo JSON gerado para o candidato
3. revisar o nome do workflow
4. revisar os webhooks
5. revisar credenciais
6. salvar
7. ativar o workflow

### Confirmacao operacional

Depois da importacao, os workflows:

- ficam visiveis no seu ambiente n8n
- podem ser editados manualmente
- continuam independentes por candidato

## Rotina 4 - Conferir dados especificos do candidato nos workflows

Ao revisar o pacote importado, verificar:

- `id_candidato`
- nome do candidato
- slug do candidato
- numero oficial da campanha, quando aplicavel
- identificadores de webhook
- IDs e rotas de eventos

### Regra importante

O workflow `06b` de participacao de eventos deve ser individual por candidato.

Motivo:

- confirmacoes
- presencas
- conversas do evento
- KPIs de conversao

Tudo isso precisa impactar apenas a campanha do candidato correspondente.

## Rotina 5 - Criacao de usuarios e permissoes

### Regra de cadastro

Perfis ligados a campanha devem ficar vinculados ao candidato.

Perfis:

- `gestor`
- `operador`
- `analista`

### Regra operacional

- `administrador` pode ter visao global
- `gestor`, `operador` e `analista` devem enxergar apenas a campanha vinculada

### Procedimento recomendado

1. criar usuario
2. definir perfil
3. vincular a campanha correta
4. revisar permissoes antes de salvar

### Boas praticas

- nunca conceder perfil global sem necessidade
- nao compartilhar conta administrativa
- revisar acessos de campanha a cada troca de equipe

## Rotina 6 - Gestao de eventos

### O que o gestor pode operar

- cadastro de eventos
- link publico de confirmacao
- tela de presenca
- modo telao
- visualizacao de participantes e presentes

### Regras principais

- confirmados: pessoas que registraram participacao antecipada no link publico do evento
- presentes: pessoas registradas na entrada ou confirmadas durante a janela operacional do evento

### Observacao de negocio

Cada evento deve afetar somente:

- base do candidato dono do evento
- presencas do candidato
- KPIs daquele candidato

## Rotina 7 - Exclusao administrativa de candidatos

### Quem pode executar

Apenas administrador.

### O que a exclusao deve remover

- candidato
- eleitores vinculados
- interacoes
- eventos
- presencas
- prompts
- perfis vinculados, quando aplicavel
- registros administrativos dependentes

### Boas praticas

1. confirmar se o candidato realmente deve ser excluido
2. verificar se nao ha dependencia operacional em andamento
3. executar exclusao unitario ou saneamento global apenas quando autorizado

## Rotina 8 - Meta Cloud API

### O que normalmente fica fora do `plataforma_admin`

Os ajustes da Meta costumam exigir:

- numero configurado na Meta
- token de acesso
- verify token
- phone number ID
- WABA ID
- webhook de entrada configurado no n8n

### Regra pratica

O `plataforma_admin` governa a operacao, mas o recebimento e envio de mensagens depende dos workflows e variaveis do ambiente n8n.

## Rotina 9 - Google Sheets

### Uso na plataforma

O fluxo de sincronizacao de candidatos depende da leitura da planilha:

- documento `Dados dos Politicos`

### Checklist

1. credencial OAuth ativa no n8n
2. documento correto informado no node Google Sheets
3. aba correta selecionada
4. acesso autorizado pelo Google
5. workflow `01c` ativo

### Sintoma comum

Erro:

- `Can not get sheet 'undefined' with a value of 'undefined'`

### Causa comum

- documento ou aba nao resolvidos corretamente no node
- credencial trocada
- referencia quebrada no node apos migracao

## Troubleshooting rapido

### Problema 1 - Botao da Central de Workflows retorna 404

Verificar:

- rota de retorno da action
- pagina de destino existente
- reimplantacao do `plataforma_admin`

### Problema 2 - Sincronizacao executa mas nao inclui novo candidato

Verificar:

- se o candidato realmente apareceu no output do node `Ler Planilha via Webhook`
- se passou pelo node de mapeamento
- se a logica de comparacao marcou como `ignorado`, `novo` ou `atualizado`
- se o identificador de campanha esta coerente

### Problema 3 - Workflow gerado localmente mas nao aparece no n8n

Isto e esperado.

Motivo:

- a geracao local nao importa automaticamente no n8n

Acao:

- importar manualmente os JSONs no ambiente n8n

### Problema 4 - Mensagem da Meta nao entra no funil

Verificar:

- webhook salvo na Meta
- campo `messages` assinado
- token correto no env
- workflow `02a` e `02b` ativos
- variaveis da Meta configuradas no ambiente n8n

### Problema 5 - Falha ao excluir candidato

Verificar:

- tabelas dependentes ainda nao removidas
- relacionamento com prompts, perfis, eventos, presencas ou interacoes

## Checklist de entrada em producao para novo candidato

Antes de liberar uma campanha:

1. candidato sincronizado na base
2. pacote de workflows gerado
3. workflows importados no n8n
4. credenciais revisadas
5. workflows ativados
6. canal oficial validado
7. QR code validado
8. pagina de eventos validada
9. usuario gestor criado e vinculado ao candidato
10. operador e analista criados, se necessario

## Checklist de handoff tecnico

Ao finalizar uma implantacao, registrar:

- nome do candidato
- `id_candidato`
- workflows gerados
- workflows importados
- credenciais usadas
- status da Meta
- status do Google Sheets
- usuario gestor criado
- pendencias abertas

## Resumo executivo para a equipe

- O `plataforma_admin` nao precisou de novo `env` para a fase de geracao local dos workflows.
- A Central de Workflows agora possui uma etapa propria para gerar o pacote do candidato.
- A importacao dos JSONs para o n8n continua manual, e os fluxos importados seguem visiveis e editaveis no ambiente n8n.
