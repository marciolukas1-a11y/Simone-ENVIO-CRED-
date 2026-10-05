/**
 * Proteções anti-bloqueio do número, exigidas pela ordem de serviço (seção 3.7):
 * - só responde quem escreveu primeiro (garantido pela arquitetura: a IA só
 *   roda a partir de um evento de mensagem recebida, nunca manda primeiro -- ver
 *   whatsapp/onMensagemRecebida.ts, que é o único lugar que chama enviarResposta)
 * - nunca manda mensagem em massa (não existe função de broadcast neste código)
 * - espera um tempo variável e mostra "digitando" antes de responder
 * - limite de mensagens por minuto e por dia, por número
 * - sem links encurtados
 * - interruptor geral pra pausar a IA (ver domain/configuracoes.ts -- pausarIa)
 */

const LIMITE_POR_MINUTO = 6;
const LIMITE_POR_DIA = 120;

interface Contador {
  minuto: { inicio: number; count: number };
  dia: { inicio: number; count: number };
}

const contadores = new Map<string, Contador>();

function agora(): number {
  return Date.now();
}

function obterContador(telefone: string): Contador {
  let c = contadores.get(telefone);
  const t = agora();
  if (!c) {
    c = { minuto: { inicio: t, count: 0 }, dia: { inicio: t, count: 0 } };
    contadores.set(telefone, c);
  }
  if (t - c.minuto.inicio > 60_000) c.minuto = { inicio: t, count: 0 };
  if (t - c.dia.inicio > 24 * 60 * 60_000) c.dia = { inicio: t, count: 0 };
  return c;
}

export function podeEnviarPara(telefone: string): boolean {
  const c = obterContador(telefone);
  return c.minuto.count < LIMITE_POR_MINUTO && c.dia.count < LIMITE_POR_DIA;
}

export function registrarEnvioPara(telefone: string): void {
  const c = obterContador(telefone);
  c.minuto.count += 1;
  c.dia.count += 1;
}

/** Tempo variável antes de responder (parece humano, nunca instantâneo). */
export function delayAntesDeResponderMs(): number {
  if (process.env.VITEST) return 0; // testes automatizados não esperam de verdade
  return 1200 + Math.floor(Math.random() * 2800); // 1.2s a 4s
}

const DOMINIOS_ENCURTADOS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'ow.ly', 'cutt.ly', 'rebrand.ly'];

export function contemLinkEncurtado(texto: string): boolean {
  const alvo = texto.toLowerCase();
  return DOMINIOS_ENCURTADOS.some((d) => alvo.includes(d));
}

/** Checagem final antes de qualquer envio automático pela IA. */
export function podeIaEnviar(telefone: string, texto: string): { ok: true } | { ok: false; motivo: string } {
  if (!podeEnviarPara(telefone)) {
    return { ok: false, motivo: 'limite de mensagens por minuto/dia atingido pra este número' };
  }
  if (contemLinkEncurtado(texto)) {
    return { ok: false, motivo: 'resposta continha link encurtado -- bloqueado por segurança' };
  }
  return { ok: true };
}
