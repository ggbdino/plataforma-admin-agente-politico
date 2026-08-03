# Remessa SMS da campanha - V21.0.0

A funcionalidade permite que o Gestor da Campanha envie mensagens curtas para os celulares dos eleitores vinculados ao candidato. A experiência corresponde ao recebimento no aplicativo nativo de mensagens do telefone, como SMS ou canal equivalente entregue por gateway contratado.

## Regras de acesso

- Apenas o perfil `gestor_campanha` pode preparar e enviar remessas SMS.
- A remessa usa somente eleitores da base do candidato, com telefone válido e sem opt-out.
- O administrador mantém governança e auditoria, mas a iniciativa operacional é do gestor da campanha.
- O envio real depende de provedor SMS externo ou webhook de integração.

## Públicos disponíveis

- Todos os eleitores com telefone.
- Um eleitor específico, recomendado para testes.
- Todos os participantes de um evento.
- Confirmados em um evento.
- Presentes em um evento.

## Configuração técnica

Sem provedor configurado, a plataforma registra a remessa como planejada e auditada. Para envio real, configure:

```env
SMS_PROVIDER=webhook
SMS_WEBHOOK_URL=https://seu-gateway-ou-n8n/webhook/sms-campanha
SMS_API_KEY=chave_do_gateway_ou_webhook
SMS_SENDER_ID=numero_ou_identificador_do_remetente
SMS_MAX_RECIPIENTS_PER_DISPATCH=1
```

O webhook recebe um `POST` JSON por destinatário:

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

## Auditoria

Cada remessa gera registros em:

- `remessas_sms_campanha`
- `remessas_sms_destinatarios`
- trilha de governança da campanha

## Cuidados operacionais

- SMS é tarifado pelo provedor e pode ter cobrança por segmento de mensagem.
- Mensagens com acentos ou muitos caracteres podem consumir mais de um segmento.
- Para testes, use público individual e mantenha `SMS_MAX_RECIPIENTS_PER_DISPATCH=1`.
- Use apenas contatos com base legítima, respeitando LGPD, legislação eleitoral e regras anti-spam.