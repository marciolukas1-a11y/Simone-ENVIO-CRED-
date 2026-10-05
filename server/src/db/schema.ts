/**
 * Esquema do banco local (SQLite) do motor de atendimento ENVIO CRED.
 * Guardado no aparelho (ver DATABASE_PATH no .env) -- nunca em nuvem.
 *
 * Fica como string TypeScript (em vez de um arquivo .sql separado) de
 * propósito: assim o `tsc` sempre inclui isto no build compilado (dist/),
 * sem precisar de um passo extra de "copiar arquivos .sql" que seria fácil
 * esquecer e quebrar o servidor silenciosamente em produção.
 */
export const ESQUEMA_SQL = `
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL UNIQUE,
  interesse TEXT NOT NULL DEFAULT 'emprestimo' CHECK (interesse IN ('emprestimo','objeto')),
  valor REAL NOT NULL DEFAULT 0,
  etapa TEXT NOT NULL DEFAULT 'novo' CHECK (etapa IN ('novo','simulacao','proposta','contratado','perdido')),
  observacoes TEXT NOT NULL DEFAULT '',
  nao_contatar INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS objetos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  preco REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','reservado','vendido')),
  descricao TEXT NOT NULL DEFAULT ''
);

-- Uma linha por conversa (telefone do cliente). Controla quem está
-- respondendo agora (IA ou a Simone) -- é o que o botão "Assumir conversa"
-- / "Devolver para a IA" no app muda.
CREATE TABLE IF NOT EXISTS conversas (
  telefone TEXT PRIMARY KEY,
  atendido_por TEXT NOT NULL DEFAULT 'ia' CHECK (atendido_por IN ('ia','simone')),
  pausado_ia INTEGER NOT NULL DEFAULT 0,
  ultima_mensagem TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
  texto TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT 'ia' CHECK (autor IN ('ia','simone','cliente','sistema')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mensagens_telefone ON mensagens(telefone, criado_em);

-- Consentimento LGPD (ex: cliente concordou em enviar documento).
CREATE TABLE IF NOT EXISTS consentimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone TEXT NOT NULL,
  tipo TEXT NOT NULL,
  texto TEXT NOT NULL,
  concedido_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  atendente TEXT NOT NULL DEFAULT 'Simone',
  taxa_padrao REAL NOT NULL DEFAULT 5,
  horario_inicio TEXT NOT NULL DEFAULT '08:00',
  horario_fim TEXT NOT NULL DEFAULT '20:00',
  ia_pausada INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO configuracoes (id) VALUES (1);
`;
