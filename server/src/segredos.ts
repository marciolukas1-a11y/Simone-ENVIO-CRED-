import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { obterConfiguracoes, salvarConfiguracoes } from './domain/configuracoes.js';
import { logger } from './logging/logger.js';

/**
 * Token da API do app: se não tiver sido configurado, gera um sozinho na
 * primeira vez que o servidor liga, salva no .env automaticamente (pra não
 * precisar gerar de novo a cada reinício) e imprime bem visível no log --
 * é só copiar esse valor pra tela de Configurações do app, uma vez.
 *
 * `caminhoEnv` é parametrizável só pra teste automatizado não escrever no
 * .env de verdade -- em produção sempre usa o padrão ('.env').
 */
export function garantirAppApiToken(caminhoEnv: string = resolve('.env')): string {
  var existente = process.env.APP_API_TOKEN;
  if (existente && existente.trim()) return existente.trim();

  var token = randomBytes(24).toString('hex');
  process.env.APP_API_TOKEN = token;

  try {
    var linha = `APP_API_TOKEN=${token}\n`;
    if (existsSync(caminhoEnv)) appendFileSync(caminhoEnv, `\n${linha}`);
    else writeFileSync(caminhoEnv, linha);
  } catch (e) {
    logger.warn(e, 'Não consegui salvar o token no .env -- vai precisar configurar de novo se o servidor reiniciar');
  }

  logger.info('════════════════════════════════════════════════════');
  logger.info('TOKEN GERADO AUTOMATICAMENTE -- copie e cole em Config, no app:');
  logger.info(token);
  logger.info('════════════════════════════════════════════════════');

  return token;
}

/**
 * Chaves de IA (Groq, SearchApi): guardadas no banco local, configuráveis
 * pela tela "Chaves de IA" do app (POST /api/chaves) -- nunca precisam ser
 * digitadas num arquivo. Se ainda assim alguém preferir colocar no .env
 * (uso avançado), isso serve de respaldo.
 */
export function obterChaveGroq(): string {
  var cfg = obterConfiguracoes();
  if (cfg.groq_api_key && cfg.groq_api_key.trim()) return cfg.groq_api_key.trim();
  return process.env.GROQ_API_KEY ?? '';
}

export function obterChaveResearch(): string {
  var cfg = obterConfiguracoes();
  if (cfg.research_api_key && cfg.research_api_key.trim()) return cfg.research_api_key.trim();
  return process.env.RESEARCH_API_KEY ?? '';
}

export function salvarChavesDeIa(groqApiKey?: string, researchApiKey?: string): void {
  salvarConfiguracoes({
    groq_api_key: groqApiKey !== undefined ? groqApiKey.trim() : undefined,
    research_api_key: researchApiKey !== undefined ? researchApiKey.trim() : undefined,
  });
}

export function statusChaves(): { groqConfigurada: boolean; researchConfigurada: boolean } {
  return {
    groqConfigurada: obterChaveGroq().length > 0,
    researchConfigurada: obterChaveResearch().length > 0,
  };
}
