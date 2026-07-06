# Remessa de WhatsApp da campanha - V19.0.0

A funcionalidade permite que o Gestor da Campanha envie mensagens pelo WhatsApp oficial do candidato para públicos controlados da base. O envio segue o modelo da Meta Cloud API para mensagens iniciadas pela empresa, portanto usa sempre um template previamente aprovado.

## Regras de acesso

- Apenas o perfil `gestor_campanha` pode preparar e enviar remessas de WhatsApp.
- O administrador mantém a governança da plataforma, mas a iniciativa operacional da remessa pertence ao gestor da campanha.
- Cada candidato deve usar o próprio número associado ao WhatsApp Business. Custos, limites, qualidade e cartão de crédito são responsabilidade da conta do candidato.

## Públicos disponíveis

- Todos os eleitores com telefone válido e sem opt-out.
- Um eleitor específico, recomendado para testes.
- Todos os participantes de um evento.
- Confirmados em um evento.
- Presentes em um evento.

## Configuração técnica

A tela do gestor permite registrar por candidato:

- `phone_number_id` do número de WhatsApp na Meta.
- ID da conta do WhatsApp Business.
- Número oficial da campanha.
- Token de acesso da Meta.
- Nome do template aprovado.
- Código de idioma do template, por padrão `pt_BR`.

Também podem ser usadas variáveis de ambiente globais como fallback:

```env
META_WHATSAPP_ENABLED=true
META_WHATSAPP_GRAPH_API_VERSION=v23.0
META_WHATSAPP_BASE_URL=https://graph.facebook.com
META_WHATSAPP_ACCESS_TOKEN=token_da_meta
META_WHATSAPP_BUSINESS_ACCOUNT_ID=id_da_conta_whatsapp_business
META_WHATSAPP_PHONE_NUMBER_ID=id_do_numero_de_telefone
WHATSAPP_MAX_RECIPIENTS_PER_DISPATCH=1
```

Para produção, ajuste `WHATSAPP_MAX_RECIPIENTS_PER_DISPATCH` de forma gradual. Para homologação, mantenha `1` e selecione um eleitor específico.

## Templates aprovados

Mensagens iniciadas pela campanha fora da janela de atendimento devem usar templates aprovados pela Meta. O nome informado na plataforma deve ser o nome técnico do template, sem espaços. As variáveis devem ser preenchidas na mesma ordem em que foram definidas no template.

Exemplo: se o template tem `{{1}}` para nome e `{{2}}` para evento, informe a variável 1 como o nome do eleitor ou saudação desejada e a variável 2 como o nome do evento.

## Auditoria

Cada remessa gera registros em:

- `campanha_whatsapp_config`
- `remessas_whatsapp_campanha`
- `remessas_whatsapp_destinatarios`
- trilha de governança da campanha

Quando não houver provedor configurado, a remessa fica planejada e auditada, sem envio externo.

## Referências Meta

- Mensagens da Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/
- Templates de mensagem: https://developers.facebook.com/docs/whatsapp/message-templates/
- Preços e cobrança: https://developers.facebook.com/docs/whatsapp/pricing/