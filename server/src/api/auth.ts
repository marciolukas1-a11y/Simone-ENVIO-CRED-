import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/** Exige "Authorization: Bearer <APP_API_TOKEN>" em toda rota /api, exceto /health. */
export async function exigirToken(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== config.app.apiToken) {
    reply.code(401).send({ erro: 'token inválido' });
  }
}
