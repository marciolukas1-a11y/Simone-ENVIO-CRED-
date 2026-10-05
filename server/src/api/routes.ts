import type { FastifyInstance } from 'fastify';
import { exigirToken } from './auth.js';
import type { WhatsAppGateway } from '../whatsapp/WhatsAppGateway.js';
import { listarClientes, buscarClientePorTelefone, apagarDadosCliente } from '../domain/clientes.js';
import { listarTodosObjetos, criarObjeto, atualizarObjeto, sincronizarObjetoDoApp } from '../domain/objetos.js';
import {
  listarConversas,
  assumirConversa,
  devolverParaIa,
  listarMensagens,
  historicoRecente,
  registrarMensagem,
} from '../domain/conversas.js';
import { obterConfiguracoes, salvarConfiguracoes, pausarIa, retomarIa } from '../domain/configuracoes.js';
import { conversarComGroq, gerarDescricaoDeVenda } from '../ai/groqClient.js';
import { salvarChavesDeIa, statusChaves } from '../segredos.js';
import { logger } from '../logging/logger.js';

export function registrarRotas(app: FastifyInstance, gateway: WhatsAppGateway): void {
  app.get('/health', async () => ({ ok: true }));

  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return;
    await exigirToken(req, reply);
  });

  // --- WhatsApp: pareamento e status ---
  app.get('/api/whatsapp/status', async () => ({ status: gateway.statusAtual() }));

  app.post('/api/whatsapp/parear', async (req, reply) => {
    try {
      const codigo = await gateway.obterCodigoPareamento();
      return { codigo };
    } catch (e: any) {
      reply.code(400);
      return { erro: e.message };
    }
  });

  // --- Clientes ---
  app.get('/api/clientes', async () => listarClientes());

  app.delete('/api/clientes/:telefone', async (req) => {
    const { telefone } = req.params as { telefone: string };
    apagarDadosCliente(telefone);
    return { ok: true };
  });

  // --- Objetos ---
  // Catálogo que a IA realmente usa pra vender no WhatsApp (listar_objetos_disponiveis/
  // buscar_objeto, em ai/functions.ts) -- sincronizado a partir dos objetos
  // cadastrados na aba Objetos do app (ver app_item_id, que liga os dois).
  app.get('/api/objetos', async () => listarTodosObjetos());

  app.post('/api/objetos', async (req) => {
    const body = req.body as any;
    const dados = {
      nome: body.nome,
      preco: Number(body.preco) || 0,
      status: body.status ?? 'disponivel',
      descricao: body.descricao ?? '',
      descricao_venda: body.descricao_venda ?? '',
      foto: body.foto ?? '',
      app_item_id: body.app_item_id ?? '',
    };
    // Com app_item_id, isto é uma sincronização vinda do app (atualiza se já
    // existir); sem ele, continua funcionando como criação simples de sempre.
    return dados.app_item_id ? sincronizarObjetoDoApp(dados) : criarObjeto(dados);
  });

  app.put('/api/objetos/:id', async (req) => {
    const { id } = req.params as { id: string };
    return atualizarObjeto(Number(id), req.body as any);
  });

  // Corrige digitação e reescreve a descrição crua do objeto como texto de
  // venda persuasivo -- não grava nada, só devolve o texto pro app salvar.
  app.post('/api/objetos/gerar-descricao', async (req, reply) => {
    const body = req.body as any;
    const descricao = String(body?.descricao ?? '').trim();
    if (!descricao) {
      reply.code(400);
      return { erro: 'descricao é obrigatória' };
    }
    try {
      const descricaoVenda = await gerarDescricaoDeVenda(descricao);
      return { descricao_venda: descricaoVenda };
    } catch (e: any) {
      reply.code(502);
      return { erro: e.message ?? 'falha ao gerar descrição' };
    }
  });

  // --- Configurações ---
  // Nunca devolve as chaves de IA de volta pro app -- só se estão
  // configuradas ou não (statusChaves), pra não ficar reexibindo segredo.
  app.get('/api/configuracoes', async () => {
    const cfg = obterConfiguracoes();
    const { groq_api_key, research_api_key, ...resto } = cfg;
    return { ...resto, chaves: statusChaves() };
  });

  app.put('/api/configuracoes', async (req) => {
    const { groq_api_key, research_api_key, ...resto } = req.body as any;
    return salvarConfiguracoes(resto);
  });

  // --- Chaves de IA: configuradas pela tela "Chaves de IA" do app, nunca
  // digitadas em arquivo -- ver src/segredos.ts. ---
  app.post('/api/chaves', async (req) => {
    const { groq_api_key, research_api_key } = req.body as { groq_api_key?: string; research_api_key?: string };
    salvarChavesDeIa(groq_api_key, research_api_key);
    return { ok: true, chaves: statusChaves() };
  });

  app.get('/api/chaves/status', async () => statusChaves());

  app.post('/api/ia/pausar', async () => {
    pausarIa();
    return { ok: true };
  });

  app.post('/api/ia/retomar', async () => {
    retomarIa();
    return { ok: true };
  });

  // --- Conversas ---
  app.get('/api/conversas', async () => listarConversas());

  app.get('/api/conversas/:telefone/mensagens', async (req) => {
    const { telefone } = req.params as { telefone: string };
    return listarMensagens(telefone);
  });

  app.post('/api/conversas/:telefone/assumir', async (req) => {
    const { telefone } = req.params as { telefone: string };
    assumirConversa(telefone);
    return { ok: true };
  });

  app.post('/api/conversas/:telefone/devolver', async (req) => {
    const { telefone } = req.params as { telefone: string };
    devolverParaIa(telefone);
    return { ok: true };
  });

  // Simone responde pelo app -- vai direto pro WhatsApp, sem passar pela IA.
  app.post('/api/conversas/:telefone/responder', async (req, reply) => {
    const { telefone } = req.params as { telefone: string };
    const { texto } = req.body as { texto: string };
    if (!texto || !texto.trim()) {
      reply.code(400);
      return { erro: 'texto é obrigatório' };
    }
    await gateway.enviarTexto(telefone, texto);
    registrarMensagem(telefone, 'saida', texto, 'simone');
    return { ok: true };
  });

  // --- Modo copiloto: Simone compartilha uma mensagem do WhatsApp pro app,
  // a IA sugere uma resposta, ela copia/edita e manda ela mesma. Não manda
  // nada pelo WhatsApp sozinho -- sem risco de bloqueio, funciona mesmo com
  // o WhatsApp do servidor desconectado.
  app.post('/api/copiloto/sugestao', async (req, reply) => {
    const { telefone, mensagem_cliente } = req.body as { telefone?: string; mensagem_cliente: string };
    if (!mensagem_cliente || !mensagem_cliente.trim()) {
      reply.code(400);
      return { erro: 'mensagem_cliente é obrigatória' };
    }
    try {
      const cfg = obterConfiguracoes();
      const historico = telefone ? historicoRecente(telefone, 10) : [];
      const sugestao = await conversarComGroq(
        telefone ?? 'copiloto-sem-numero',
        cfg.atendente,
        mensagem_cliente,
        historico,
        () => {} // no modo copiloto, "transferir pra humano" não faz sentido -- já é a Simone usando
      );
      return { sugestao };
    } catch (e) {
      logger.error(e, 'Falha gerando sugestão do copiloto');
      reply.code(502);
      return { erro: 'não consegui gerar sugestão agora' };
    }
  });
}
