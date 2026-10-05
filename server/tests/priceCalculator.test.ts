import { describe, it, expect } from 'vitest';
import { calcularSimulacao } from '../src/domain/priceCalculator.js';

describe('calcularSimulacao (tabela Price)', () => {
  it('calcula parcela, total e juros pra um empréstimo simples', () => {
    const r = calcularSimulacao({ valor: 1000, parcelas: 6, taxaAoMes: 5 });
    // Conferido contra a fórmula Price: PMT = P*i / (1-(1+i)^-n)
    expect(r.valorParcela).toBeCloseTo(197.02, 2);
    expect(r.totalAPagar).toBeCloseTo(1182.1, 2);
    expect(r.juros).toBeCloseTo(182.1, 2);
  });

  it('com taxa 0%, parcela é só o valor dividido pelas parcelas', () => {
    const r = calcularSimulacao({ valor: 1200, parcelas: 12, taxaAoMes: 0 });
    expect(r.valorParcela).toBeCloseTo(100, 6);
    expect(r.totalAPagar).toBeCloseTo(1200, 6);
    expect(r.juros).toBeCloseTo(0, 6);
  });

  it('nunca estoura nem divide por zero com 0 parcelas', () => {
    const r = calcularSimulacao({ valor: 500, parcelas: 0, taxaAoMes: 5 });
    expect(r.valorParcela).toBe(0);
    expect(Number.isFinite(r.valorParcela)).toBe(true);
  });

  it('trata entrada inválida (NaN/undefined) como zero, nunca quebra', () => {
    const r = calcularSimulacao({ valor: NaN, parcelas: 6, taxaAoMes: 5 });
    expect(Number.isFinite(r.valorParcela)).toBe(true);
    expect(r.valor).toBe(0);
  });
});
