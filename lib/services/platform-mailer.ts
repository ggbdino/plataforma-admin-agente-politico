import net from "node:net";
import tls from "node:tls";
import { env } from "@/lib/env";

export async function sendPlatformTransactionalEmail(input: {
  toEmail: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}) {
  const provider = resolveEmailProvider();

  if (provider === "resend") {
    await sendWithResend(input);
    return provider;
  }

  if (provider === "smtp") {
    await sendWithSmtp(input);
    return provider;
  }

  return "sem_provedor" as const;
}

function resolveEmailProvider() {
  const provider = env.emailProvider;
  const hasSmtp = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
  const hasResend = Boolean(env.resendApiKey);

  if (provider === "smtp") {
    return hasSmtp ? "smtp" : "sem_provedor";
  }

  if (provider === "resend") {
    return hasResend ? "resend" : "sem_provedor";
  }

  if (hasSmtp) {
    return "smtp";
  }

  if (hasResend) {
    return "resend";
  }

  return "sem_provedor";
}

async function sendWithResend(input: { toEmail: string; subject: string; html: string; text: string }) {
  const fromEmail = env.smtpUser || "no-reply@gapconsult.com.br";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `GAP Consult <${fromEmail}>`,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend recusou o envio (${response.status}): ${body.slice(0, 300)}`);
  }
}

async function sendWithSmtp(input: { toEmail: string; subject: string; html: string; text: string }) {
  const client = await SmtpClient.connect({
    host: env.smtpHost,
    port: normalizeSmtpPort(env.smtpPort, env.smtpSecure),
    secure: env.smtpSecure,
    heloDomain: env.emailHeloDomain || "agente-politico.local"
  });

  try {
    await client.authenticate(env.smtpUser, env.smtpPass);
    await client.sendMail({
      fromEmail: env.smtpUser,
      fromName: "GAP Consult",
      toEmail: input.toEmail,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    await client.quit();
  } catch (error) {
    client.close();
    throw error;
  }
}

function normalizeSmtpPort(value: string | undefined, secure: boolean) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.trunc(parsed);
  }
  return secure ? 465 : 587;
}

type SmtpEnvelope = {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
};

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";

  private constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
  }

  static async connect(input: { host: string; port: number; secure: boolean; heloDomain: string }) {
    const socket = input.secure
      ? tls.connect({ host: input.host, port: input.port, servername: input.host })
      : net.connect({ host: input.host, port: input.port });

    await waitForSocket(socket, input.secure ? "secureConnect" : "connect");
    const client = new SmtpClient(socket);
    await client.expect([220]);
    const ehlo = await client.command(`EHLO ${input.heloDomain}`, [250]);

    if (!input.secure && ehlo.some((line) => /STARTTLS/i.test(line))) {
      await client.command("STARTTLS", [220]);
      client.socket = tls.connect({ socket: client.socket, servername: input.host });
      client.buffer = "";
      await waitForSocket(client.socket, "secureConnect");
      await client.command(`EHLO ${input.heloDomain}`, [250]);
    }

    return client;
  }

  async authenticate(user: string, pass: string) {
    const token = Buffer.concat([Buffer.from([0]), Buffer.from(user), Buffer.from([0]), Buffer.from(pass)]).toString("base64");
    await this.command(`AUTH PLAIN ${token}`, [235]);
  }

  async sendMail(input: SmtpEnvelope) {
    await this.command(`MAIL FROM:<${input.fromEmail}>`, [250]);
    await this.command(`RCPT TO:<${input.toEmail}>`, [250, 251]);
    await this.command("DATA", [354]);
    this.socket.write(`${dotStuff(buildMimeMessage(input))}\r\n.\r\n`);
    await this.expect([250]);
  }

  async quit() {
    await this.command("QUIT", [221]);
    this.close();
  }

  close() {
    this.socket.destroy();
  }

  private async command(command: string, expected: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  private async expect(expected: number[]) {
    const lines = await this.readResponse();
    const last = lines[lines.length - 1] ?? "";
    const code = Number(last.slice(0, 3));
    if (!expected.includes(code)) {
      throw new Error(`SMTP recusou comando (${code || "sem código"}): ${lines.join(" ").slice(0, 300)}`);
    }
    return lines;
  }

  private async readResponse() {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        return lines;
      }
    }
  }

  private async readLine(): Promise<string> {
    const existing = this.takeLine();
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const done = (line: string) => {
        cleanup();
        resolve(line);
      };
      const timer = setTimeout(() => fail(new Error("Tempo esgotado aguardando resposta SMTP.")), 30000);
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const line = this.takeLine();
        if (line) {
          done(line);
        }
      };
      const onError = (error: Error) => fail(error);
      this.socket.on("data", onData);
      this.socket.on("error", onError);
    });
  }

  private takeLine() {
    const index = this.buffer.indexOf("\n");
    if (index < 0) {
      return null;
    }
    const line = this.buffer.slice(0, index + 1).replace(/\r?\n$/, "");
    this.buffer = this.buffer.slice(index + 1);
    return line;
  }
}

function waitForSocket(socket: net.Socket | tls.TLSSocket, event: "connect" | "secureConnect") {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onReady);
      socket.off("error", onError);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => fail(new Error("Tempo esgotado conectando ao SMTP.")), 30000);
    const onReady = () => done();
    const onError = (error: Error) => fail(error);
    socket.once(event, onReady);
    socket.once("error", onError);
  });
}

function buildMimeMessage(input: SmtpEnvelope) {
  return [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: <${input.toEmail}>`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="platform_auth_boundary"',
    "",
    "--platform_auth_boundary",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    "--platform_auth_boundary",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    "--platform_auth_boundary--",
    ""
  ].join("\r\n");
}

function dotStuff(message: string) {
  return message.replace(/^\./gm, "..");
}

function formatAddress(name: string, email: string) {
  return `${encodeMimeHeader(name.replace(/["<>]/g, "").trim() || "GAP Consult")} <${email}>`;
}

function encodeMimeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value)
    ? value.replace(/[\r\n]/g, " ")
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}