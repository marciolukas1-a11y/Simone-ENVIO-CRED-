import type { ResearchProvider } from './ResearchProvider.js';
import { SearchApiProvider } from './SearchApiProvider.js';
import { config } from '../config.js';

export function criarResearchProvider(): ResearchProvider {
  switch (config.research.provider) {
    case 'searchapi':
      return new SearchApiProvider();
    default:
      throw new Error(
        `RESEARCH_PROVIDER "${config.research.provider}" desconhecido. Opções: searchapi.`
      );
  }
}

export type { ResearchProvider, ResultadoPesquisa } from './ResearchProvider.js';
