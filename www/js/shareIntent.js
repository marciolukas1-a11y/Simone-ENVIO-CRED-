/*
 * Modo copiloto: escuta quando a Simone compartilha um texto (ex: copiou
 * uma mensagem do WhatsApp Business) pro ENVIO CRED. Dispara um evento
 * DOM "enviocred:textoCompartilhado" que o app.js escuta pra abrir a tela
 * de sugestão da IA.
 */
(function (global) {
  'use strict';

  function disparar(texto) {
    if (!texto) return;
    document.dispatchEvent(new CustomEvent('enviocred:textoCompartilhado', { detail: { texto: texto } }));
  }

  async function iniciar() {
    if (!(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.ShareIntent)) {
      return; // fora do app nativo (ex: testando no navegador) -- não faz nada
    }
    var ShareIntent = global.Capacitor.Plugins.ShareIntent;

    try {
      var ultimo = await ShareIntent.getLastSharedText();
      if (ultimo && ultimo.texto) disparar(ultimo.texto);
    } catch (e) { /* sem compartilhamento pendente */ }

    ShareIntent.addListener('textoCompartilhado', function (dados) {
      disparar(dados && dados.texto);
    });
  }

  iniciar();
})(window);
