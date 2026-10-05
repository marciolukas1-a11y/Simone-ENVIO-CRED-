import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './logging/logger.js';
import { BaileysGateway } from './whatsapp/BaileysGateway.js';
import { registrarPipelineAtendimento } from './atendimento.js';
import { registrarRotas } from './api/routes.js';

async function principal() {
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
  logger.info(
    { porta: config.server.port },
    `Servidor ENVIO CRED no ar. Se o WhatsApp ainda não estiver pareado, chame POST /api/whatsapp/parear pra pegar o código de 8 dígitos.`
  );
}

principal().catch((e) => {
  logger.error(e, 'Falha ao iniciar o servidor');
  process.exit(1);
});
