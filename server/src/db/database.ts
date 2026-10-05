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
  migrarColunasNovas(db);

  return db;
}

/**
 * CREATE TABLE IF NOT EXISTS não adiciona coluna em tabela que já existia de
 * uma versão anterior -- então, pra quem já tinha rodado o servidor antes
 * dessas colunas existirem, checamos e adicionamos aqui (mesmo padrão
 * defensivo do app: PRAGMA table_info antes do ALTER, nunca um try/catch
 * cego que mascare erro de verdade).
 */
function migrarColunasNovas(db: Database.Database): void {
  const colunasObjetos = db.prepare('PRAGMA table_info(objetos)').all() as { name: string }[];
  const nomesObjetos = new Set(colunasObjetos.map((c) => c.name));
  if (!nomesObjetos.has('descricao_venda')) {
    db.exec("ALTER TABLE objetos ADD COLUMN descricao_venda TEXT NOT NULL DEFAULT ''");
  }
  if (!nomesObjetos.has('foto')) {
    db.exec("ALTER TABLE objetos ADD COLUMN foto TEXT NOT NULL DEFAULT ''");
  }
  if (!nomesObjetos.has('app_item_id')) {
    db.exec("ALTER TABLE objetos ADD COLUMN app_item_id TEXT NOT NULL DEFAULT ''");
  }

  const colunasConfig = db.prepare('PRAGMA table_info(configuracoes)').all() as { name: string }[];
  const nomesConfig = new Set(colunasConfig.map((c) => c.name));
  if (!nomesConfig.has('taxa_atraso')) {
    db.exec('ALTER TABLE configuracoes ADD COLUMN taxa_atraso REAL NOT NULL DEFAULT 1');
  }
}

/** Só pra testes automatizados: fecha a conexão aberta pra o próximo getDb() reabrir do zero. */
export function fecharDbParaTestes(): void {
  if (db) {
    db.close();
    db = null;
  }
}
