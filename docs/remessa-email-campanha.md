# Remessa de e-mail da campanha

## Objetivo

Disponibilizar ao gestor da campanha uma rotina controlada para remeter mensagens por e-mail aos eleitores/usuários vinculados ao candidato, mantendo o candidato como emissor institucional da comunicação.

## Escopo da V18.0.0

- Acesso exclusivo ao perfil `gestor_campanha` vinculado ao candidato.
- Remetente sempre associado ao candidato.
- Quando o candidato ainda não tiver e-mail remetente registrado, o gestor informa o e-mail na própria tela antes da primeira remessa.
- Públicos disponíveis:
  - todos os eleitores com e-mail válido;
  - um eleitor específico, para testes e validações controladas;
  - todos os participantes de um evento;
  - confirmados em um evento;
  - presentes em um evento.
- Mensagem com assunto, texto livre, URL opcional de imagem, imagem anexada do computador do gestor e inclusão opcional do QR Code oficial da campanha.
- Registro de auditoria em governança e tabelas próprias de remessas/destinatários.
- Envio real por Resend quando `RESEND_API_KEY` estiver configurada.
- Sem provedor configurado, a remessa fica registrada como planejada, sem envio externo.

## Variáveis de ambiente

```env
RESEND_API_KEY=...
EMAIL_MAX_RECIPIENTS_PER_DISPATCH=100
```

As variáveis `SMTP_*` já ficam reservadas no ambiente para evolução posterior, mas a rota operacional recomendada para esta primeira versão é Resend.

## Governança

Toda tentativa de remessa registra evento em `governanca_auditoria` com categoria `email_campanha`. Os detalhes da operação ficam em:

- `campanha_email_config`;
- `remessas_email_campanha`;
- `remessas_email_destinatarios`.

## Observações de conformidade

A remessa deve respeitar a legislação eleitoral, a LGPD e as políticas anti-spam do provedor. A plataforma filtra registros com `opt_out = true` e só seleciona destinatários com e-mail válido.
