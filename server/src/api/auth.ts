import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Exige "Authorization: Bearer <APP_API_TOKEN>" em toda rota /api, exceto
 * /health. Lê de process.env.APP_API_TOKEN diretamente (não de um valor
 * fixo importado) porque o token pode ter sido gerado automaticamente no
 * boot (ver src/segredos.ts) depois que este módulo já tinha sido carregado.
 */
export async function exigirToken(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!process.env.APP_API_TOKEN || token !== process.env.APP_API_TOKEN) {
    reply.code(401).send({ erro: 'token inválido' });
  }
}
