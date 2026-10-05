import { describe, it, expect } from 'vitest';
import { podeEnviarPara, registrarEnvioPara, contemLinkEncurtado, podeIaEnviar } from '../src/safety/antiSpam.js';

describe('proteções anti-bloqueio', () => {
  it('permite enviar dentro do limite por minuto', () => {
    const tel = '5583900000001';
    for (let i = 0; i < 5; i++) {
      expect(podeEnviarPara(tel)).toBe(true);
      registrarEnvioPara(tel);
    }
  });

  it('bloqueia depois de atingir o limite por minuto (6)', () => {
    const tel = '5583900000002';
    for (let i = 0; i < 6; i++) registrarEnvioPara(tel);
    expect(podeEnviarPara(tel)).toBe(false);
  });

  it('detecta link encurtado comum', () => {
    expect(contemLinkEncurtado('confere aqui: https://bit.ly/abc123')).toBe(true);
    expect(contemLinkEncurtado('confere aqui: https://enviocred.com.br/promo')).toBe(false);
  });

  it('podeIaEnviar recusa quando a resposta tem link encurtado', () => {
    const tel = '5583900000003';
    const r = podeIaEnviar(tel, 'olha essa oferta tinyurl.com/xyz');
    expect(r.ok).toBe(false);
  });

  it('podeIaEnviar aceita uma resposta normal dentro do limite', () => {
    const tel = '5583900000004';
    const r = podeIaEnviar(tel, 'Oi! Aqui está sua simulação: 6x de R$ 197,02.');
    expect(r.ok).toBe(true);
  });
});
