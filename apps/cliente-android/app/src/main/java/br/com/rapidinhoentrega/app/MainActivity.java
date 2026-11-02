package br.com.rapidinhoentrega.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.net.URISyntaxException;

/**
 * App do cliente: o site do Rapidinho numa tela nativa.
 *
 * O login fica no cookie de sessão, que o CookieManager grava no aparelho.
 * Por isso o cliente confirma o número por SMS uma vez e continua dentro do
 * app enquanto a sessão do servidor valer (400 dias, renovados a cada uso).
 *
 * Link de fora do Rapidinho (WhatsApp, telefone, Pix, mapas) abre no app
 * certo do celular, e não dentro desta tela.
 */
public class MainActivity extends Activity {

    private static final String SITE = BuildConfig.SITE_URL;
    private static final String HOST = Uri.parse(SITE).getHost();

    private static final int ESCOLHER_ARQUIVO = 1;
    private static final int COR_DE_FUNDO = Color.parseColor("#0c0c0e");

    private WebView web;
    /** Resposta pendente do seletor de arquivo (foto da receita, imagem). */
    private ValueCallback<Uri[]> arquivoEscolhido;
    /** Há pedido em andamento: ao sair do app, o acompanhamento continua. */
    private volatile boolean temPedidoEmAndamento;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        web = new WebView(this);
        web.setBackgroundColor(COR_DE_FUNDO);
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(COR_DE_FUNDO);
        raiz.addView(web);
        respeitarBarrasDoSistema(raiz);
        setContentView(raiz);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        // O site pode saber que está dentro do app, se um dia precisar.
        ajustes.setUserAgentString(
            ajustes.getUserAgentString() + " RapidinhoApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebChromeClient(new Janelas());
        web.setWebViewClient(new Navegacao());
        web.setDownloadListener(this::baixar);

        if (estado != null) {
            web.restoreState(estado);
        } else {
            web.loadUrl(enderecoDoIntent(getIntent()));
        }
    }

    /**
     * Do Android 15 em diante o app ocupa a tela inteira e o sistema não
     * reserva mais espaço: sem este recuo o site ficaria atrás das barras e o
     * teclado cobriria o campo em que a pessoa digita.
     */
    private void respeitarBarrasDoSistema(View raiz) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        raiz.setOnApplyWindowInsetsListener((tela, recuos) -> {
            Insets recuo = recuos.getInsets(WindowInsets.Type.systemBars()
                | WindowInsets.Type.displayCutout()
                | WindowInsets.Type.ime());
            tela.setPadding(recuo.left, recuo.top, recuo.right, recuo.bottom);
            return WindowInsets.CONSUMED;
        });
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
        // Aqui o app ainda conta como aberto, e o Android deixa o serviço subir.
        if (temPedidoEmAndamento) AcompanhamentoDePedido.iniciar(this);
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        super.onActivityResult(pedido, resultado, dados);
        if (pedido != ESCOLHER_ARQUIVO || arquivoEscolhido == null) return;
        // Cancelar também precisa responder (com null), senão o campo de
        // arquivo do site fica travado até recarregar.
        arquivoEscolhido.onReceiveValue(
            WebChromeClient.FileChooserParams.parseResult(resultado, dados));
        arquivoEscolhido = null;
    }

    /**
     * Sem isto o botão de arquivo do site não faz nada dentro do app: a WebView
     * só abre o seletor se a Activity pedir. É por ele que vai a foto da
     * receita na farmácia.
     */
    private class Janelas extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
            WebView view, ValueCallback<Uri[]> callback, FileChooserParams parametros) {
            if (arquivoEscolhido != null) arquivoEscolhido.onReceiveValue(null);
            arquivoEscolhido = callback;
            try {
                startActivityForResult(parametros.createIntent(), ESCOLHER_ARQUIVO);
                return true;
            } catch (ActivityNotFoundException e) {
                arquivoEscolhido = null;
                return false;
            }
        }
    }

    /**
     * Download (ex.: "Exportar meus dados") pelo gerenciador do Android, com o
     * cookie da sessão: o arquivo é da conta de quem está logado. Só endereço
     * do próprio Rapidinho, e o aviso de concluído abre o arquivo.
     */
    private void baixar(String url, String userAgent, String disposicao, String tipo, long tamanho) {
        Uri uri = Uri.parse(url);
        boolean ehWeb = "https".equals(uri.getScheme()) || "http".equals(uri.getScheme());
        if (!ehWeb || !doRapidinho(uri)) {
            return;
        }
        String nome = URLUtil.guessFileName(url, disposicao, tipo);
        DownloadManager.Request pedido = new DownloadManager.Request(uri)
            .setMimeType(tipo)
            .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
            .addRequestHeader("User-Agent", userAgent)
            .setTitle(nome)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        DownloadManager gerenciador = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (gerenciador != null) {
            gerenciador.enqueue(pedido);
            Toast.makeText(this, "Baixando " + nome, Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Confere se há pedido em andamento a cada página carregada: é assim que o
     * app descobre o pedido recém-feito, sem o site precisar avisar. Fora de
     * pedido, a resposta é falsa e nada mais roda.
     */
    private void conferirPedidoEmAndamento() {
        new Thread(() -> {
            JSONObject resposta = AcompanhamentoDePedido.consultar();
            boolean ativo = resposta != null && resposta.optBoolean("ativo", false);
            temPedidoEmAndamento = ativo;
            if (ativo) runOnUiThread(this::pedirPermissaoDeAviso);
        }, "confere-pedido").start();
    }

    /** Pedida só quando há pedido: é quando a pessoa entende para que serve. */
    private void pedirPermissaoDeAviso() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 2);
        }
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
        public void onPageFinished(WebView view, String url) {
            conferirPedidoEmAndamento();
        }

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
