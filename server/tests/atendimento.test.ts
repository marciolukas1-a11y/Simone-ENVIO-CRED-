import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { config } from '../src/config.js';
import { fecharDbParaTestes } from '../src/db/database.js';
import type { WhatsAppGateway, StatusConexao } from '../src/whatsapp/WhatsAppGateway.js';
import { salvarConfiguracoes } from '../src/domain/configuracoes.js';
import { podeContatar } from '../src/domain/clientes.js';
import { obterOuCriarConversa } from '../src/domain/conversas.js';

vi.mock('../src/ai/groqClient.js', () => ({
  conversarComGroq: vi.fn(async () => 'resposta simulada da IA'),
}));

beforeEach(() => {
  fecharDbParaTestes();
  const caminho = config.database.path;
  for (const sufixo of ['', '-wal', '-shm']) {
    if (existsSync(caminho + sufixo)) unlinkSync(caminho + sufixo);
  }
  vi.clearAllMocks();
});

class GatewayFalso implements WhatsAppGateway {
  mensagensEnviadas: Array<{ telefone: string; texto: string }> = [];
  private handlers: Array<(telefone: string, texto: string) => void | Promise<void>> = [];

  async iniciar() {}
  async obterCodigoPareamento() {
    return '12345678';
  }
  async enviarTexto(telefone: string, texto: string) {
    this.mensagensEnviadas.push({ telefone, texto });
  }
  async marcarDigitando() {}
  aoReceberMensagem(h: (telefone: string, texto: string) => void | Promise<void>) {
    this.handlers.push(h);
  }
  aoMudarStatus() {}
  statusAtual(): StatusConexao {
    return 'conectado';
  }

  async simularMensagemRecebida(telefone: string, texto: string) {
    for (const h of this.handlers) await h(telefone, texto);
  }
}

describe('pipeline de atendimento', () => {
  it('SAIR marca o cliente como não-contatar e nunca chama a IA', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    salvarConfiguracoes({ horario_inicio: '00:00', horario_fim: '23:59' });

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);

    await gw.simularMensagemRecebida('5583977777777', 'SAIR');

    expect(podeContatar('5583977777777')).toBe(false);
    expect(conversarComGroq).not.toHaveBeenCalled();
    expect(gw.mensagensEnviadas).toHaveLength(1);
  });

  it('cliente que já pediu SAIR antes é ignorado em mensagens futuras', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    salvarConfiguracoes({ horario_inicio: '00:00', horario_fim: '23:59' });

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);

    await gw.simularMensagemRecebida('5583988888888', 'PARAR');
    await gw.simularMensagemRecebida('5583988888888', 'oi, mudei de ideia');

    expect(conversarComGroq).not.toHaveBeenCalled();
  });

  it('fora do horário de atendimento, responde mensagem automática e não chama a IA', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    // Horário que nunca bate com a hora atual real (janela impossível).
    salvarConfiguracoes({ horario_inicio: '03:00', horario_fim: '03:01' });

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);
    await gw.simularMensagemRecebida('5583999999999', 'oi, quero um empréstimo');

    const horaAtual = new Date().getHours();
    if (horaAtual === 3) return; // evita falso negativo no raro caso de rodar às 3h

    expect(conversarComGroq).not.toHaveBeenCalled();
    expect(gw.mensagensEnviadas[0]?.texto).toMatch(/fora do horário/i);
  });

  it('conversa assumida pela Simone não aciona a IA', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    const { assumirConversa } = await import('../src/domain/conversas.js');
    salvarConfiguracoes({ horario_inicio: '00:00', horario_fim: '23:59' });

    const telefone = '5583900011122';
    obterOuCriarConversa(telefone);
    assumirConversa(telefone);

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);
    await gw.simularMensagemRecebida(telefone, 'oi');

    expect(conversarComGroq).not.toHaveBeenCalled();
  });

  it('IA pausada no interruptor geral não responde', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    const { pausarIa } = await import('../src/domain/configuracoes.js');
    salvarConfiguracoes({ horario_inicio: '00:00', horario_fim: '23:59' });
    pausarIa();

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);
    await gw.simularMensagemRecebida('5583900033344', 'oi');

    expect(conversarComGroq).not.toHaveBeenCalled();
  });

  it('em condições normais, chama a IA e manda a resposta pelo WhatsApp', async () => {
    const { registrarPipelineAtendimento } = await import('../src/atendimento.js');
    const { conversarComGroq } = await import('../src/ai/groqClient.js');
    salvarConfiguracoes({ horario_inicio: '00:00', horario_fim: '23:59' });

    const gw = new GatewayFalso();
    registrarPipelineAtendimento(gw);
    await gw.simularMensagemRecebida('5583900055566', 'oi, quero simular um empréstimo');

    expect(conversarComGroq).toHaveBeenCalledOnce();
    expect(gw.mensagensEnviadas[0]?.texto).toBe('resposta simulada da IA');
  });
});
