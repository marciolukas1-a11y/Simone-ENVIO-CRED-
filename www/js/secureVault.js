/*
 * Cofre criptografado dentro do APK, para as chaves de IA (Groq,
 * SearchApi.io). O trabalho de criptografia de verdade (AES256-GCM, chave
 * mestra no Android Keystore do aparelho) acontece no plugin nativo
 * SecureVaultPlugin.java -- aqui é só a ponte em JS.
 */
(function (global) {
  'use strict';

  function getPlugin() {
    if (!(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.SecureVault)) {
      throw new Error('Cofre criptografado não disponível -- isto só funciona dentro do app Android.');
    }
    return global.Capacitor.Plugins.SecureVault;
  }

  global.EnvioCredCofre = {
    salvar: async function (chave, valor) {
      return getPlugin().salvar({ chave: chave, valor: valor || '' });
    },
    obter: async function (chave) {
      var r = await getPlugin().obter({ chave: chave });
      return (r && r.valor) || '';
    },
    apagar: async function (chave) {
      return getPlugin().apagar({ chave: chave });
    }
  };
})(window);
