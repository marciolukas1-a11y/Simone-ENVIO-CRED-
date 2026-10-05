import { getDb } from '../db/database.js';

/** Registra o consentimento do cliente (ex: concordou em mandar RG) -- LGPD. */
export function registrarConsentimento(telefone: string, tipo: string, texto: string): void {
  getDb()
    .prepare('INSERT INTO consentimentos (telefone, tipo, texto) VALUES (?, ?, ?)')
    .run(telefone, tipo, texto);
}

export function listarConsentimentos(telefone: string) {
  return getDb()
    .prepare('SELECT * FROM consentimentos WHERE telefone = ? ORDER BY concedido_em')
    .all(telefone);
}
