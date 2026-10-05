/*
 * Ponte pro plugin nativo WhatsAppOpener (ver android/.../WhatsAppOpenerPlugin.java).
 * Abre o link wa.me preferindo o WhatsApp Business, sempre como app externo
 * -- nunca dentro da WebView do app.
 */
(function (global) {
  'use strict';
  global.EnvioCredWhatsApp = {
    open: function (url) {
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.WhatsAppOpener) {
        return global.Capacitor.Plugins.WhatsAppOpener.open({ url: url }).catch(function (e) {
          console.error('WhatsAppOpener falhou, usando navegador como último recurso', e);
          global.open(url, '_system');
        });
      }
      // Fora do app nativo (ex.: testando no navegador) -- abre normalmente.
      global.open(url, '_system');
      return Promise.resolve();
    }
  };
})(window);
