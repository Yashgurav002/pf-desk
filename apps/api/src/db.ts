// DB adapter: real Postgres when DATABASE_URL is set, else embedded PGlite (+pgvector).
// Dates (oid 1082) always come back as 'YYYY-MM-DD' strings.
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DATE_OID = 1082;
const keepString = (v: string) => v;

type Driver = {
  query(sql: string, params?: unknown[]): Promise<any[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
};

let driver: Promise<Driver> | null = null;

async function open(): Promise<Driver> {
  if (process.env.DATABASE_URL) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(DATE_OID, keepString);
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return {
      query: async (sql, params) => (await pool.query(sql, params as any[])).rows,
      exec: async (sql) => { await pool.query(sql); },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  const dataDir = process.env.PGLITE_DIR || resolve(import.meta.dirname, '../../../.data/pglite');
  if (!dataDir.startsWith('memory://')) await mkdir(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir, { extensions: { vector }, parsers: { [DATE_OID]: keepString } });
  return {
    query: async (sql, params) => (await db.query(sql, params)).rows as any[],
    exec: async (sql) => { await db.exec(sql); },
    close: () => db.close(),
  };
}

const get = () => (driver ??= open());

export async function query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await get()).query(sql, params) as Promise<T[]>;
}

export async function migrate(): Promise<void> {
  const sql = await readFile(join(import.meta.dirname, 'schema.sql'), 'utf8');
  await (await get()).exec(sql);
}

export async function close(): Promise<void> {
  if (!driver) return;
  const d = await driver;
  driver = null;
  await d.close();
}
