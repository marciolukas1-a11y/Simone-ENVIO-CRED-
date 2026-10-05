/*
 * Armazenamento persistente do ENVIO CRED.
 *
 * Guarda o mesmo objeto de estado que o protótipo HTML usava no localStorage
 * (S = {clients, items, sim}), só que agora dentro de um banco SQLite de
 * verdade no armazenamento do app -- não some se o usuário limpar dados do
 * navegador, porque não existe mais navegador nenhum: é um app instalado.
 *
 * Também guarda as Configurações (nome de quem atende, taxa padrão do
 * simulador, endereço do servidor) numa tabela separada.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'enviocred';
  var sqlite = null;
  var db = null;
  var ready = null;

  function getPlugin() {
    if (!(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CapacitorSQLite)) {
      throw new Error('Plugin CapacitorSQLite não disponível -- isto só funciona dentro do app Android, não no navegador.');
    }
    return global.Capacitor.Plugins.CapacitorSQLite;
  }

  // Usamos a API de baixo nível do plugin diretamente (sem o wrapper
  // SQLiteConnection em JS) para não depender de um bundler -- o app é
  // HTML/CSS/JS simples, carregado por <script> comum.
  async function run(statement, values) {
    var CapacitorSQLite = getPlugin();
    return CapacitorSQLite.execute({ database: DB_NAME, statements: statement });
  }

  async function query(statement, values) {
    var CapacitorSQLite = getPlugin();
    var res = await CapacitorSQLite.query({ database: DB_NAME, statement: statement, values: values || [] });
    return (res && res.values) || [];
  }

  async function init() {
    if (ready) return ready;
    ready = (async function () {
      var CapacitorSQLite = getPlugin();
      try {
        await CapacitorSQLite.createConnection({ database: DB_NAME, encrypted: false, mode: 'no-encryption', version: 1 });
      } catch (e) {
        // conexão já existe -- segue a vida
      }
      await CapacitorSQLite.open({ database: DB_NAME });
      // Cada CREATE TABLE num execute() separado (em vez de um único texto
      // com várias instruções separadas por ";") -- em alguns aparelhos, o
      // execute() com múltiplas instruções de uma vez só rodava a primeira
      // e ignorava o resto sem erro nenhum, deixando a tabela "settings"
      // sem ser criada de verdade (só percebido quando Config tentou salvar
      // pela primeira vez, bem depois).
      try {
        await CapacitorSQLite.execute({
          database: DB_NAME,
          statements:
            'CREATE TABLE IF NOT EXISTS app_state (' +
            '  id INTEGER PRIMARY KEY CHECK (id = 1),' +
            '  json TEXT NOT NULL,' +
            '  atualizado_em TEXT NOT NULL' +
            ');'
        });
      } catch (e) {
        console.error('Falha ao criar tabela app_state', e);
      }
      try {
        await CapacitorSQLite.execute({
          database: DB_NAME,
          statements:
            'CREATE TABLE IF NOT EXISTS settings (' +
            '  id INTEGER PRIMARY KEY CHECK (id = 1),' +
            '  atendente TEXT NOT NULL DEFAULT \'Simone\',' +
            '  taxa_padrao REAL NOT NULL DEFAULT 30,' +
            '  servidor_url TEXT NOT NULL DEFAULT \'\',' +
            '  app_api_token TEXT NOT NULL DEFAULT \'\'' +
            ');'
        });
      } catch (e) {
        console.error('Falha ao criar tabela settings', e);
      }
      // Migração: quem já tinha o app de uma versão anterior pode ter a
      // tabela settings sem essa coluna ainda. Checamos com PRAGMA
      // table_info antes do ALTER (em vez de um try/catch cego que
      // mascararia um erro de verdade).
      try {
        var colunas = await query('PRAGMA table_info(settings)');
        var jaTem = colunas.some(function (c) { return c.name === 'app_api_token'; });
        if (!jaTem) {
          await CapacitorSQLite.execute({
            database: DB_NAME,
            statements: 'ALTER TABLE settings ADD COLUMN app_api_token TEXT NOT NULL DEFAULT \'\';'
          });
        }
      } catch (e) {
        console.error('Falha na migração da coluna app_api_token', e);
      }
    })();
    return ready;
  }

  async function load() {
    await init();
    var rows = await query('SELECT json FROM app_state WHERE id = 1');
    if (rows.length && rows[0].json) {
      try { return JSON.parse(rows[0].json); } catch (e) { /* cai pro null abaixo */ }
    }
    return null;
  }

  async function save(state) {
    await init();
    var CapacitorSQLite = getPlugin();
    var json = JSON.stringify(state);
    await CapacitorSQLite.run({
      database: DB_NAME,
      statement:
        'INSERT INTO app_state (id, json, atualizado_em) VALUES (1, ?, datetime(\'now\'))' +
        ' ON CONFLICT(id) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em;',
      values: [json]
    });
  }

  async function getSettings() {
    await init();
    var rows = await query('SELECT atendente, taxa_padrao, servidor_url, app_api_token FROM settings WHERE id = 1');
    if (rows.length) return rows[0];
    var defaults = { atendente: 'Simone', taxa_padrao: 30, servidor_url: '', app_api_token: '' };
    await saveSettings(defaults);
    return defaults;
  }

  async function saveSettings(s) {
    await init();
    var CapacitorSQLite = getPlugin();
    await CapacitorSQLite.run({
      database: DB_NAME,
      statement:
        'INSERT INTO settings (id, atendente, taxa_padrao, servidor_url, app_api_token) VALUES (1, ?, ?, ?, ?)' +
        ' ON CONFLICT(id) DO UPDATE SET atendente = excluded.atendente, taxa_padrao = excluded.taxa_padrao, servidor_url = excluded.servidor_url, app_api_token = excluded.app_api_token;',
      values: [s.atendente, Number(s.taxa_padrao) || 0, s.servidor_url || '', s.app_api_token || '']
    });
  }

  // Migração: primeira abertura do app, sem nada salvo ainda no SQLite --
  // oferecemos importar o texto de backup que o protótipo antigo gerava.
  async function isEmpty() {
    var state = await load();
    return !state;
  }

  global.EnvioCredStorage = {
    init: init,
    load: load,
    save: save,
    getSettings: getSettings,
    saveSettings: saveSettings,
    isEmpty: isEmpty
  };
})(window);
