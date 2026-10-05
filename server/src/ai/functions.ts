import { calcularSimulacao, formatarReais } from '../domain/priceCalculator.js';
import { cadastrarOuAtualizarCliente, moverEtapa, type Etapa, type Interesse } from '../domain/clientes.js';
import { listarObjetosDisponiveis, buscarObjeto } from '../domain/objetos.js';
import { obterConfiguracoes } from '../domain/configuracoes.js';
import { criarResearchProvider } from '../research/index.js';
import { logger } from '../logging/logger.js';

/**
 * Definições das 7 funções mínimas exigidas (ordem de serviço, seção 3.3),
 * no formato que a API da Groq (compatível com OpenAI) espera em `tools`.
 */
export const DEFINICOES_FUNCOES = [
  {
    type: 'function' as const,
    function: {
      name: 'simular_emprestimo',
      description: 'Calcula uma simulação de empréstimo pessoal pela tabela Price (parcelas fixas). Use sempre que o cliente perguntar sobre valores, parcelas ou condições de empréstimo.',
      parameters: {
        type: 'object',
        properties: {
          valor: { type: 'number', description: 'Valor do empréstimo em reais' },
          parcelas: { type: 'integer', description: 'Número de parcelas' },
          taxa_ao_mes: { type: 'number', description: 'Taxa de juros ao mês, em porcentagem (ex: 5 para 5%). Se o cliente não falar, use a taxa padrão configurada.' },
        },
        required: ['valor', 'parcelas'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cadastrar_ou_atualizar_cliente',
      description: 'Cadastra um cliente novo ou atualiza um já existente (mesmo telefone). Use sempre que souber o nome do cliente ou o que ele está interessado.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          interesse: { type: 'string', enum: ['emprestimo', 'objeto'] },
          valor: { type: 'number' },
          observacoes: { type: 'string', description: 'Anotação curta sobre a conversa' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mover_etapa',
      description: 'Move o cliente para outra etapa do funil de vendas.',
      parameters: {
        type: 'object',
        properties: {
          etapa: { type: 'string', enum: ['novo', 'simulacao', 'proposta', 'contratado', 'perdido'] },
        },
        required: ['etapa'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_objetos_disponiveis',
      description: 'Lista todos os objetos disponíveis pra venda agora, com preço.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_objeto',
      description: 'Busca um objeto específico pelo nome ou descrição.',
      parameters: {
        type: 'object',
        properties: { texto: { type: 'string', description: 'O que o cliente está procurando' } },
        required: ['texto'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'pesquisar_preco',
      description: 'Pesquisa na internet uma estimativa de preço de mercado de um objeto usado, ou tira uma dúvida geral que você não sabe responder. USE SÓ QUANDO REALMENTE NECESSÁRIO -- é uma busca paga.',
      parameters: {
        type: 'object',
        properties: { consulta: { type: 'string' } },
        required: ['consulta'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'transferir_para_humano',
      description: 'Transfere a conversa pra Simone atender pessoalmente. Use sempre que o cliente quiser fechar negócio, pedir humano, reclamar, falar de dívida/cobrança, ou você não tiver certeza do que responder.',
      parameters: {
        type: 'object',
        properties: { motivo: { type: 'string' } },
        required: ['motivo'],
      },
    },
  },
];

export interface ContextoExecucao {
  telefone: string;
  onTransferirParaHumano: (motivo: string) => void;
}

/** Executa uma função chamada pelo modelo e devolve o resultado (como string JSON) pra ele continuar. */
export async function executarFuncao(
  nome: string,
  argsTexto: string,
  ctx: ContextoExecucao
): Promise<string> {
  let args: any = {};
  try {
    args = argsTexto ? JSON.parse(argsTexto) : {};
  } catch {
    return JSON.stringify({ erro: 'argumentos inválidos' });
  }

  try {
    switch (nome) {
      case 'simular_emprestimo': {
        const cfg = obterConfiguracoes();
        const resultado = calcularSimulacao({
          valor: args.valor,
          parcelas: args.parcelas,
          taxaAoMes: args.taxa_ao_mes ?? cfg.taxa_padrao,
        });
        return JSON.stringify({
          valor: formatarReais(resultado.valor),
          parcelas: resultado.parcelas,
          valor_parcela: formatarReais(resultado.valorParcela),
          taxa_ao_mes: `${resultado.taxaAoMes}%`,
          total_a_pagar: formatarReais(resultado.totalAPagar),
          aviso: 'valores sujeitos à análise',
        });
      }

      case 'cadastrar_ou_atualizar_cliente': {
        const cliente = cadastrarOuAtualizarCliente({
          telefone: ctx.telefone,
          nome: args.nome,
          interesse: args.interesse as Interesse | undefined,
          valor: args.valor,
          observacoes: args.observacoes,
        });
        return JSON.stringify({ ok: true, cliente_id: cliente.id });
      }

      case 'mover_etapa': {
        const cliente = moverEtapa(ctx.telefone, args.etapa as Etapa);
        return JSON.stringify({ ok: true, etapa: cliente?.etapa });
      }

      case 'listar_objetos_disponiveis': {
        const objetos = listarObjetosDisponiveis();
        return JSON.stringify(
          objetos.map((o) => ({ nome: o.nome, preco: formatarReais(o.preco), descricao: o.descricao }))
        );
      }

      case 'buscar_objeto': {
        const objetos = buscarObjeto(args.texto ?? '');
        return JSON.stringify(
          objetos.map((o) => ({ nome: o.nome, preco: formatarReais(o.preco), status: o.status, descricao: o.descricao }))
        );
      }

      case 'pesquisar_preco': {
        try {
          const provider = criarResearchProvider();
          const resultado = await provider.pesquisar(args.consulta ?? '');
          if (!resultado.resumo) {
            return JSON.stringify({ encontrado: false, aviso: 'não encontrei nada -- diga que vai confirmar com a Simone' });
          }
          return JSON.stringify({ encontrado: true, resumo: resultado.resumo, fontes: resultado.fontes, aviso: 'isto é uma ESTIMATIVA' });
        } catch (e) {
          logger.error(e, 'Falha na pesquisa');
          return JSON.stringify({ encontrado: false, aviso: 'pesquisa falhou -- diga que vai confirmar com a Simone, não invente' });
        }
      }

      case 'transferir_para_humano': {
        ctx.onTransferirParaHumano(args.motivo ?? 'não especificado');
        return JSON.stringify({ ok: true });
      }

      default:
        return JSON.stringify({ erro: `função desconhecida: ${nome}` });
    }
  } catch (e) {
    logger.error(e, `Erro executando função ${nome}`);
    return JSON.stringify({ erro: 'falha interna ao executar a função' });
  }
}
