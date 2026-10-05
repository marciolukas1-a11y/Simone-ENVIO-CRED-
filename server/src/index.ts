import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './logging/logger.js';
import { garantirAppApiToken, statusChaves } from './segredos.js';
import { BaileysGateway } from './whatsapp/BaileysGateway.js';
import { registrarPipelineAtendimento } from './atendimento.js';
import { registrarRotas } from './api/routes.js';

async function principal() {
  // Token da API: gera sozinho na primeira vez, se precisar (ver aviso no log).
  garantirAppApiToken();

  const gateway = new BaileysGateway(config.whatsapp.sessionDir, config.whatsapp.phoneNumber);
  registrarPipelineAtendimento(gateway);

  gateway.aoMudarStatus((status) => {
    logger.info({ status }, 'WhatsApp: status de conexão mudou');
  });

  await gateway.iniciar();

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  registrarRotas(app, gateway);

  await app.listen({ port: config.server.port, host: config.server.host });

  const chaves = statusChaves();
  logger.info({ porta: config.server.port }, 'Servidor ENVIO CRED no ar.');
  if (!chaves.groqConfigurada || !chaves.researchConfigurada) {
    logger.warn(
      'Ainda faltam chaves de IA -- abra o app ENVIO CRED, vá em Config > Chaves de IA, e cole a chave da Groq' +
        (!chaves.researchConfigurada ? ' e da SearchApi.io.' : '.')
    );
  }
  logger.info('Se o WhatsApp ainda não estiver pareado, abra o app > Config > Parear WhatsApp (ou chame POST /api/whatsapp/parear).');
}

principal().catch((e) => {
  logger.error(e, 'Falha ao iniciar o servidor');
  process.exit(1);
});
