import { getDb } from '../db/database.js';

export type StatusObjeto = 'disponivel' | 'reservado' | 'vendido';

export interface Objeto {
  id: number;
  nome: string;
  preco: number;
  status: StatusObjeto;
  descricao: string;
  descricao_venda: string;
  foto: string;
  app_item_id: string;
}

export function listarObjetosDisponiveis(): Objeto[] {
  return getDb()
    .prepare(`SELECT * FROM objetos WHERE status = 'disponivel' ORDER BY nome`)
    .all() as Objeto[];
}

export function listarTodosObjetos(): Objeto[] {
  return getDb().prepare('SELECT * FROM objetos ORDER BY nome').all() as Objeto[];
}

/** Busca por nome/descrição (texto livre, usado pela IA). */
export function buscarObjeto(texto: string): Objeto[] {
  const like = `%${texto.trim()}%`;
  return getDb()
    .prepare(`SELECT * FROM objetos WHERE nome LIKE ? OR descricao LIKE ? ORDER BY nome`)
    .all(like, like) as Objeto[];
}

export function criarObjeto(dados: Omit<Objeto, 'id'>): Objeto {
  const db = getDb();
  const info = db
    .prepare(
      'INSERT INTO objetos (nome, preco, status, descricao, descricao_venda, foto, app_item_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      dados.nome,
      dados.preco,
      dados.status,
      dados.descricao,
      dados.descricao_venda ?? '',
      dados.foto ?? '',
      dados.app_item_id ?? ''
    );
  return db.prepare('SELECT * FROM objetos WHERE id = ?').get(info.lastInsertRowid) as Objeto;
}

export function atualizarObjeto(id: number, dados: Partial<Omit<Objeto, 'id'>>): Objeto | undefined {
  const db = getDb();
  db.prepare(
    `UPDATE objetos SET
       nome = COALESCE(?, nome),
       preco = COALESCE(?, preco),
       status = COALESCE(?, status),
       descricao = COALESCE(?, descricao),
       descricao_venda = COALESCE(?, descricao_venda),
       foto = COALESCE(?, foto),
       app_item_id = COALESCE(?, app_item_id)
     WHERE id = ?`
  ).run(
    dados.nome ?? null,
    dados.preco ?? null,
    dados.status ?? null,
    dados.descricao ?? null,
    dados.descricao_venda ?? null,
    dados.foto ?? null,
    dados.app_item_id ?? null,
    id
  );
  return db.prepare('SELECT * FROM objetos WHERE id = ?').get(id) as Objeto | undefined;
}

export function buscarPorAppItemId(appItemId: string): Objeto | undefined {
  if (!appItemId) return undefined;
  return getDb().prepare('SELECT * FROM objetos WHERE app_item_id = ?').get(appItemId) as Objeto | undefined;
}

/** Sincroniza um objeto vindo do app: atualiza se já existir (mesmo app_item_id), senão cria. */
export function sincronizarObjetoDoApp(dados: Omit<Objeto, 'id'>): Objeto {
  const existente = buscarPorAppItemId(dados.app_item_id);
  if (existente) {
    return atualizarObjeto(existente.id, dados) as Objeto;
  }
  return criarObjeto(dados);
}
