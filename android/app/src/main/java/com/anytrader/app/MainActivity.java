package com.anytrader.app;

import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        // Force the webview text zoom to 100% to prevent Android system font scale breaking styling/layouts.
        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setTextZoom(100);
                }
            }
        }
    }
}
