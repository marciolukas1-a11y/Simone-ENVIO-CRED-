package com.enviocred.crm;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Abre um link wa.me preferindo o WhatsApp Business (com.whatsapp.w4b);
 * cai pro WhatsApp comum (com.whatsapp) se o Business não estiver instalado;
 * e, por último, deixa o Android escolher (navegador) se nenhum dos dois existir.
 *
 * Sempre abre como app externo (Intent fora da WebView), nunca dentro do app --
 * exigência explícita da ordem de serviço, pra não misturar a sessão de
 * WhatsApp do cliente com a tela do CRM.
 */
@CapacitorPlugin(name = "WhatsAppOpener")
public class WhatsAppOpenerPlugin extends Plugin {

    private static final String BUSINESS_PKG = "com.whatsapp.w4b";
    private static final String PERSONAL_PKG = "com.whatsapp";

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url é obrigatório");
            return;
        }

        Uri uri = Uri.parse(url);
        String pkg = isInstalled(BUSINESS_PKG) ? BUSINESS_PKG : (isInstalled(PERSONAL_PKG) ? PERSONAL_PKG : null);

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        if (pkg != null) {
            intent.setPackage(pkg);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            // O pacote específico não respondeu (pode ter sido desinstalado
            // entre a checagem e a abertura) -- tenta sem forçar pacote.
            try {
                Intent fallback = new Intent(Intent.ACTION_VIEW, uri);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Não consegui abrir o WhatsApp", e2);
            }
        }
    }

    private boolean isInstalled(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
