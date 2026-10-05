import 'dotenv/config';

/**
 * Configuração do servidor. A maior parte é opcional com um padrão
 * sensato -- de propósito, pra dar pra rodar sem editar nenhum arquivo.
 * Chaves de IA (Groq/SearchApi) não ficam aqui: são configuráveis pelo
 * próprio app (ver src/segredos.ts) porque editar um .env num celular,
 * sem computador, é genuinamente difícil.
 */
function opcional(nome: string, padrao: string): string {
  const valor = process.env[nome];
  return valor && valor.trim() !== '' ? valor : padrao;
}

export const config = {
  groq: {
    model: opcional('GROQ_MODEL', 'openai/gpt-oss-120b'),
  },
  research: {
    provider: opcional('RESEARCH_PROVIDER', 'searchapi'),
  },
  whatsapp: {
    sessionDir: opcional('WHATSAPP_SESSION_DIR', './dados/sessao-whatsapp'),
    phoneNumber: opcional('WHATSAPP_PHONE_NUMBER', '5583999628152'),
  },
  database: {
    path: opcional('DATABASE_PATH', './dados/enviocred.sqlite'),
  },
  server: {
    port: Number(opcional('PORT', '3000')),
    host: opcional('HOST', '0.0.0.0'),
  },
  horario: {
    inicio: opcional('HORARIO_INICIO', '08:00'),
    fim: opcional('HORARIO_FIM', '20:00'),
  },
} as const;
