import initSqlJs, { type Database as SqlJsDb } from 'sql.js';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from '../config.js';
import { ESQUEMA_SQL } from './schema.js';

/*
 * Usamos sql.js (SQLite compilado pra WebAssembly, puro JavaScript) em vez
 * de better-sqlite3 (que precisa compilar código C++ na hora de instalar).
 * O better-sqlite3 não compila no Termux/Android com versões recentes do
 * Node -- os cabeçalhos do V8 mudaram e quebram a compilação -- travando a
 * instalação pra sempre no celular do cliente. O sql.js não compila nada,
 * então funciona em qualquer lugar onde o Node roda.
 *
 * Única diferença real: sql.js guarda o banco em memória, não em arquivo
 * direto. Por isso salvamos o banco inteiro em disco a cada escrita (ver
 * salvarEmDisco) -- com o volume de dados de um negócio pequeno (alguns
 * clientes/objetos/mensagens), isso não pesa nada.
 */

export interface StatementWrapper {
  run(...params: any[]): { lastInsertRowid: number; changes: number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface DbWrapper {
  prepare(sql: string): StatementWrapper;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

const SQL = await initSqlJs();

let sqlJsDb: SqlJsDb | null = null;
let caminhoArquivo = '';

function salvarEmDisco(): void {
  if (!sqlJsDb || !caminhoArquivo) return;
  writeFileSync(caminhoArquivo, Buffer.from(sqlJsDb.export()));
}

function criarStatement(sql: string): StatementWrapper {
  return {
    run(...params: any[]) {
      const db = sqlJsDb!;
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        stmt.step();
      } finally {
        stmt.free();
      }
      salvarEmDisco();
      const idRes = db.exec('SELECT last_insert_rowid() AS id, changes() AS changes');
      const linha = idRes[0]?.values?.[0] ?? [0, 0];
      return { lastInsertRowid: Number(linha[0]) || 0, changes: Number(linha[1]) || 0 };
    },
    get(...params: any[]) {
      const stmt = sqlJsDb!.prepare(sql);
      try {
        stmt.bind(params);
        return stmt.step() ? stmt.getAsObject() : undefined;
      } finally {
        stmt.free();
      }
    },
    all(...params: any[]) {
      const stmt = sqlJsDb!.prepare(sql);
      const linhas: any[] = [];
      try {
        stmt.bind(params);
        while (stmt.step()) linhas.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return linhas;
    },
  };
}

// Nota: cada .run() de StatementWrapper já aplica e salva sua própria
// mudança sozinho (ver salvarEmDisco em criarStatement) -- não existe BEGIN/
// COMMIT manual envolvendo várias delas aqui. Usar BEGIN/COMMIT explícito
// junto com os exec() auxiliares de criarStatement.run() (last_insert_rowid/
// changes) expõe um bug do sql.js que fecha a transação sozinho no meio do
// caminho. Como esta função só é usada no apagar dados de um cliente (LGPD),
// que não é sensível a performance nem precisa ser atômica entre as tabelas,
// a forma mais simples e confiável é só chamar fn direto.
function transacao<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

export function getDb(): DbWrapper {
  if (!sqlJsDb) {
    caminhoArquivo = resolve(config.database.path);
    mkdirSync(dirname(caminhoArquivo), { recursive: true });
    sqlJsDb = existsSync(caminhoArquivo) ? new SQL.Database(readFileSync(caminhoArquivo)) : new SQL.Database();

    sqlJsDb.run(ESQUEMA_SQL);
    migrarColunasNovas(sqlJsDb);
    salvarEmDisco();
  }
  return { prepare: criarStatement, transaction: transacao };
}

function colunasDaTabela(db: SqlJsDb, tabela: string): string[] {
  const resultado = db.exec(`PRAGMA table_info(${tabela})`);
  if (!resultado.length) return [];
  const idxName = resultado[0].columns.indexOf('name');
  return resultado[0].values.map((linha) => String(linha[idxName]));
}

/**
 * CREATE TABLE IF NOT EXISTS não adiciona coluna em tabela que já existia de
 * uma versão anterior -- então, pra quem já tinha rodado o servidor antes
 * dessas colunas existirem, checamos e adicionamos aqui (mesmo padrão
 * defensivo do app: PRAGMA table_info antes do ALTER, nunca um try/catch
 * cego que mascare erro de verdade).
 */
function migrarColunasNovas(db: SqlJsDb): void {
  const colunasObjetos = colunasDaTabela(db, 'objetos');
  if (!colunasObjetos.includes('descricao_venda')) {
    db.run("ALTER TABLE objetos ADD COLUMN descricao_venda TEXT NOT NULL DEFAULT ''");
  }
  if (!colunasObjetos.includes('foto')) {
    db.run("ALTER TABLE objetos ADD COLUMN foto TEXT NOT NULL DEFAULT ''");
  }
  if (!colunasObjetos.includes('app_item_id')) {
    db.run("ALTER TABLE objetos ADD COLUMN app_item_id TEXT NOT NULL DEFAULT ''");
  }

  const colunasConfig = colunasDaTabela(db, 'configuracoes');
  if (!colunasConfig.includes('taxa_atraso')) {
    db.run('ALTER TABLE configuracoes ADD COLUMN taxa_atraso REAL NOT NULL DEFAULT 1');
  }
}

/** Só pra testes automatizados: fecha a conexão aberta pra o próximo getDb() reabrir do zero. */
export function fecharDbParaTestes(): void {
  if (sqlJsDb) {
    sqlJsDb.close();
    sqlJsDb = null;
  }
}
