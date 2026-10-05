import { getDb } from '../db/database.js';

export type AtendidoPor = 'ia' | 'simone';
export type AutorMensagem = 'ia' | 'simone' | 'cliente' | 'sistema';

export interface Conversa {
  telefone: string;
  atendido_por: AtendidoPor;
  pausado_ia: number;
  ultima_mensagem: string;
  criado_em: string;
  atualizado_em: string;
}

export function obterOuCriarConversa(telefone: string): Conversa {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO conversas (telefone) VALUES (?)').run(telefone);
  return db.prepare('SELECT * FROM conversas WHERE telefone = ?').get(telefone) as Conversa;
}

export function listarConversas(): Conversa[] {
  return getDb().prepare('SELECT * FROM conversas ORDER BY atualizado_em DESC').all() as Conversa[];
}

export function assumirConversa(telefone: string): void {
  getDb()
    .prepare(`UPDATE conversas SET atendido_por = 'simone', atualizado_em = datetime('now') WHERE telefone = ?`)
    .run(telefone);
}

export function devolverParaIa(telefone: string): void {
  getDb()
    .prepare(`UPDATE conversas SET atendido_por = 'ia', atualizado_em = datetime('now') WHERE telefone = ?`)
    .run(telefone);
}

export function estaAtendidoPelaIa(telefone: string): boolean {
  const c = obterOuCriarConversa(telefone);
  return c.atendido_por === 'ia' && c.pausado_ia === 0;
}

export function registrarMensagem(telefone: string, direcao: 'entrada' | 'saida', texto: string, autor: AutorMensagem): void {
  const db = getDb();
  obterOuCriarConversa(telefone);
  db.prepare('INSERT INTO mensagens (telefone, direcao, texto, autor) VALUES (?, ?, ?, ?)').run(
    telefone,
    direcao,
    texto,
    autor
  );
  db.prepare(
    `UPDATE conversas SET ultima_mensagem = ?, atualizado_em = datetime('now') WHERE telefone = ?`
  ).run(texto.slice(0, 200), telefone);
}

export interface Mensagem {
  id: number;
  telefone: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  autor: AutorMensagem;
  criado_em: string;
}

/** Últimas N mensagens de uma conversa, em ordem cronológica -- usado como contexto pro Groq. */
export function historicoRecente(telefone: string, limite = 20): Mensagem[] {
  const rows = getDb()
    .prepare('SELECT * FROM mensagens WHERE telefone = ? ORDER BY id DESC LIMIT ?')
    .all(telefone, limite) as Mensagem[];
  return rows.reverse();
}

export function listarMensagens(telefone: string): Mensagem[] {
  return getDb()
    .prepare('SELECT * FROM mensagens WHERE telefone = ? ORDER BY id ASC')
    .all(telefone) as Mensagem[];
}
