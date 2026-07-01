# Remessa de e-mail da campanha

## Objetivo

Disponibilizar ao gestor da campanha uma rotina controlada para remeter mensagens por e-mail aos eleitores/usuários vinculados ao candidato, mantendo o candidato como emissor institucional da comunicação.

## Escopo da V18.2.0

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
- Envio real por Resend quando `EMAIL_PROVIDER=resend` ou, em modo automático, quando houver `RESEND_API_KEY` e não houver SMTP configurado.
- Envio real por SMTP quando `EMAIL_PROVIDER=smtp` ou, em modo automático, quando houver `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS`.
- Sem provedor configurado, a remessa fica registrada como planejada, sem envio externo.

## Variáveis de ambiente

### Modo automático

```env
EMAIL_PROVIDER=auto
EMAIL_MAX_RECIPIENTS_PER_DISPATCH=100
```

No modo automático, a plataforma prioriza SMTP quando `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS` estiverem configurados. Caso contrário, usa Resend quando `RESEND_API_KEY` estiver configurada.

### Resend

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_MAX_RECIPIENTS_PER_DISPATCH=100
```

O Resend exige domínio remetente verificado. E-mails públicos como Gmail, Outlook ou Hotmail não funcionam como remetente direto nesse modo.

### SMTP Gmail ou Google Workspace

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=email.autorizado@gmail.com
SMTP_PASS=senha_de_app_do_google
EMAIL_HELO_DOMAIN=gapconsult.com.br
EMAIL_MAX_RECIPIENTS_PER_DISPATCH=10
```

Para Gmail, use uma conta autorizada pelo candidato, com verificação em duas etapas e senha de app. O remetente informado na tela deve ser a própria conta autenticada ou um alias autorizado nessa conta.

### SMTP com porta 465

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.seudominio.com.br
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=campanha@seudominio.com.br
SMTP_PASS=senha_da_conta
```

## Governança

Toda tentativa de remessa registra evento em `governanca_auditoria` com categoria `email_campanha`. Os detalhes da operação ficam em:

- `campanha_email_config`;
- `remessas_email_campanha`;
- `remessas_email_destinatarios`.

## Observações de conformidade

A remessa deve respeitar a legislação eleitoral, a LGPD e as políticas anti-spam do provedor. A plataforma filtra registros com `opt_out = true` e só seleciona destinatários com e-mail válido.
