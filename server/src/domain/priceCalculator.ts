/**
 * Mesma fórmula Price (parcelas fixas) usada em www/js/app.js (função pmt/calc
 * do app Android) -- mantida idêntica de propósito, pra nunca o servidor
 * mostrar um valor diferente do que o app mostraria pro mesmo cliente.
 */
export interface SimulacaoEntrada {
  valor: number;
  parcelas: number;
  taxaAoMes: number; // em % (ex: 5 = 5% ao mês)
}

export interface SimulacaoResultado {
  valor: number;
  parcelas: number;
  taxaAoMes: number;
  valorParcela: number;
  totalAPagar: number;
  juros: number;
}

function pmt(P: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i === 0) return P / n;
  return (P * i) / (1 - Math.pow(1 + i, -n));
}

export function calcularSimulacao(entrada: SimulacaoEntrada): SimulacaoResultado {
  const P = Number(entrada.valor) || 0;
  const n = Math.round(Number(entrada.parcelas) || 0);
  const i = (Number(entrada.taxaAoMes) || 0) / 100;
  const valorParcela = pmt(P, i, n);
  const totalAPagar = valorParcela * n;
  return {
    valor: P,
    parcelas: n,
    taxaAoMes: entrada.taxaAoMes,
    valorParcela,
    totalAPagar,
    juros: totalAPagar - P,
  };
}

export function formatarReais(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
