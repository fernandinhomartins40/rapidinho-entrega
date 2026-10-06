package br.com.rapidinhoentrega.sms;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Conversa com o servidor do Rapidinho. Sempre fora da thread principal.
 *
 * Os métodos devolvem o código HTTP (ou -1 sem rede) para quem chama decidir:
 * 2xx entregue; 401 é token errado (tentar de novo não adianta); o resto
 * volta para a fila.
 */
final class Servidor {
    static final int SEM_REDE = -1;
    private static final int TEMPO_MS = 10_000;

    private Servidor() {}

    static int enviarSms(Context contexto, String de, String texto, long recebidoEm) {
        try {
            JSONObject corpo = new JSONObject();
            corpo.put("from", de);
            corpo.put("body", texto);
            corpo.put("receivedAt", recebidoEm);
            return post(contexto, "/api/sms/recebido", corpo);
        } catch (JSONException e) {
            return SEM_REDE;
        }
    }

    static int enviarSinal(Context contexto) {
        try {
            JSONObject corpo = new JSONObject();
            corpo.put("versao", BuildConfigVersao.nome(contexto));
            corpo.put("pendentes", Config.pendentes(contexto));
            int bateria = bateria(contexto);
            if (bateria >= 0) corpo.put("bateria", bateria);
            return post(contexto, "/api/sms/sinal", corpo);
        } catch (JSONException e) {
            return SEM_REDE;
        }
    }

    /** Resultado do login: o token quando deu certo, senão o código HTTP. */
    static final class Login {
        final int codigo;
        final String token;

        Login(int codigo, String token) {
            this.codigo = codigo;
            this.token = token;
        }
    }

    /** Troca e-mail e senha pelo token do app. A senha não é guardada. */
    static Login entrar(Context contexto, String email, String senha) {
        HttpURLConnection conexao = null;
        try {
            JSONObject corpo = new JSONObject();
            corpo.put("email", email.trim());
            corpo.put("senha", senha);
            conexao = abrir(Config.servidor(contexto) + "/api/sms/app/entrar", corpo, null);
            int codigo = conexao.getResponseCode();
            if (!entregue(codigo)) return new Login(codigo, null);
            try (InputStream entrada = conexao.getInputStream()) {
                String resposta = new String(ler(entrada), StandardCharsets.UTF_8);
                return new Login(codigo, new JSONObject(resposta).optString("token", null));
            }
        } catch (IOException | JSONException e) {
            return new Login(SEM_REDE, null);
        } finally {
            if (conexao != null) conexao.disconnect();
        }
    }

    private static byte[] ler(InputStream entrada) throws IOException {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        byte[] bloco = new byte[4096];
        int lidos;
        while ((lidos = entrada.read(bloco)) != -1) saida.write(bloco, 0, lidos);
        return saida.toByteArray();
    }

    private static HttpURLConnection abrir(String endereco, JSONObject corpo, String token)
            throws IOException {
        HttpURLConnection conexao = (HttpURLConnection) new URL(endereco).openConnection();
        conexao.setConnectTimeout(TEMPO_MS);
        conexao.setReadTimeout(TEMPO_MS);
        conexao.setRequestMethod("POST");
        conexao.setDoOutput(true);
        conexao.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (token != null) conexao.setRequestProperty("Authorization", "Bearer " + token);

        byte[] bytes = corpo.toString().getBytes(StandardCharsets.UTF_8);
        conexao.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream saida = conexao.getOutputStream()) {
            saida.write(bytes);
        }
        return conexao;
    }

    private static int post(Context contexto, String caminho, JSONObject corpo) {
        if (!Config.configurado(contexto)) return SEM_REDE;

        HttpURLConnection conexao = null;
        try {
            conexao = abrir(Config.servidor(contexto) + caminho, corpo, Config.token(contexto));
            return conexao.getResponseCode();
        } catch (IOException e) {
            return SEM_REDE;
        } finally {
            if (conexao != null) conexao.disconnect();
        }
    }

    private static int bateria(Context contexto) {
        Intent estado = contexto.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (estado == null) return -1;
        int nivel = estado.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int escala = estado.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        return nivel < 0 || escala <= 0 ? -1 : Math.round(nivel * 100f / escala);
    }

    static boolean entregue(int codigo) {
        return codigo >= 200 && codigo < 300;
    }
}
