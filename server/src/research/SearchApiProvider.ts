import type { ResearchProvider, ResultadoPesquisa } from './ResearchProvider.js';
import { logger } from '../logging/logger.js';

/**
 * SearchApi.io -- https://www.searchapi.io/api/v1 -- cobrado por busca bem
 * sucedida (~R$3-4/1000 buscas). Por isso a IA só deve chamar isto quando
 * genuinamente não souber responder (ver prompt de sistema).
 */
export class SearchApiProvider implements ResearchProvider {
  constructor(private readonly apiKey: string) {}

  async pesquisar(consulta: string): Promise<ResultadoPesquisa> {
    if (!this.apiKey) {
      throw new Error('RESEARCH_API_KEY não configurada');
    }

    const url = new URL('https://www.searchapi.io/api/v1/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', consulta);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('gl', 'br');
    url.searchParams.set('hl', 'pt-br');

    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resposta.ok) {
      throw new Error(`SearchApi.io respondeu ${resposta.status}`);
    }
    const dados = (await resposta.json()) as any;

    const resultados: any[] = dados.organic_results ?? [];
    const top = resultados.slice(0, 3);

    if (top.length === 0) {
      return { resumo: '', fontes: [] };
    }

    const resumo = top.map((r) => `${r.title}: ${r.snippet ?? ''}`).join('\n');
    const fontes = top.map((r) => r.link).filter(Boolean);

    logger.info({ consulta, resultados: top.length }, 'SearchApi.io: pesquisa realizada');

    return { resumo, fontes };
  }
}
