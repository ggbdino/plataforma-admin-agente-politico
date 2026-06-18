# Inteligencia da Campanha

## Objetivo

A funcionalidade Inteligencia da Campanha consolida a leitura politica e operacional de cada candidato do Agente Politico. Ela deve permitir acompanhar captacao, relacionamento e conversao sem misturar bases, indicadores ou acoes entre candidatos.

O painel deve funcionar em dois niveis:

- visao consolidada da plataforma, disponivel apenas ao administrador;
- visao individual do candidato, disponivel ao gestor da campanha e ao analista, respeitando o limite de atuacao de cada perfil.

## Funil Politico

A inteligencia da campanha deve acompanhar tres etapas principais do Agente Politico:

- Captacao: entrada de contatos por QR Code, WhatsApp, eventos, formularios, importacoes, redes sociais e outras origens rastreaveis.
- Relacionamento: cadencia de mensagens, interacoes inbound e outbound, respostas, temas de interesse, sentimento e qualidade da conversa.
- Conversao: quando a pessoa declara apoio ou intencao de voto ao candidato.

Dentro da conversao, o estagio avancado e o eleitor divulgador: pessoa que, alem de apoiar o candidato, aceita divulgar a campanha para familia, amigos, colegas de trabalho e redes de relacionamento.

## Indicadores Minimos

Cada candidato deve possuir indicadores proprios, sem contaminacao por dados de outro candidato:

- total da base de eleitores ou contatos;
- novos leads por periodo;
- leads qualificados;
- leads engajados;
- apoiadores declarados;
- indecisos;
- divulgadores da campanha;
- taxa de conversao;
- origem de captacao;
- volume inbound e outbound;
- cadencia de relacionamento;
- temas dominantes;
- sentimento predominante;
- eventos ativos;
- confirmacoes e comparecimentos em eventos;
- qualidade da base, incluindo incompletude, duplicidade e registros sem interacao;
- alertas de funil parado ou baixa cadencia.

## Matriz de Acesso

### Administrador

O administrador tem acesso global a plataforma. Deve visualizar todos os indicadores consolidados, selecionar candidatos, abrir o painel individual de qualquer campanha, exportar indicadores executivos, acompanhar governanca, auditoria e gerir usuarios.

### Gestor da Campanha

O gestor da campanha tem acesso completo apenas ao candidato vinculado. Pode visualizar dados estatisticos, operar funil, criar e gerir eventos, acompanhar conversas, executar rotinas operacionais e cadastrar operador ou analista do proprio candidato.

O gestor nao deve visualizar nem cadastrar usuarios de outro candidato.

### Analista

O analista pode visualizar os dados estatisticos do candidato vinculado, em especial graficos, rankings, indicadores de funil, metas, conversao, qualidade da base e evolucao temporal.

O analista nao pode:

- criar, editar ou operar eventos;
- controlar entrada de pessoas em eventos;
- acessar conversas nominais ou historico individualizado de eleitores;
- importar base, recalcular funil ou executar acoes operacionais;
- exportar dados executivos sensiveis.

### Operador

O operador atua na operacao diaria do candidato vinculado. Pode visualizar conversas, acompanhar o relacionamento, operar o funil, controlar entrada das pessoas nos eventos e apresentar em seus equipamentos os dados do telao.

O operador nao pode acessar dados estatisticos, KPIs, exportacoes executivas, governanca global ou paineis consolidados.

## Cores dos Graficos

Todos os graficos estatisticos devem usar cores diferentes da plataforma para facilitar leitura, comparacao e apresentacao. A regra visual e:

- cada serie, categoria ou barra deve receber cor distinta sempre que houver comparacao;
- os graficos nao devem usar uma unica cor dominante para todos os itens;
- a paleta deve combinar tons quentes, verdes, azuis e violetas ja presentes na identidade visual da plataforma;
- telas de indicadores devem manter contraste suficiente para leitura em escritorio, reuniao de campanha e exibicao em tela compartilhada.

## Regras de Privacidade

Conversas, telefones, nomes e historico individualizado sao dados operacionais sensiveis. Por isso:

- analistas recebem leitura estatistica e grafica, sem drill-down nominal;
- operadores recebem acesso operacional as conversas e eventos, sem KPIs;
- administradores e gestores recebem a visao completa no escopo permitido;
- toda tentativa de acesso fora do perfil deve ser bloqueada e, quando aplicavel, registrada na governanca.

## Notas de Implementacao

Na plataforma administrativa, a regra deve ser refletida em:

- permissoes padrao criadas para cada perfil;
- rota inicial apos login;
- protecao das paginas de conversas, eventos, telao e estatisticas;
- exibicao condicional de botoes de importacao, recalculo, exportacao e console;
- graficos com paleta multicolorida por categoria.

