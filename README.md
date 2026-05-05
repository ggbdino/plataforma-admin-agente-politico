# Plataforma Admin

## Objetivo

App Next.js para operar o Agente Politico no Caminho A:

- frontend fala com backend do proprio app;
- backend fala com Postgres e n8n;
- frontend nao chama webhooks do n8n diretamente.

## Como usar

1. Copie `.env.example` para `.env.local`
2. Preencha os valores reais
3. Instale dependencias
4. Rode `npm run dev`

## MVP inicial

- `/candidatos`
- `/candidatos/[idCandidato]`
- `GET /api/candidatos`
- `GET /api/candidatos/:idCandidato/implantacao`
- `POST /api/candidatos/:idCandidato/implantacao/etapas/:codigoEtapa/executar`
