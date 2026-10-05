import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from '../config.js';
import { ESQUEMA_SQL } from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const caminho = resolve(config.database.path);
  mkdirSync(dirname(caminho), { recursive: true });

  db = new Database(caminho);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(ESQUEMA_SQL);

  return db;
}

/** Só pra testes automatizados: fecha a conexão aberta pra o próximo getDb() reabrir do zero. */
export function fecharDbParaTestes(): void {
  if (db) {
    db.close();
    db = null;
  }
}
