package com.enviocred.crm;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Modo copiloto: recebe o texto que a Simone compartilhou do WhatsApp (ou
 * de qualquer app) pro ENVIO CRED, via o menu "Compartilhar" do Android.
 * Nunca manda nada pelo WhatsApp sozinho -- só entrega o texto pra tela
 * pedir uma sugestão de resposta à IA.
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    /** Chamado pelo app quando abre, pra checar se foi aberto via "Compartilhar". */
    @PluginMethod
    public void getLastSharedText(PluginCall call) {
        String texto = extrairTexto(getActivity().getIntent());
        JSObject ret = new JSObject();
        ret.put("texto", texto != null ? texto : "");
        call.resolve(ret);
    }

    /** Chamado pela MainActivity quando chega um novo compartilhamento com o app já aberto. */
    void tratarNovoIntent(Intent intent) {
        String texto = extrairTexto(intent);
        if (texto != null && !texto.isEmpty()) {
            JSObject data = new JSObject();
            data.put("texto", texto);
            notifyListeners("textoCompartilhado", data);
        }
    }

    private String extrairTexto(Intent intent) {
        if (intent == null) return null;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return null;
        if (!"text/plain".equals(intent.getType())) return null;
        return intent.getStringExtra(Intent.EXTRA_TEXT);
    }
}
