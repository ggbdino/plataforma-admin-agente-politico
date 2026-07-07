import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export type PlatformUserProfile =
  | "administrador"
  | "gestor_campanha"
  | "operador"
  | "analista";

export type PlatformUserRecord = {
  id: string;
  nome: string;
  email: string;
  perfil: PlatformUserProfile;
  status: string;
  ultimo_login_em: string | null;
  criado_em: string;
};

export type PlatformUserPermissionRecord = {
  id: string;
  id_candidato: string | null;
  nome_urna: string | null;
  escopo: string;
  pode_visualizar: boolean;
  pode_implantar: boolean;
  pode_operar_funil: boolean;
  pode_operar_eventos: boolean;
  pode_ver_kpis: boolean;
  ativo: boolean;
};

export type PlatformUserSession = {
  sessionId: string;
  userId: string;
  nome: string;
  email: string;
  perfil: PlatformUserProfile;
};

export type PlatformUserPermissionInput = {
  idCandidato: string | null;
  podeVisualizar: boolean;
  podeImplantar: boolean;
  podeOperarFunil: boolean;
  podeOperarEventos: boolean;
  podeVerKpis: boolean;
};

let tablesReady: Promise<void> | null = null;

export async function ensurePlatformUserTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.query(`
        create table if not exists paines_admin_usuario (
          id uuid primary key default gen_random_uuid(),
          nome text not null,
          email text unique not null,
          perfil text not null default 'operador',
          status text not null default 'ativo',
          senha_hash text,
          ultimo_login_em timestamptz,
          criado_em timestamptz default now(),
          atualizado_em timestamptz default now()
        );
      `);

      await db.query(`
        alter table paines_admin_usuario
        add column if not exists senha_hash text;
      `);

      await db.query(`
        create table if not exists paines_admin_permissoes (
          id uuid primary key default gen_random_uuid(),
          admin_usuario_id uuid not null references paines_admin_usuario(id) on delete cascade,
          id_candidato varchar(120) references candidatos(id_candidato),
          escopo text not null default 'campanha',
          pode_visualizar boolean default true,
          pode_implantar boolean default false,
          pode_operar_funil boolean default false,
          pode_operar_eventos boolean default false,
          pode_ver_kpis boolean default true,
          ativo boolean default true,
          criado_em timestamptz default now(),
          atualizado_em timestamptz default now()
        );
      `);

      await db.query(`
        create table if not exists paines_admin_sessoes (
          id uuid primary key default gen_random_uuid(),
          admin_usuario_id uuid not null references paines_admin_usuario(id) on delete cascade,
          token_hash text not null unique,
          expira_em timestamptz not null,
          criado_em timestamptz default now()
        );
      `);

      await db.query(`
        create table if not exists paines_admin_recuperacao_senha (
          id uuid primary key default gen_random_uuid(),
          admin_usuario_id uuid not null references paines_admin_usuario(id) on delete cascade,
          token_hash text not null unique,
          expira_em timestamptz not null,
          utilizado_em timestamptz,
          criado_em timestamptz default now()
        );
      `);
    })();
  }

  await tablesReady;
}

export async function hasAnyPlatformUser() {
  await ensurePlatformUserTables();
  const result = await db.query<{ total: string }>(
    `select count(*)::text as total from paines_admin_usuario`
  );
  return Number(result.rows[0]?.total ?? 0) > 0;
}

export async function listPlatformUsers() {
  await ensurePlatformUserTables();
  const usersResult = await db.query<PlatformUserRecord>(
    `
      select
        id,
        nome,
        email,
        perfil,
        status,
        ultimo_login_em::text as ultimo_login_em,
        criado_em::text as criado_em
      from paines_admin_usuario
      order by nome
    `
  );

  const permissionsResult = await db.query<PlatformUserPermissionRecord & { admin_usuario_id: string }>(
    `
      select
        p.admin_usuario_id,
        p.id,
        p.id_candidato,
        c.nome_urna,
        p.escopo,
        p.pode_visualizar,
        p.pode_implantar,
        p.pode_operar_funil,
        p.pode_operar_eventos,
        p.pode_ver_kpis,
        p.ativo
      from paines_admin_permissoes p
      left join candidatos c on c.id_candidato = p.id_candidato
      order by c.nome_urna nulls first, p.criado_em
    `
  );

  return usersResult.rows.map((user) => ({
    ...user,
    permissoes: permissionsResult.rows.filter(
      (permission) => permission.admin_usuario_id === user.id
    )
  }));
}

