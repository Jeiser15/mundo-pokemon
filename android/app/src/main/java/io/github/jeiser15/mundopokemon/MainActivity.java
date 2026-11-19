package io.github.jeiser15.mundopokemon;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Mundo Pokémon dentro de una app: una WebView a pantalla completa con la web.
 *
 * Los archivos de la web (index.html y static/) van dentro del APK, en assets/ (los copia GitHub Actions al
 * compilar). WebViewAssetLoader los sirve como si vinieran de https://appassets.androidplatform.net, porque
 * los módulos de JavaScript no funcionan con direcciones file://. Como aquí no hay servidor de Python,
 * static/js/api.js pide los datos directamente a PokéAPI.
 */
public class MainActivity extends Activity {

    private static final String DOMINIO = "appassets.androidplatform.net";
    private static final String INICIO = "https://" + DOMINIO + "/index.html";

    private WebView web;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        // "/" → la carpeta assets/: /index.html, /static/css/base.css… (las mismas rutas que con el servidor).
        final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
                .setDomain(DOMINIO)
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(0xFF06110C); // el verde noche del Inicio, mientras carga
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);   // localStorage: equipo, récord, racha, vistos…
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest peticion) {
                return cargador.shouldInterceptRequest(peticion.getUrl());
            }

            /** Los enlaces de fuera (por ejemplo, PokéAPI en el pie) se abren en el navegador del celular. */
            @Override
            public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest peticion) {
                Uri url = peticion.getUrl();
                if (DOMINIO.equals(url.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException sinNavegador) {
                    // Sin navegador instalado: no se hace nada.
                }
                return true;
            }
        });

        setContentView(web);
        if (estado != null) web.restoreState(estado);
        else web.loadUrl(INICIO);
    }

    /** El botón «Atrás» del celular vuelve a la vista anterior de la web (Inicio, Pokédex…) antes de salir. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
