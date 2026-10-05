import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../src/config.js';
import { fecharDbParaTestes } from '../src/db/database.js';
import { obterChaveGroq, obterChaveResearch, salvarChavesDeIa, statusChaves, garantirAppApiToken } from '../src/segredos.js';

const CAMINHO_ENV_TESTE = resolve('.env.teste-temp');

beforeEach(() => {
  fecharDbParaTestes();
  const caminho = config.database.path;
  for (const sufixo of ['', '-wal', '-shm']) {
    if (existsSync(caminho + sufixo)) unlinkSync(caminho + sufixo);
  }
  if (existsSync(CAMINHO_ENV_TESTE)) unlinkSync(CAMINHO_ENV_TESTE);
});

describe('chaves de IA (banco, não arquivo)', () => {
  it('sem nada configurado, usa o fallback do .env (process.env)', () => {
    delete process.env.GROQ_API_KEY;
    expect(obterChaveGroq()).toBe('');
    process.env.GROQ_API_KEY = 'chave-do-env';
    expect(obterChaveGroq()).toBe('chave-do-env');
    delete process.env.GROQ_API_KEY;
  });

  it('salvarChavesDeIa grava no banco e passa a ter prioridade sobre o .env', () => {
    process.env.GROQ_API_KEY = 'chave-do-env';
    salvarChavesDeIa('chave-do-app', undefined);
    expect(obterChaveGroq()).toBe('chave-do-app');
    delete process.env.GROQ_API_KEY;
  });

  it('salvarChavesDeIa com um campo undefined não apaga o outro já salvo', () => {
    salvarChavesDeIa('chave-groq-x', 'chave-research-y');
    salvarChavesDeIa('chave-groq-nova', undefined);
    expect(obterChaveGroq()).toBe('chave-groq-nova');
    expect(obterChaveResearch()).toBe('chave-research-y');
  });

  it('statusChaves reflete se cada uma está configurada', () => {
    // tests/setup.ts define RESEARCH_API_KEY/GROQ_API_KEY como fallback global
    // -- removidos aqui só pra testar o cenário "nada configurado ainda".
    const groqOriginal = process.env.GROQ_API_KEY;
    const researchOriginal = process.env.RESEARCH_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.RESEARCH_API_KEY;

    expect(statusChaves()).toEqual({ groqConfigurada: false, researchConfigurada: false });
    salvarChavesDeIa('x', undefined);
    expect(statusChaves().groqConfigurada).toBe(true);
    expect(statusChaves().researchConfigurada).toBe(false);

    process.env.GROQ_API_KEY = groqOriginal;
    process.env.RESEARCH_API_KEY = researchOriginal;
  });
});

describe('garantirAppApiToken', () => {
  it('se já existe no process.env, não gera outro', () => {
    process.env.APP_API_TOKEN = 'token-ja-existente';
    expect(garantirAppApiToken()).toBe('token-ja-existente');
  });

  it('se não existe, gera um token de 48 caracteres hex e salva no arquivo informado', () => {
    delete process.env.APP_API_TOKEN;
    const token = garantirAppApiToken(CAMINHO_ENV_TESTE);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(process.env.APP_API_TOKEN).toBe(token);
    expect(existsSync(CAMINHO_ENV_TESTE)).toBe(true);
    expect(readFileSync(CAMINHO_ENV_TESTE, 'utf8')).toContain(token);
    process.env.APP_API_TOKEN = 'teste-fake-token'; // restaura pro resto da suíte
  });
});
