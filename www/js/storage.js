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
      await CapacitorSQLite.execute({
        database: DB_NAME,
        statements:
          'CREATE TABLE IF NOT EXISTS app_state (' +
          '  id INTEGER PRIMARY KEY CHECK (id = 1),' +
          '  json TEXT NOT NULL,' +
          '  atualizado_em TEXT NOT NULL' +
          ');' +
          'CREATE TABLE IF NOT EXISTS settings (' +
          '  id INTEGER PRIMARY KEY CHECK (id = 1),' +
          '  atendente TEXT NOT NULL DEFAULT \'Simone\',' +
          '  taxa_padrao REAL NOT NULL DEFAULT 5,' +
          '  servidor_url TEXT NOT NULL DEFAULT \'\'' +
          ');'
      });
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
    var rows = await query('SELECT atendente, taxa_padrao, servidor_url FROM settings WHERE id = 1');
    if (rows.length) return rows[0];
    var defaults = { atendente: 'Simone', taxa_padrao: 5, servidor_url: '' };
    await saveSettings(defaults);
    return defaults;
  }

  async function saveSettings(s) {
    await init();
    var CapacitorSQLite = getPlugin();
    await CapacitorSQLite.run({
      database: DB_NAME,
      statement:
        'INSERT INTO settings (id, atendente, taxa_padrao, servidor_url) VALUES (1, ?, ?, ?)' +
        ' ON CONFLICT(id) DO UPDATE SET atendente = excluded.atendente, taxa_padrao = excluded.taxa_padrao, servidor_url = excluded.servidor_url;',
      values: [s.atendente, Number(s.taxa_padrao) || 0, s.servidor_url || '']
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
