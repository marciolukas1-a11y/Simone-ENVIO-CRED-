package com.enviocred.crm;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Cofre criptografado dentro do próprio APK para as chaves de IA (Groq,
 * SearchApi.io). Usa EncryptedSharedPreferences da AndroidX Security, cuja
 * chave mestra de criptografia (AES256-GCM) fica guardada no Android
 * Keystore -- protegida por hardware do aparelho, nunca em texto puro em
 * disco e nunca sai deste celular.
 *
 * Isto atende ao pedido explícito do cliente de ter "um espaço
 * criptografado no APK" para colar as chaves, em vez de elas ficarem só no
 * banco de dados do servidor.
 */
@CapacitorPlugin(name = "SecureVault")
public class SecureVaultPlugin extends Plugin {

    private static final String ARQUIVO = "enviocred_cofre";

    private SharedPreferences getCofre() throws Exception {
        MasterKey chaveMestra = new MasterKey.Builder(getContext())
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

        return EncryptedSharedPreferences.create(
                getContext(),
                ARQUIVO,
                chaveMestra,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    @PluginMethod
    public void salvar(PluginCall call) {
        String chave = call.getString("chave");
        String valor = call.getString("valor");
        if (chave == null || chave.isEmpty()) {
            call.reject("chave é obrigatória");
            return;
        }
        try {
            SharedPreferences.Editor editor = getCofre().edit();
            if (valor == null || valor.isEmpty()) {
                editor.remove(chave);
            } else {
                editor.putString(chave, valor);
            }
            editor.apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Não consegui guardar no cofre criptografado", e);
        }
    }

    @PluginMethod
    public void obter(PluginCall call) {
        String chave = call.getString("chave");
        if (chave == null || chave.isEmpty()) {
            call.reject("chave é obrigatória");
            return;
        }
        try {
            String valor = getCofre().getString(chave, "");
            JSObject resultado = new JSObject();
            resultado.put("valor", valor == null ? "" : valor);
            call.resolve(resultado);
        } catch (Exception e) {
            call.reject("Não consegui ler do cofre criptografado", e);
        }
    }

    @PluginMethod
    public void apagar(PluginCall call) {
        String chave = call.getString("chave");
        if (chave == null || chave.isEmpty()) {
            call.reject("chave é obrigatória");
            return;
        }
        try {
            getCofre().edit().remove(chave).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Não consegui apagar do cofre criptografado", e);
        }
    }
}
