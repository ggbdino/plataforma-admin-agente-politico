# Remessa SMS da campanha - V21.1.3

A funcionalidade permite que o Gestor da Campanha envie mensagens curtas para os celulares dos eleitores vinculados ao candidato. A padronização da V21.1.2 segue o mesmo princípio da integração WhatsApp/Meta: cada candidato deve usar o próprio provedor, gateway, contrato e credencial, mantendo o custo diretamente sob responsabilidade da campanha. A plataforma resolve automaticamente o webhook n8n individualizado do candidato, sem expor URL técnica ao gestor.

## Regras de acesso

- Apenas o perfil `gestor_campanha` pode preparar e enviar remessas SMS.
- A remessa usa somente eleitores da base do candidato, com telefone válido e sem opt-out.
- O administrador mantém governança e auditoria, mas a iniciativa operacional é do gestor da campanha.
- A GAP não concentra custo de envio. A plataforma apenas orquestra, registra e audita a remessa.
- O envio real depende do workflow `21b` do candidato estar importado e ativo no n8n, além do gateway SMS contratado pela campanha.

## Públicos disponíveis

- Todos os eleitores com telefone.
- Um eleitor específico, recomendado para testes.
- Todos os participantes de um evento.
- Confirmados em um evento.
- Presentes em um evento.

## Configuração do gateway por candidato

A URL do webhook/gateway SMS, a chave técnica, o remetente/sender, o provedor e o limite por remessa são configurados uma única vez por candidato:

- Pelo Gestor da Campanha, na área do candidato, no cartão `Gateway SMS da campanha`.
- Pelo Administrador, na Central de workflows, no cartão `Gateway SMS do candidato`.

Essa configuração é opcional e não bloqueia a implantação do candidato. Enquanto ela não estiver configurada, a remessa SMS fica planejada/auditada, sem envio real.

A tela `Remeter SMS` passa a tratar apenas da operação de remessa: público, eleitor ou evento aplicável e texto da mensagem. O gestor não precisa repetir URL nem chave a cada disparo.

## Workflows SMS por candidato

O pacote de workflows por candidato gera o fluxo individualizado `21b_sms_campanha_gateway_{slug}_{id}.json`, com path próprio:

```text
/webhook/agente-politico/{id_candidato}/sms-campanha
```

Para os candidatos já cadastrados no manifesto local foram gerados:

- `21b_sms_campanha_gateway_brunex_0001.json`
- `21b_sms_campanha_gateway_eri-castro_1313.json`
- `21b_sms_campanha_gateway_ricardo-vale_ricardo-vale.json`

Cada fluxo aceita variáveis específicas do candidato, com fallback para variáveis globais de homologação. Exemplo para Ricardo Vale:

```env
SMS_API_KEY_RICARDO_VALE_RICARDO_VALE=chave_esperada_pelo_webhook
SMS_GATEWAY_URL_RICARDO_VALE_RICARDO_VALE=https://url_do_provedor_sms_do_candidato
SMS_GATEWAY_API_KEY_RICARDO_VALE_RICARDO_VALE=chave_real_do_provedor_sms_do_candidato
SMS_SENDER_ID_RICARDO_VALE_RICARDO_VALE=5561982462447
SMS_GATEWAY_DRY_RUN_RICARDO_VALE_RICARDO_VALE=false
```

## Fallback global de homologação

As variáveis globais continuam existindo apenas como fallback de homologação ou ambiente controlado:

```env
SMS_PROVIDER=webhook
SMS_WEBHOOK_URL=https://seu-n8n-ou-gateway-de-homologacao/webhook/sms-campanha
SMS_API_KEY=chave_de_homologacao
SMS_SENDER_ID=numero_ou_identificador_padrao
SMS_MAX_RECIPIENTS_PER_DISPATCH=1
```

Em produção, a recomendação é usar o workflow individualizado do candidato para que o custo fique ligado ao contrato da própria campanha.

## Payload enviado ao workflow

A plataforma envia um `POST` JSON por destinatário para o webhook resolvido do candidato:

```json
{
  "provider": "webhook",
  "dispatchId": "uuid-da-remessa",
  "idCandidato": "ricardo-vale",
  "from": "5561982462447",
  "to": "5561999999999",
  "nome": "Nome do eleitor",
  "message": "Texto do SMS"
}
```

Quando houver chave/token, ela é enviada no cabeçalho HTTP:

```http
Authorization: Bearer chave_do_gateway
```

## Auditoria

Cada remessa gera registros em:

- `campanha_sms_config`
- `remessas_sms_campanha`
- `remessas_sms_destinatarios`
- trilha de governança da campanha

## Cuidados operacionais

- SMS é tarifado pelo provedor e pode ter cobrança por segmento de mensagem.
- Mensagens com acentos ou muitos caracteres podem consumir mais de um segmento.
- Para testes, use público individual e mantenha o limite por remessa baixo.
- Use apenas contatos com base legítima, respeitando LGPD, legislação eleitoral e regras anti-spam.