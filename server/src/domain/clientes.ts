import { getDb } from '../db/database.js';

export type Etapa = 'novo' | 'simulacao' | 'proposta' | 'contratado' | 'perdido';
export type Interesse = 'emprestimo' | 'objeto';

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  interesse: Interesse;
  valor: number;
  etapa: Etapa;
  observacoes: string;
  nao_contatar: number;
  criado_em: string;
  atualizado_em: string;
}

export function buscarClientePorTelefone(telefone: string): Cliente | undefined {
  return getDb().prepare('SELECT * FROM clientes WHERE telefone = ?').get(telefone) as Cliente | undefined;
}

export function buscarClientePorId(id: number): Cliente | undefined {
  return getDb().prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Cliente | undefined;
}

export function listarClientes(): Cliente[] {
  return getDb().prepare('SELECT * FROM clientes ORDER BY atualizado_em DESC').all() as Cliente[];
}

export interface DadosCliente {
  nome?: string;
  telefone: string;
  interesse?: Interesse;
  valor?: number;
  etapa?: Etapa;
  observacoes?: string;
}

/** Cadastra se não existir; se existir (mesmo telefone), atualiza só os campos informados. */
export function cadastrarOuAtualizarCliente(dados: DadosCliente): Cliente {
  const db = getDb();
  const existente = buscarClientePorTelefone(dados.telefone);

  if (existente) {
    db.prepare(
      `UPDATE clientes SET
         nome = COALESCE(?, nome),
         interesse = COALESCE(?, interesse),
         valor = COALESCE(?, valor),
         etapa = COALESCE(?, etapa),
         observacoes = CASE WHEN ? IS NOT NULL THEN observacoes || CASE WHEN observacoes = '' THEN '' ELSE char(10) END || ? ELSE observacoes END,
         atualizado_em = datetime('now')
       WHERE telefone = ?`
    ).run(
      dados.nome ?? null,
      dados.interesse ?? null,
      dados.valor ?? null,
      dados.etapa ?? null,
      dados.observacoes ?? null,
      dados.observacoes ?? null,
      dados.telefone
    );
    return buscarClientePorTelefone(dados.telefone)!;
  }

  db.prepare(
    `INSERT INTO clientes (nome, telefone, interesse, valor, etapa, observacoes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    dados.nome ?? '',
    dados.telefone,
    dados.interesse ?? 'emprestimo',
    dados.valor ?? 0,
    dados.etapa ?? 'novo',
    dados.observacoes ?? ''
  );
  return buscarClientePorTelefone(dados.telefone)!;
}

export function moverEtapa(telefone: string, etapa: Etapa): Cliente | undefined {
  getDb()
    .prepare(`UPDATE clientes SET etapa = ?, atualizado_em = datetime('now') WHERE telefone = ?`)
    .run(etapa, telefone);
  return buscarClientePorTelefone(telefone);
}

/** Cliente pediu SAIR/PARAR -- nunca mais contatar esse número. */
export function marcarNaoContatar(telefone: string): void {
  getDb()
    .prepare(`UPDATE clientes SET nao_contatar = 1, atualizado_em = datetime('now') WHERE telefone = ?`)
    .run(telefone);
  // Garante que o cliente existe mesmo que ainda não tivesse cadastro.
  if (!buscarClientePorTelefone(telefone)) {
    getDb()
      .prepare(`INSERT INTO clientes (telefone, nao_contatar) VALUES (?, 1)`)
      .run(telefone);
  }
}

export function podeContatar(telefone: string): boolean {
  const c = buscarClientePorTelefone(telefone);
  return !c || c.nao_contatar === 0;
}

/** LGPD: apaga todos os dados de um cliente (cadastro, mensagens, consentimentos). */
export function apagarDadosCliente(telefone: string): void {
  const db = getDb();
  const apaga = db.transaction((tel: string) => {
    db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(tel);
    db.prepare('DELETE FROM consentimentos WHERE telefone = ?').run(tel);
    db.prepare('DELETE FROM conversas WHERE telefone = ?').run(tel);
    db.prepare('DELETE FROM clientes WHERE telefone = ?').run(tel);
  });
  apaga(telefone);
}
