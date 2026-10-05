import pino from 'pino';

/**
 * Logger central. Nunca loga o corpo de mensagens de clientes nem CPF/telefone
 * completos -- só o necessário pra depurar (ids, tamanhos, status). Quem
 * precisar investigar uma conversa específica usa o banco de dados, não o log.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

/** Mascara um telefone pra log (mantém DDD, esconde o resto). Ex: 5583999628152 -> 5583*****8152 */
export function mascararTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '');
  if (d.length < 8) return '***';
  return d.slice(0, 4) + '*'.repeat(d.length - 8) + d.slice(-4);
}
