import { config } from '../config.js';
import { obterChaveGroq } from '../segredos.js';
import { montarPromptSistema } from './systemPrompt.js';
import { DEFINICOES_FUNCOES, executarFuncao, type ContextoExecucao } from './functions.js';
import { logger } from '../logging/logger.js';
import type { Mensagem } from '../domain/conversas.js';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

interface MensagemChat {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

function historicoParaChat(historico: Mensagem[]): MensagemChat[] {
  return historico.map((m) => ({
    role: m.direcao === 'entrada' ? 'user' : 'assistant',
    content: m.texto,
  }));
}

/**
 * Conversa uma rodada com a Groq, deixando o modelo chamar as funções que
 * precisar (loop de tool_calls) até ele devolver uma resposta de texto final.
 * Retorna o texto final pra mandar ao cliente pelo WhatsApp.
 */
export async function conversarComGroq(
  telefone: string,
  atendente: string,
  mensagemNova: string,
  historico: Mensagem[],
  onTransferirParaHumano: (motivo: string) => void
): Promise<string> {
  const mensagens: MensagemChat[] = [
    { role: 'system', content: montarPromptSistema(atendente) },
    ...historicoParaChat(historico),
    { role: 'user', content: mensagemNova },
  ];

  const ctx: ContextoExecucao = { telefone, onTransferirParaHumano };

  const chaveGroq = obterChaveGroq();
  if (!chaveGroq) {
    return 'Ainda não consigo pensar direito porque a chave da IA não foi configurada. A Simone já está resolvendo isso -- tenta de novo daqui a pouco.';
  }

  for (let rodada = 0; rodada < 6; rodada++) {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chaveGroq}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.groq.model,
        messages: mensagens,
        tools: DEFINICOES_FUNCOES,
        tool_choice: 'auto',
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      logger.error({ status: resposta.status, corpo }, 'Groq respondeu erro');
      throw new Error(`Groq respondeu ${resposta.status}`);
    }

    const dados = (await resposta.json()) as any;
    const escolha = dados.choices?.[0]?.message;
    if (!escolha) throw new Error('Groq não devolveu mensagem');

    if (!escolha.tool_calls || escolha.tool_calls.length === 0) {
      return escolha.content ?? '';
    }

    // Modelo pediu pra chamar uma ou mais funções -- executa e devolve o resultado.
    mensagens.push({ role: 'assistant', content: escolha.content ?? null, tool_calls: escolha.tool_calls });
    for (const chamada of escolha.tool_calls) {
      const resultado = await executarFuncao(chamada.function.name, chamada.function.arguments, ctx);
      mensagens.push({ role: 'tool', tool_call_id: chamada.id, content: resultado });
    }
  }

  logger.warn({ telefone }, 'Groq: limite de rodadas de função atingido sem resposta final');
  return 'Desculpa, tive um problema pra processar isso agora. Vou te colocar em contato com a Simone.';
}
