import 'dotenv/config';

/**
 * Toda configuração sensível vem de variáveis de ambiente (.env) -- nenhuma
 * chave de API fica no código, no app ou no Git. Ver .env.example.
 */
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Variável de ambiente obrigatória "${nome}" não configurada. Copie .env.example para .env e preencha.`
    );
  }
  return valor;
}

function opcional(nome: string, padrao: string): string {
  const valor = process.env[nome];
  return valor && valor.trim() !== '' ? valor : padrao;
}

export const config = {
  groq: {
    apiKey: obrigatoria('GROQ_API_KEY'),
    model: opcional('GROQ_MODEL', 'openai/gpt-oss-120b'),
  },
  research: {
    provider: opcional('RESEARCH_PROVIDER', 'searchapi'),
    apiKey: process.env.RESEARCH_API_KEY ?? '',
  },
  whatsapp: {
    sessionDir: opcional('WHATSAPP_SESSION_DIR', './dados/sessao-whatsapp'),
    phoneNumber: obrigatoria('WHATSAPP_PHONE_NUMBER'),
  },
  app: {
    apiToken: obrigatoria('APP_API_TOKEN'),
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
