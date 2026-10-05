import type { WhatsAppGateway } from './whatsapp/WhatsAppGateway.js';
import { conversarComGroq } from './ai/groqClient.js';
import {
  estaAtendidoPelaIa,
  historicoRecente,
  registrarMensagem,
  obterOuCriarConversa,
  assumirConversa,
} from './domain/conversas.js';
import { marcarNaoContatar, podeContatar } from './domain/clientes.js';
import { obterConfiguracoes, dentroDoHorarioDeAtendimento, iaEstaPausada } from './domain/configuracoes.js';
import { podeIaEnviar, registrarEnvioPara, delayAntesDeResponderMs } from './safety/antiSpam.js';
import { logger } from './logging/logger.js';
import { mascararTelefone } from './logging/logger.js';

const PALAVRAS_SAIDA = /^\s*(sair|parar|cancelar|n[aã]o\s+quero\s+mais)\s*[.!]?\s*$/i;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pipeline central: toda mensagem recebida do WhatsApp passa por aqui.
 * As checagens determinísticas (SAIR/PARAR, opt-out, horário, IA pausada,
 * conversa assumida pela Simone) acontecem ANTES de qualquer chamada à IA --
 * de propósito, pra essas regras nunca dependerem do modelo "decidir" certo.
 */
export function registrarPipelineAtendimento(gateway: WhatsAppGateway): void {
  gateway.aoReceberMensagem(async (telefone, texto) => {
    registrarMensagem(telefone, 'entrada', texto, 'cliente');
    logger.info({ telefone: mascararTelefone(telefone) }, 'Mensagem recebida');

    // Regra 6: SAIR/PARAR -- some da lista de contato, sem exceção.
    if (PALAVRAS_SAIDA.test(texto)) {
      marcarNaoContatar(telefone);
      await gateway.enviarTexto(telefone, 'Combinado, não vamos mais te enviar mensagens. Qualquer coisa, é só chamar de novo quando quiser.');
      registrarMensagem(telefone, 'saida', 'Combinado, não vamos mais te enviar mensagens.', 'sistema');
      return;
    }

    if (!podeContatar(telefone)) {
      logger.info({ telefone: mascararTelefone(telefone) }, 'Cliente optou por não ser mais contatado -- ignorando');
      return;
    }

    const conversa = obterOuCriarConversa(telefone);

    // A Simone assumiu essa conversa manualmente -- a IA fica calada.
    if (conversa.atendido_por === 'simone') {
      return;
    }

    // Interruptor geral de pausa da IA (botão no app).
    if (iaEstaPausada()) {
      return;
    }

    // Regra 8: fora do horário configurado, mensagem automática e nada de IA.
    if (!dentroDoHorarioDeAtendimento()) {
      const cfg = obterConfiguracoes();
      const aviso = `Oi! No momento estamos fora do horário de atendimento (${cfg.horario_inicio} às ${cfg.horario_fim}). Assim que possível a gente te responde.`;
      await gateway.enviarTexto(telefone, aviso);
      registrarMensagem(telefone, 'saida', aviso, 'sistema');
      return;
    }

    if (!estaAtendidoPelaIa(telefone)) {
      return;
    }

    try {
      await gateway.marcarDigitando(telefone);
      await esperar(delayAntesDeResponderMs());

      const cfg = obterConfiguracoes();
      const historico = historicoRecente(telefone, 20);

      const respostaTexto = await conversarComGroq(telefone, cfg.atendente, texto, historico, (motivo) => {
        assumirConversa(telefone);
        logger.info({ telefone: mascararTelefone(telefone), motivo }, 'Conversa transferida para a Simone');
      });

      if (!respostaTexto) return;

      const checagem = podeIaEnviar(telefone, respostaTexto);
      if (!checagem.ok) {
        logger.warn({ telefone: mascararTelefone(telefone), motivo: checagem.motivo }, 'Envio bloqueado pela proteção anti-bloqueio');
        return;
      }

      await gateway.enviarTexto(telefone, respostaTexto);
      registrarEnvioPara(telefone);
      registrarMensagem(telefone, 'saida', respostaTexto, 'ia');
    } catch (e) {
      logger.error(e, 'Falha no pipeline de atendimento');
    }
  });
}