export async function createPlatformUser(input: {
  nome: string;
  email: string;
  senha: string;
  perfil: PlatformUserProfile;
  permissoes: PlatformUserPermissionInput[];
}) {
  await ensurePlatformUserTables();

  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = hashPassword(input.senha);

  const client = await db.connect();

  try {
    await client.query("begin");

    const existingResult = await client.query<{ id: string }>(
      `select id from paines_admin_usuario where email = $1`,
      [normalizedEmail]
    );

    if (existingResult.rows[0]) {
      throw new Error("Já existe um usuário cadastrado com esse e-mail.");
    }

    const userResult = await client.query<{ id: string }>(
      `
        insert into paines_admin_usuario (nome, email, perfil, status, senha_hash)
        values ($1, $2, $3, 'ativo', $4)
        returning id
      `,
      [input.nome.trim(), normalizedEmail, input.perfil, passwordHash]
    );

    const userId = userResult.rows[0].id;

    for (const permission of input.permissoes) {
      await client.query(
        `
          insert into paines_admin_permissoes (
            admin_usuario_id,
            id_candidato,
            escopo,
            pode_visualizar,
            pode_implantar,
            pode_operar_funil,
            pode_operar_eventos,
            pode_ver_kpis,
            ativo
          )
          values ($1, $2, 'campanha', $3, $4, $5, $6, $7, true)
        `,
        [
          userId,
          permission.idCandidato,
          permission.podeVisualizar,
          permission.podeImplantar,
          permission.podeOperarFunil,
          permission.podeOperarEventos,
          permission.podeVerKpis
        ]
      );
    }

    await client.query("commit");

    return userId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}


export async function getPlatformUserByEmail(email: string) {
  await ensurePlatformUserTables();
  const result = await db.query<PlatformUserRecord>(
    `
      select id, nome, email, perfil, status, ultimo_login_em::text as ultimo_login_em, criado_em::text as criado_em
      from paines_admin_usuario
      where email = $1
      limit 1
    `,
    [email.trim().toLowerCase()]
  );

  return result.rows[0] ?? null;
}

export async function createPasswordResetToken(email: string) {
  await ensurePlatformUserTables();
  const user = await getPlatformUserByEmail(email);

  if (!user || user.status !== "ativo") {
    return null;
  }

  const rawToken = randomBytes(32).toString("hex");
  await db.query(
    `
      insert into paines_admin_recuperacao_senha (admin_usuario_id, token_hash, expira_em)
      values ($1, $2, now() + interval '1 hour')
    `,
    [user.id, hashToken(rawToken)]
  );

  return { user, rawToken };
}

export async function resetPlatformUserPasswordWithToken(rawToken: string, newPassword: string) {
  await ensurePlatformUserTables();
  const client = await db.connect();

  try {
    await client.query("begin");
    const tokenResult = await client.query<{ id: string; admin_usuario_id: string }>(
      `
        select id, admin_usuario_id
        from paines_admin_recuperacao_senha
        where token_hash = $1
          and expira_em > now()
          and utilizado_em is null
        limit 1
      `,
      [hashToken(rawToken)]
    );
    const token = tokenResult.rows[0];

    if (!token) {
      await client.query("rollback");
      return false;
    }

    await client.query(
      `update paines_admin_usuario set senha_hash = $2, atualizado_em = now() where id = $1`,
      [token.admin_usuario_id, hashPassword(newPassword)]
    );
    await client.query(
      `update paines_admin_recuperacao_senha set utilizado_em = now() where id = $1`,
      [token.id]
    );
    await client.query(
      `delete from paines_admin_sessoes where admin_usuario_id = $1`,
      [token.admin_usuario_id]
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePlatformUserPassword(userId: string, newPassword: string) {
  await ensurePlatformUserTables();
  await db.query(
    `update paines_admin_usuario set senha_hash = $2, atualizado_em = now() where id = $1`,
    [userId, hashPassword(newPassword)]
  );
  await db.query(`delete from paines_admin_sessoes where admin_usuario_id = $1`, [userId]);
}

export async function deletePlatformUser(userId: string) {
  await ensurePlatformUserTables();
  await db.query(`delete from paines_admin_usuario where id = $1`, [userId]);
}

export async function updatePlatformUserAssignment(input: {
  userId: string;
  perfil: PlatformUserProfile;
  permissoes: PlatformUserPermissionInput[];
}) {
  await ensurePlatformUserTables();
  const client = await db.connect();

  try {
    await client.query("begin");
    await client.query(
      `update paines_admin_usuario set perfil = $2, atualizado_em = now() where id = $1`,
      [input.userId, input.perfil]
    );
    await client.query(`delete from paines_admin_permissoes where admin_usuario_id = $1`, [input.userId]);

    for (const permission of input.permissoes) {
      await client.query(
        `
          insert into paines_admin_permissoes (
            admin_usuario_id, id_candidato, escopo, pode_visualizar, pode_implantar,
            pode_operar_funil, pode_operar_eventos, pode_ver_kpis, ativo
          ) values ($1, $2, 'campanha', $3, $4, $5, $6, $7, true)
        `,
        [
          input.userId,
          permission.idCandidato,
          permission.podeVisualizar,
          permission.podeImplantar,
          permission.podeOperarFunil,
          permission.podeOperarEventos,
          permission.podeVerKpis
        ]
      );
    }

    await client.query(`delete from paines_admin_sessoes where admin_usuario_id = $1`, [input.userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPermittedCandidateIdsForUser(userId: string) {
  await ensurePlatformUserTables();
  const result = await db.query<{ id_candidato: string }>(
    `
      select distinct id_candidato
      from paines_admin_permissoes
      where admin_usuario_id = $1
        and ativo = true
        and id_candidato is not null
      order by id_candidato
    `,
    [userId]
  );

  return result.rows.map((row) => row.id_candidato);
}

export async function authenticatePlatformUser(email: string, senha: string) {
  await ensurePlatformUserTables();

  const result = await db.query<PlatformUserRecord & { senha_hash: string | null }>(
    `
      select
        id,
        nome,
        email,
        perfil,
        status,
        senha_hash,
        ultimo_login_em::text as ultimo_login_em,
        criado_em::text as criado_em
      from paines_admin_usuario
      where email = $1
    `,
    [email.trim().toLowerCase()]
  );

  const user = result.rows[0];

  if (!user || user.status !== "ativo" || !user.senha_hash) {
    return null;
  }

  if (!verifyPassword(senha, user.senha_hash)) {
    return null;
  }

  await db.query(
    `update paines_admin_usuario set ultimo_login_em = now(), atualizado_em = now() where id = $1`,
    [user.id]
  );

  return user;
}

export async function getPlatformUserPermissions(userId: string) {
  await ensurePlatformUserTables();
  const result = await db.query<PlatformUserPermissionRecord>(
    `
      select
        p.id,
        p.id_candidato,
        c.nome_urna,
        p.escopo,
        p.pode_visualizar,
        p.pode_implantar,
        p.pode_operar_funil,
        p.pode_operar_eventos,
        p.pode_ver_kpis,
        p.ativo
      from paines_admin_permissoes p
      left join candidatos c on c.id_candidato = p.id_candidato
      where p.admin_usuario_id = $1
        and p.ativo = true
    `,
    [userId]
  );

  return result.rows;
}

export async function userHasCampaignPermission(
  userId: string,
  perfil: PlatformUserProfile,
  idCandidato: string,
  capability:
    | "pode_visualizar"
    | "pode_implantar"
    | "pode_operar_funil"
    | "pode_operar_eventos"
    | "pode_ver_kpis"
) {
  if (perfil === "administrador") {
    return true;
  }

  if (perfil === "operador" && capability === "pode_ver_kpis") {
    return false;
  }

  if (
    perfil === "analista" &&
    !["pode_visualizar", "pode_ver_kpis"].includes(capability)
  ) {
    return false;
  }

  await ensurePlatformUserTables();

  const result = await db.query<{ allowed: boolean }>(
    `
      select exists(
        select 1
        from paines_admin_permissoes
        where admin_usuario_id = $1
          and ativo = true
          and id_candidato = $2
          and ${capability} = true
      ) as allowed
    `,
    [userId, idCandidato]
  );

  return result.rows[0]?.allowed ?? false;
}

export async function createPlatformSession(user: {
  id: string;
  nome: string;
  email: string;
  perfil: PlatformUserProfile;
}) {
  await ensurePlatformUserTables();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const sessionResult = await db.query<{ id: string }>(
    `
      insert into paines_admin_sessoes (admin_usuario_id, token_hash, expira_em)
      values ($1, $2, now() + interval '8 hours')
      returning id
    `,
    [user.id, tokenHash]
  );

  return {
    rawToken,
    sessionId: sessionResult.rows[0].id
  };
}

export async function getPlatformSessionByToken(rawToken: string) {
  await ensurePlatformUserTables();
  const result = await db.query<{
    session_id: string;
    user_id: string;
    nome: string;
    email: string;
    perfil: PlatformUserProfile;
  }>(
    `
      select
        s.id as session_id,
        u.id as user_id,
        u.nome,
        u.email,
        u.perfil
      from paines_admin_sessoes s
      join paines_admin_usuario u on u.id = s.admin_usuario_id
      where s.token_hash = $1
        and s.expira_em > now()
        and u.status = 'ativo'
      limit 1
    `,
    [hashToken(rawToken)]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil
  } satisfies PlatformUserSession;
}

export async function clearPlatformSession(rawToken: string) {
  await ensurePlatformUserTables();
  await db.query(`delete from paines_admin_sessoes where token_hash = $1`, [hashToken(rawToken)]);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");

  return original.length === computed.length && timingSafeEqual(original, computed);
}

function hashToken(token: string) {
  return scryptSync(token, "platform-session", 64).toString("hex");
}
