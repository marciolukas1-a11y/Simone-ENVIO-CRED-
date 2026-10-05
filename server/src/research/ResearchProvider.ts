/**
 * Interface da IA de pesquisa -- trocável por variável de ambiente
 * (RESEARCH_PROVIDER). Hoje só a SearchApi.io está implementada (chave já
 * paga do Márcio), mas qualquer provedor novo só precisa implementar isto.
 */
export interface ResultadoPesquisa {
  resumo: string;
  fontes: string[];
}

export interface ResearchProvider {
  pesquisar(consulta: string): Promise<ResultadoPesquisa>;
}
