import { describe, it, expect, beforeEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { config } from '../src/config.js';
import { fecharDbParaTestes } from '../src/db/database.js';
import {
  cadastrarOuAtualizarCliente,
  buscarClientePorTelefone,
  moverEtapa,
  marcarNaoContatar,
  podeContatar,
  apagarDadosCliente,
} from '../src/domain/clientes.js';
import { registrarMensagem, listarMensagens } from '../src/domain/conversas.js';

beforeEach(() => {
  // Banco de teste limpo a cada teste.
  fecharDbParaTestes();
  const caminho = config.database.path;
  for (const sufixo of ['', '-wal', '-shm']) {
    if (existsSync(caminho + sufixo)) unlinkSync(caminho + sufixo);
  }
});

describe('clientes', () => {
  it('cadastra um cliente novo', () => {
    const c = cadastrarOuAtualizarCliente({ telefone: '5583911111111', nome: 'Maria' });
    expect(c.nome).toBe('Maria');
    expect(c.etapa).toBe('novo');
  });

  it('atualizar um cliente existente não duplica (mesmo telefone)', () => {
    cadastrarOuAtualizarCliente({ telefone: '5583922222222', nome: 'João' });
    cadastrarOuAtualizarCliente({ telefone: '5583922222222', valor: 500 });
    const c = buscarClientePorTelefone('5583922222222');
    expect(c?.nome).toBe('João'); // preservado
    expect(c?.valor).toBe(500); // atualizado
  });

  it('mover_etapa muda a etapa do cliente', () => {
    cadastrarOuAtualizarCliente({ telefone: '5583933333333', nome: 'Ana' });
    moverEtapa('5583933333333', 'simulacao');
    expect(buscarClientePorTelefone('5583933333333')?.etapa).toBe('simulacao');
  });

  it('marcarNaoContatar impede contato futuro (regra SAIR/PARAR)', () => {
    cadastrarOuAtualizarCliente({ telefone: '5583944444444', nome: 'Pedro' });
    expect(podeContatar('5583944444444')).toBe(true);
    marcarNaoContatar('5583944444444');
    expect(podeContatar('5583944444444')).toBe(false);
  });

  it('marcarNaoContatar funciona mesmo sem cadastro prévio', () => {
    expect(podeContatar('5583955555555')).toBe(true);
    marcarNaoContatar('5583955555555');
    expect(podeContatar('5583955555555')).toBe(false);
  });

  it('apagarDadosCliente (LGPD) remove cliente e mensagens', () => {
    cadastrarOuAtualizarCliente({ telefone: '5583966666666', nome: 'Carla' });
    registrarMensagem('5583966666666', 'entrada', 'oi', 'cliente');
    apagarDadosCliente('5583966666666');
    expect(buscarClientePorTelefone('5583966666666')).toBeUndefined();
    expect(listarMensagens('5583966666666')).toHaveLength(0);
  });
});
