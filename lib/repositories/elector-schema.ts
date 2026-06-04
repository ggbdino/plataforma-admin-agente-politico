import { db } from "@/lib/db";

let electorColumnsReady = false;

export async function ensureElectorEnrichmentColumns() {
  if (electorColumnsReady) {
    return;
  }

  await db.query(`
    alter table eleitores
    add column if not exists uf text;
  `);

  await db.query(`
    alter table eleitores
    add column if not exists grupo_interesse text;
  `);

  await db.query(`
    alter table eleitores
    add column if not exists origem_grupo text;
  `);

  await db.query(`
    alter table eleitores
    add column if not exists origem_cidade text;
  `);

  electorColumnsReady = true;
}
