import { getDb } from '../db/database.js';

export interface Configuracoes {
  id: 1;
  atendente: string;
  taxa_padrao: number;
  taxa_atraso: number;
  horario_inicio: string;
  horario_fim: string;
  ia_pausada: number;
  groq_api_key: string;
  research_api_key: string;
}

export function obterConfiguracoes(): Configuracoes {
  return getDb().prepare('SELECT * FROM configuracoes WHERE id = 1').get() as Configuracoes;
}

export function salvarConfiguracoes(dados: Partial<Omit<Configuracoes, 'id'>>): Configuracoes {
  getDb()
    .prepare(
      `UPDATE configuracoes SET
         atendente = COALESCE(?, atendente),
         taxa_padrao = COALESCE(?, taxa_padrao),
         taxa_atraso = COALESCE(?, taxa_atraso),
         horario_inicio = COALESCE(?, horario_inicio),
         horario_fim = COALESCE(?, horario_fim),
         ia_pausada = COALESCE(?, ia_pausada),
         groq_api_key = COALESCE(?, groq_api_key),
         research_api_key = COALESCE(?, research_api_key)
       WHERE id = 1`
    )
    .run(
      dados.atendente ?? null,
      dados.taxa_padrao ?? null,
      dados.taxa_atraso ?? null,
      dados.horario_inicio ?? null,
      dados.horario_fim ?? null,
      dados.ia_pausada ?? null,
      dados.groq_api_key ?? null,
      dados.research_api_key ?? null
    );
  return obterConfiguracoes();
}

/** Interruptor geral: pausa a IA pra todo mundo, na hora -- exigência de segurança. */
export function pausarIa(): void {
  salvarConfiguracoes({ ia_pausada: 1 });
}

export function retomarIa(): void {
  salvarConfiguracoes({ ia_pausada: 0 });
}

export function iaEstaPausada(): boolean {
  return obterConfiguracoes().ia_pausada === 1;
}

/** Verifica se o horário atual (hora local do aparelho) está dentro do expediente configurado. */
export function dentroDoHorarioDeAtendimento(agora: Date = new Date()): boolean {
  const cfg = obterConfiguracoes();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const [hIni, mIni] = cfg.horario_inicio.split(':').map(Number);
  const [hFim, mFim] = cfg.horario_fim.split(':').map(Number);
  const minutosIni = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;
  return minutosAgora >= minutosIni && minutosAgora <= minutosFim;
}
