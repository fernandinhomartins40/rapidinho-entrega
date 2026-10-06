package br.com.rapidinhoentrega.sms;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * A única tela: mostra se está tudo pronto para receber os SMS de confirmação
 * e resolve o que faltar com um toque.
 *
 * Três coisas precisam estar verdes: conectado (login com e-mail e senha, que
 * traz o token do servidor), permissão de receber SMS e fora da economia de
 * bateria. O servidor de produção já vem configurado.
 */
public class MainActivity extends Activity {
    private static final int PEDIDO_SMS = 1;
    private static final int AMARELO = Color.parseColor("#FFC400");
    private static final int PRETO = Color.parseColor("#111111");
    private static final int VERDE = Color.parseColor("#15803D");
    private static final int VERMELHO = Color.parseColor("#B91C1C");

    private final Handler principal = new Handler(Looper.getMainLooper());

    private TextView passoConfig;
    private TextView passoSms;
    private TextView passoBateria;
    private TextView resultadoTeste;
    private TextView historico;
    private EditText campoEmail;
    private EditText campoSenha;
    private LinearLayout blocoLogin;
    private LinearLayout blocoConectado;
    private TextView textoConectado;
    private Button botaoEntrar;
    private Button botaoSms;
    private Button botaoBateria;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        setContentView(montarTela());
        aplicarLinkDeConfiguracao(getIntent());
        Agendador.manterSinalDeVida(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        aplicarLinkDeConfiguracao(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        atualizar();
    }

    /** rapidinhosms://configurar?servidor=...&token=... vindo do painel. */
    private void aplicarLinkDeConfiguracao(Intent intent) {
        Uri dados = intent == null ? null : intent.getData();
        if (dados == null || !"rapidinhosms".equals(dados.getScheme())) return;

        String servidor = dados.getQueryParameter("servidor");
        String token = dados.getQueryParameter("token");
        if (servidor == null || token == null || servidor.isEmpty() || token.isEmpty()) return;

        Config.salvar(this, servidor, token);
        Config.registrar(this, "Configurado pelo link do painel");
        testarConexao();
    }

    // --- Estado ------------------------------------------------------------

    private boolean temPermissaoDeSms() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean foraDaEconomiaDeBateria() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager energia = (PowerManager) getSystemService(POWER_SERVICE);
        return energia != null && energia.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void atualizar() {
        boolean configurado = Config.configurado(this);
        marcar(passoConfig, configurado,
                configurado ? "Conectado ao servidor" : "Falta entrar com e-mail e senha");
        marcar(passoSms, temPermissaoDeSms(),
                temPermissaoDeSms() ? "Pode receber SMS" : "Falta permitir receber SMS");
        marcar(passoBateria, foraDaEconomiaDeBateria(),
                foraDaEconomiaDeBateria() ? "Fora da economia de bateria"
                        : "Na economia de bateria: pode atrasar o login");
        botaoSms.setVisibility(temPermissaoDeSms() ? View.GONE : View.VISIBLE);
        botaoBateria.setVisibility(foraDaEconomiaDeBateria() ? View.GONE : View.VISIBLE);
        blocoLogin.setVisibility(configurado ? View.GONE : View.VISIBLE);
        blocoConectado.setVisibility(configurado ? View.VISIBLE : View.GONE);
        textoConectado.setText("Conectado como " + Config.email(this) + "\n" + Config.servidor(this));

        int pendentes = Config.pendentes(this);
        historico.setText((pendentes > 0 ? pendentes + " SMS esperando internet\n\n" : "")
                + Config.historico(this));
    }

    private void marcar(TextView passo, boolean ok, String texto) {
        passo.setText((ok ? "✓  " : "!  ") + texto);
        passo.setTextColor(ok ? VERDE : VERMELHO);
    }

    // --- Ações -------------------------------------------------------------

    private void pedirPermissaoDeSms() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(new String[] {Manifest.permission.RECEIVE_SMS}, PEDIDO_SMS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permissoes, int[] resultados) {
        super.onRequestPermissionsResult(pedido, permissoes, resultados);
        atualizar();
    }

    private void sairDaEconomiaDeBateria() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getPackageName()));
        try {
            startActivity(intent);
        } catch (Exception semTela) {
            // Alguns fabricantes não têm esse atalho: abre a lista geral.
            startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
    }

    private void entrar() {
        String email = campoEmail.getText().toString().trim();
        String senha = campoSenha.getText().toString();
        if (email.isEmpty() || senha.isEmpty()) {
            mostrarResultado("Preencha e-mail e senha.", VERMELHO);
            return;
        }
        botaoEntrar.setEnabled(false);
        mostrarResultado("Entrando…", PRETO);
        new Thread(() -> {
            Servidor.Login login = Servidor.entrar(this, email, senha);
            principal.post(() -> {
                botaoEntrar.setEnabled(true);
                if (login.token != null && !login.token.isEmpty()) {
                    Config.entrou(this, email, login.token);
                    campoSenha.setText("");
                    Config.registrar(this, "Entrou como " + email);
                    testarConexao();
                } else if (login.codigo == 401) {
                    mostrarResultado("E-mail ou senha incorretos.", VERMELHO);
                } else if (login.codigo == 429) {
                    mostrarResultado("Muitas tentativas. Espere 15 minutos.", VERMELHO);
                } else if (login.codigo == Servidor.SEM_REDE) {
                    mostrarResultado("Sem conexão com o servidor. Confira a internet.", VERMELHO);
                } else {
                    mostrarResultado("O servidor respondeu " + login.codigo
                            + ". O login do app pode não estar ligado ainda.", VERMELHO);
                }
                atualizar();
            });
        }, "login").start();
    }

    private void sair() {
        Config.sair(this);
        Config.registrar(this, "Saiu");
        mostrarResultado("", PRETO);
        atualizar();
    }

    private void mostrarResultado(String mensagem, int cor) {
        resultadoTeste.setText(mensagem);
        resultadoTeste.setTextColor(cor);
    }

    private void testarConexao() {
        resultadoTeste.setText("Testando…");
        resultadoTeste.setTextColor(PRETO);
        new Thread(() -> {
            int codigo = Servidor.enviarSinal(this);
            boolean sobrou = Servidor.entregue(codigo) && Agendador.esvaziarFila(this);
            principal.post(() -> {
                if (Servidor.entregue(codigo)) {
                    resultadoTeste.setText(sobrou
                            ? "Conectado. Ainda há SMS para reenviar."
                            : "Conectado ao servidor. Pronto para receber.");
                    resultadoTeste.setTextColor(VERDE);
                    Config.registrar(this, "Teste de conexão: ok");
                } else if (codigo == 401) {
                    // Token trocado no servidor: pede login de novo.
                    Config.sair(this);
                    resultadoTeste.setText("Acesso expirou. Entre de novo com e-mail e senha.");
                    resultadoTeste.setTextColor(VERMELHO);
                } else {
                    resultadoTeste.setText(codigo == Servidor.SEM_REDE
                            ? "Sem conexão com o servidor. Confira a internet e o endereço."
                            : "O servidor respondeu " + codigo + ".");
                    resultadoTeste.setTextColor(VERMELHO);
                }
                atualizar();
            });
        }, "teste-de-conexao").start();
    }

    // --- Tela --------------------------------------------------------------

    private View montarTela() {
        LinearLayout coluna = new LinearLayout(this);
        coluna.setOrientation(LinearLayout.VERTICAL);
        int margem = dp(20);
        coluna.setPadding(margem, dp(28), margem, margem);
        coluna.setBackgroundColor(Color.parseColor("#F6F6F4"));

        TextView titulo = texto("Rapidinho SMS", 24, PRETO);
        titulo.setTypeface(Typeface.DEFAULT_BOLD);
        coluna.addView(titulo);
        TextView explicacao = texto(
                "Este celular recebe os SMS que os clientes enviam para confirmar o número "
                        + "e repassa ao Rapidinho. Deixe-o ligado e com internet.", 15, Color.DKGRAY);
        explicacao.setPadding(0, dp(6), 0, dp(16));
        coluna.addView(explicacao);

        LinearLayout status = cartao();
        passoConfig = texto("", 16, PRETO);
        passoSms = texto("", 16, PRETO);
        passoBateria = texto("", 16, PRETO);
        status.addView(passoConfig);
        status.addView(passoSms);
        botaoSms = botao("Permitir receber SMS", true);
        botaoSms.setOnClickListener(v -> pedirPermissaoDeSms());
        status.addView(botaoSms);
        status.addView(passoBateria);
        botaoBateria = botao("Tirar da economia de bateria", true);
        botaoBateria.setOnClickListener(v -> sairDaEconomiaDeBateria());
        status.addView(botaoBateria);
        coluna.addView(status);

        LinearLayout config = cartao();
        blocoLogin = new LinearLayout(this);
        blocoLogin.setOrientation(LinearLayout.VERTICAL);
        TextView tituloLogin = texto("Entrar", 16, PRETO);
        tituloLogin.setTypeface(Typeface.DEFAULT_BOLD);
        blocoLogin.addView(tituloLogin);
        campoEmail = campo("E-mail", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        campoEmail.setText(Config.email(this));
        blocoLogin.addView(campoEmail);
        campoSenha = campo("Senha", InputType.TYPE_TEXT_VARIATION_PASSWORD);
        blocoLogin.addView(campoSenha);
        botaoEntrar = botao("Entrar", true);
        botaoEntrar.setOnClickListener(v -> entrar());
        blocoLogin.addView(botaoEntrar);
        config.addView(blocoLogin);

        blocoConectado = new LinearLayout(this);
        blocoConectado.setOrientation(LinearLayout.VERTICAL);
        textoConectado = texto("", 15, Color.DKGRAY);
        blocoConectado.addView(textoConectado);
        Button testar = botao("Testar conexão", false);
        testar.setOnClickListener(v -> testarConexao());
        blocoConectado.addView(testar);
        Button botaoSair = botao("Sair", false);
        botaoSair.setOnClickListener(v -> sair());
        blocoConectado.addView(botaoSair);
        config.addView(blocoConectado);

        resultadoTeste = texto("", 15, PRETO);
        config.addView(resultadoTeste);
        coluna.addView(config);

        LinearLayout ultimos = cartao();
        TextView tituloHistorico = texto("Últimos acontecimentos", 16, PRETO);
        tituloHistorico.setTypeface(Typeface.DEFAULT_BOLD);
        ultimos.addView(tituloHistorico);
        historico = texto("", 13, Color.DKGRAY);
        historico.setTypeface(Typeface.MONOSPACE);
        historico.setPadding(0, dp(6), 0, 0);
        ultimos.addView(historico);
        coluna.addView(ultimos);

        ScrollView rolagem = new ScrollView(this);
        rolagem.setFillViewport(true);
        rolagem.addView(coluna);
        return rolagem;
    }

    private LinearLayout cartao() {
        LinearLayout cartao = new LinearLayout(this);
        cartao.setOrientation(LinearLayout.VERTICAL);
        cartao.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable fundo = new GradientDrawable();
        fundo.setColor(Color.WHITE);
        fundo.setCornerRadius(dp(14));
        fundo.setStroke(dp(1), Color.parseColor("#E4E4E0"));
        cartao.setBackground(fundo);
        LinearLayout.LayoutParams espaco = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        espaco.bottomMargin = dp(14);
        cartao.setLayoutParams(espaco);
        return cartao;
    }

    private TextView texto(String conteudo, int tamanhoSp, int cor) {
        TextView texto = new TextView(this);
        texto.setText(conteudo);
        texto.setTextSize(TypedValue.COMPLEX_UNIT_SP, tamanhoSp);
        texto.setTextColor(cor);
        texto.setPadding(0, dp(4), 0, dp(4));
        return texto;
    }

    private EditText campo(String dica, int variacao) {
        EditText campo = new EditText(this);
        campo.setHint(dica);
        campo.setSingleLine(true);
        campo.setInputType(InputType.TYPE_CLASS_TEXT | variacao);
        return campo;
    }

    private Button botao(String rotulo, boolean principal) {
        Button botao = new Button(this);
        botao.setText(rotulo);
        botao.setAllCaps(false);
        botao.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        botao.setGravity(Gravity.CENTER);
        botao.setMinHeight(dp(48));
        GradientDrawable fundo = new GradientDrawable();
        fundo.setCornerRadius(dp(12));
        fundo.setColor(principal ? AMARELO : Color.WHITE);
        if (!principal) fundo.setStroke(dp(1), Color.parseColor("#D4D4D0"));
        botao.setBackground(fundo);
        botao.setTextColor(PRETO);
        LinearLayout.LayoutParams espaco = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        espaco.topMargin = dp(8);
        botao.setLayoutParams(espaco);
        return botao;
    }

    private int dp(int valor) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, valor, getResources().getDisplayMetrics()));
    }
}
