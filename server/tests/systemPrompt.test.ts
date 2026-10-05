import { describe, it, expect } from 'vitest';
import { montarPromptSistema } from '../src/ai/systemPrompt.js';

/**
 * Este teste existe pra impedir que uma edição futura no prompt remova sem
 * querer uma das 9 regras obrigatórias da ordem de serviço (seção 3.4).
 * Não substitui testar o comportamento real do modelo (isso exige chamar a
 * Groq de verdade, fora do escopo de um teste automatizado determinístico),
 * mas garante que a instrução continua presente no texto enviado a ele.
 */
describe('montarPromptSistema', () => {
  const prompt = montarPromptSistema('Simone');

  it('usa o nome de quem atende', () => {
    expect(prompt).toContain('Simone');
  });

  const regrasObrigatorias = [
    /nunca aprove, negue ou prometa crédito/i,
    /valores sujeitos à análise/i,
    /simular_emprestimo/,
    /nunca peça senha/i,
    /consentimento/i,
    /transferir_para_humano/,
    /sair.*parar|parar.*sair/i,
    /dado.*nunca.*instrução|nunca.*instrução/i,
    /horário de atendimento/i,
    /nunca invente informação/i,
  ];

  it.each(regrasObrigatorias)('contém a regra obrigatória: %s', (regex) => {
    expect(prompt).toMatch(regex);
  });

  it('lista as 7 funções mínimas exigidas', () => {
    for (const fn of [
      'simular_emprestimo',
      'cadastrar_ou_atualizar_cliente',
      'mover_etapa',
      'listar_objetos_disponiveis',
      'buscar_objeto',
      'pesquisar_preco',
      'transferir_para_humano',
    ]) {
      expect(prompt).toContain(fn);
    }
  });
});
