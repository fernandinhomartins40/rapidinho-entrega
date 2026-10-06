package br.com.rapidinhoentrega.sms;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Configuração e memória do app: servidor, token, SMS esperando internet e o
 * histórico curto que aparece na tela.
 *
 * Tudo em SharedPreferences privadas do app. Os métodos da fila são
 * sincronizados: o receptor de SMS e o worker podem mexer nela ao mesmo tempo.
 */
final class Config {
    private static final String ARQUIVO = "rapidinho-sms";
    private static final String SERVIDOR = "servidor";
    private static final String TOKEN = "token";
    private static final String EMAIL = "email";

    /** Servidor de produção: o app já sai de fábrica apontando para ele. */
    static final String SERVIDOR_PADRAO = "https://rapidinhoentrega.com.br";
    /** E-mail sugerido na tela de login. */
    static final String EMAIL_PADRAO = "fuseagencia10@gmail.com";
    private static final String FILA = "fila";
    private static final String HISTORICO = "historico";

    /** SMS guardados no máximo enquanto não há internet. */
    private static final int MAX_NA_FILA = 200;
    private static final int MAX_NO_HISTORICO = 30;

    private Config() {}

    private static SharedPreferences prefs(Context contexto) {
        return contexto.getApplicationContext().getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE);
    }

    static String servidor(Context contexto) {
        return prefs(contexto).getString(SERVIDOR, SERVIDOR_PADRAO);
    }

    static String email(Context contexto) {
        return prefs(contexto).getString(EMAIL, EMAIL_PADRAO);
    }

    static void entrou(Context contexto, String email, String token) {
        prefs(contexto).edit().putString(EMAIL, email.trim()).putString(TOKEN, token.trim()).apply();
    }

    static void sair(Context contexto) {
        prefs(contexto).edit().remove(TOKEN).apply();
    }

    static String token(Context contexto) {
        return prefs(contexto).getString(TOKEN, "");
    }

    static boolean configurado(Context contexto) {
        return !servidor(contexto).isEmpty() && !token(contexto).isEmpty();
    }

    static void salvar(Context contexto, String servidor, String token) {
        String limpo = servidor.trim();
        while (limpo.endsWith("/")) limpo = limpo.substring(0, limpo.length() - 1);
        prefs(contexto).edit().putString(SERVIDOR, limpo).putString(TOKEN, token.trim()).apply();
    }

    // --- Fila de SMS sem internet -----------------------------------------

    static synchronized void enfileirar(Context contexto, String de, String texto, long recebidoEm) {
        try {
            JSONArray fila = lerFila(contexto);
            JSONObject sms = new JSONObject();
            sms.put("from", de);
            sms.put("body", texto);
            sms.put("receivedAt", recebidoEm);
            fila.put(sms);
            // Sem internet por dias: os mais antigos já expiraram no servidor.
            while (fila.length() > MAX_NA_FILA) fila.remove(0);
            prefs(contexto).edit().putString(FILA, fila.toString()).apply();
        } catch (JSONException ignorado) {
            // Montar um JSON simples não falha na prática.
        }
    }

    static synchronized JSONArray lerFila(Context contexto) {
        try {
            return new JSONArray(prefs(contexto).getString(FILA, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static synchronized void gravarFila(Context contexto, JSONArray fila) {
        prefs(contexto).edit().putString(FILA, fila.toString()).apply();
    }

    static int pendentes(Context contexto) {
        return lerFila(contexto).length();
    }

    // --- Histórico da tela -------------------------------------------------

    static synchronized void registrar(Context contexto, String evento) {
        try {
            JSONArray historico = new JSONArray(prefs(contexto).getString(HISTORICO, "[]"));
            String hora = new SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault()).format(new Date());
            historico.put(hora + "  " + evento);
            while (historico.length() > MAX_NO_HISTORICO) historico.remove(0);
            prefs(contexto).edit().putString(HISTORICO, historico.toString()).apply();
        } catch (JSONException ignorado) {
            // Histórico é só para leitura humana.
        }
    }

    static synchronized String historico(Context contexto) {
        try {
            JSONArray historico = new JSONArray(prefs(contexto).getString(HISTORICO, "[]"));
            StringBuilder texto = new StringBuilder();
            for (int i = historico.length() - 1; i >= 0; i--) {
                texto.append(historico.getString(i)).append('\n');
            }
            return texto.length() == 0 ? "Nada ainda." : texto.toString();
        } catch (JSONException e) {
            return "";
        }
    }
}
