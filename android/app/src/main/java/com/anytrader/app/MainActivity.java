package com.anytrader.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.GeolocationPermissions;
import android.webkit.JsResult;
import android.webkit.JsPromptResult;
import android.webkit.ConsoleMessage;
import android.net.Uri;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request Microphone permission natively on startup to ensure WebView can access it smoothly
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 101);
        }
    }

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

                // Retrieve preconfigured Capacitor WebChromeClient and set up our custom delegate to auto-allow browser getUserMedia/recording permissions.
                final WebChromeClient originalClient = webView.getWebChromeClient();
                if (originalClient != null) {
                    webView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            boolean hasAudio = false;
                            for (String res : request.getResources()) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                    hasAudio = true;
                                    break;
                                }
                            }
                            if (hasAudio) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                            } else {
                                originalClient.onPermissionRequest(request);
                            }
                        }

                        @Override
                        public void onPermissionRequestCanceled(PermissionRequest request) {
                            originalClient.onPermissionRequestCanceled(request);
                        }

                        @Override
                        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                            return originalClient.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                        }

                        @Override
                        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                            originalClient.onGeolocationPermissionsShowPrompt(origin, callback);
                        }

                        @Override
                        public void onGeolocationPermissionsHidePrompt() {
                            originalClient.onGeolocationPermissionsHidePrompt();
                        }

                        @Override
                        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                            return originalClient.onJsAlert(view, url, message, result);
                        }

                        @Override
                        public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                            return originalClient.onJsConfirm(view, url, message, result);
                        }

                        @Override
                        public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                            return originalClient.onJsPrompt(view, url, message, defaultValue, result);
                        }

                        @Override
                        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                            return originalClient.onConsoleMessage(consoleMessage);
                        }

                        @Override
                        public void onProgressChanged(WebView view, int newProgress) {
                            originalClient.onProgressChanged(view, newProgress);
                        }
                    });
                }
            }
        }
    }
}
