package br.com.rapidinhoentrega.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.net.URISyntaxException;

/**
 * App do cliente: o site do Rapidinho numa tela nativa.
 *
 * O login fica no cookie de sessão, que o CookieManager grava no aparelho.
 * Por isso o cliente confirma o número por SMS uma vez e continua dentro do
 * app enquanto a sessão do servidor valer (30 dias, renovados a cada uso).
 *
 * Link de fora do Rapidinho (WhatsApp, telefone, Pix, mapas) abre no app
 * certo do celular, e não dentro desta tela.
 */
public class MainActivity extends Activity {

    private static final String SITE = BuildConfig.SITE_URL;
    private static final String HOST = Uri.parse(SITE).getHost();

    private WebView web;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0c0c0e"));
        setContentView(web);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        // O site pode saber que está dentro do app, se um dia precisar.
        ajustes.setUserAgentString(
            ajustes.getUserAgentString() + " RapidinhoApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new Navegacao());

        if (estado != null) {
            web.restoreState(estado);
        } else {
            web.loadUrl(enderecoDoIntent(getIntent()));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri dados = intent.getData();
        if (dados != null && doRapidinho(dados)) {
            web.loadUrl(dados.toString());
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Grava o cookie de sessão no disco já: se o Android fechar o app em
        // segundo plano, o cliente não perde o login.
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    private String enderecoDoIntent(Intent intent) {
        Uri dados = intent.getData();
        return dados != null && doRapidinho(dados) ? dados.toString() : SITE;
    }

    private static boolean doRapidinho(Uri uri) {
        String host = uri.getHost();
        return host != null && (host.equals(HOST) || host.endsWith("." + HOST));
    }

    private class Navegacao extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest pedido) {
            Uri uri = pedido.getUrl();
            String esquema = uri.getScheme();

            if (("https".equals(esquema) || "http".equals(esquema)) && doRapidinho(uri)) {
                return false;
            }

            abrirFora(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest pedido, WebResourceError erro) {
            if (pedido.isForMainFrame()) {
                mostrarSemInternet(pedido.getUrl().toString());
            }
        }
    }

    private void abrirFora(Uri uri) {
        try {
            Intent intent = "intent".equals(uri.getScheme())
                ? Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                : new Intent(Intent.ACTION_VIEW, uri);
            // Um link intent:// não escolhe componente nem ganha permissão:
            // só o que o sistema abriria para qualquer app.
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.setComponent(null);
            intent.setSelector(null);
            startActivity(intent);
        } catch (ActivityNotFoundException | URISyntaxException e) {
            // Nenhum app no celular abre esse link: fica onde está.
        }
    }

    private void mostrarSemInternet(String tentarDeNovo) {
        String pagina = "<!doctype html><html><head>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;"
            + "align-items:center;justify-content:center;gap:16px;padding:24px;"
            + "background:#0c0c0e;color:#fff;font-family:sans-serif;text-align:center}"
            + "a{background:#ffc107;color:#111;padding:14px 28px;border-radius:12px;"
            + "font-weight:bold;text-decoration:none}</style></head><body>"
            + "<h2>Sem conexão</h2>"
            + "<p>Confira a internet do celular e tente de novo.</p>"
            + "<a href='" + tentarDeNovo.replace("'", "%27") + "'>Tentar de novo</a>"
            + "</body></html>";
        web.loadDataWithBaseURL(SITE, pagina, "text/html", "utf-8", tentarDeNovo);
    }
}
