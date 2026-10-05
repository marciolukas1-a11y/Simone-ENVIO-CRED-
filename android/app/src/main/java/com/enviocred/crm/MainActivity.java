package com.enviocred.crm;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhatsAppOpenerPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareIntentPlugin plugin = (ShareIntentPlugin) getBridge().getPlugin("ShareIntent").getInstance();
        if (plugin != null) {
            plugin.tratarNovoIntent(intent);
        }
    }
}
