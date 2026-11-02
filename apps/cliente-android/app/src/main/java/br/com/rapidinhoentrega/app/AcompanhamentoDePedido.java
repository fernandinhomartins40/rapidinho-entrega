package br.com.rapidinhoentrega.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Avisa o cliente da mudança do pedido com o app fechado, sem Firebase.
 *
 * Roda só enquanto há pedido em andamento, consultando o site a cada 30
 * segundos, e para sozinho quando o pedido termina. O Android exige um aviso
 * fixo na barra para um serviço assim: é ele que mostra o status atual.
 */
public class AcompanhamentoDePedido extends Service {

    private static final String CANAL_FIXO = "pedido-em-andamento";
    private static final String CANAL_AVISO = "mudanca-do-pedido";
    private static final int AVISO_FIXO = 1;
    private static final long INTERVALO_MS = 30_000;
    /** Falhas seguidas toleradas: sem internet por um tempo não encerra nada. */
    private static final int MAXIMO_DE_FALHAS = 40;

    /** Só o MainActivity consulta esta rota de fora do serviço. */
    static final String ROTA = BuildConfig.SITE_URL + "/api/pedidos/ativos";

    private final Map<String, String> ultimoStatus = new HashMap<>();
    private volatile boolean rodando;
    private Thread consulta;

    static void iniciar(Context contexto) {
        Intent intent = new Intent(contexto, AcompanhamentoDePedido.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                contexto.startForegroundService(intent);
            } else {
                contexto.startService(intent);
            }
        } catch (IllegalStateException e) {
            // O Android recusa iniciar com o app já em segundo plano. O cliente
            // perde só o aviso desta vez, e o status segue certo no app.
        }
    }

    /** Devolve a resposta da rota, ou null se não deu para consultar. */
    static JSONObject consultar() {
        String cookie = CookieManager.getInstance().getCookie(BuildConfig.SITE_URL);
        if (cookie == null) return null;

        HttpURLConnection conexao = null;
        try {
            conexao = (HttpURLConnection) new URL(ROTA).openConnection();
            conexao.setConnectTimeout(10_000);
            conexao.setReadTimeout(10_000);
            conexao.setRequestProperty("Cookie", cookie);
            conexao.setRequestProperty("User-Agent", "RapidinhoApp/" + BuildConfig.VERSION_NAME);

            if (conexao.getResponseCode() != 200) return null;

            StringBuilder corpo = new StringBuilder();
            try (BufferedReader leitor = new BufferedReader(
                new InputStreamReader(conexao.getInputStream(), StandardCharsets.UTF_8))) {
                String linha;
                while ((linha = leitor.readLine()) != null) corpo.append(linha);
            }
            return new JSONObject(corpo.toString());
        } catch (IOException | org.json.JSONException e) {
            return null;
        } finally {
            if (conexao != null) conexao.disconnect();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        criarCanais();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Precisa vir logo no início: o Android encerra quem demora a mostrar o aviso.
        Notification aviso = avisoFixo("Acompanhando seu pedido", "Avisamos quando mudar.", null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(AVISO_FIXO, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(AVISO_FIXO, aviso);
        }

        if (!rodando) {
            rodando = true;
            consulta = new Thread(this::acompanhar, "acompanhamento-de-pedido");
            consulta.start();
        }
        return START_NOT_STICKY;
    }

    private void acompanhar() {
        int falhas = 0;

        while (rodando && falhas < MAXIMO_DE_FALHAS) {
            JSONObject resposta = consultar();

            if (resposta == null) {
                falhas++;
            } else {
                falhas = 0;
                try {
                    if (!processar(resposta)) break;
                } catch (org.json.JSONException e) {
                    falhas++;
                }
            }

            try {
                Thread.sleep(INTERVALO_MS);
            } catch (InterruptedException e) {
                break;
            }
        }

        stopSelf();
    }

    /** Avisa o que mudou. Devolve false quando não sobrou pedido em andamento. */
    private boolean processar(JSONObject resposta) throws org.json.JSONException {
        JSONArray pedidos = resposta.getJSONArray("pedidos");
        JSONObject emAndamento = null;

        for (int i = 0; i < pedidos.length(); i++) {
            JSONObject pedido = pedidos.getJSONObject(i);
            String id = pedido.getString("id");
            String status = pedido.getString("status");
            String anterior = ultimoStatus.put(id, status);

            // Na primeira leitura só guarda: o cliente acabou de ver esse status.
            if (anterior != null && !anterior.equals(status)) {
                avisar(pedido);
            }
            if (emAndamento == null && pedido.getBoolean("ativo")) {
                emAndamento = pedido;
            }
        }

        if (emAndamento == null) return false;

        gerenciador().notify(AVISO_FIXO, avisoFixo(
            "Pedido #" + emAndamento.getString("numero"),
            emAndamento.getString("rotulo"),
            emAndamento.getString("caminho")));
        return true;
    }

    private void avisar(JSONObject pedido) throws org.json.JSONException {
        Notification aviso = construtor(CANAL_AVISO)
            .setContentTitle("Pedido #" + pedido.getString("numero"))
            .setContentText(pedido.getString("mensagem"))
            .setContentIntent(abrir(pedido.getString("caminho")))
            .setAutoCancel(true)
            .build();
        gerenciador().notify(pedido.getString("id").hashCode(), aviso);
    }

    private Notification avisoFixo(String titulo, String texto, String caminho) {
        return construtor(CANAL_FIXO)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setContentIntent(abrir(caminho))
            .setOngoing(true)
            .build();
    }

    private Notification.Builder construtor(String canal) {
        Notification.Builder construtor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, canal)
            : new Notification.Builder(this);
        return construtor.setSmallIcon(R.drawable.ic_notificacao);
    }

    private PendingIntent abrir(String caminho) {
        Intent intent = new Intent(this, MainActivity.class);
        if (caminho != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(BuildConfig.SITE_URL + caminho));
        }
        return PendingIntent.getActivity(this, caminho == null ? 0 : caminho.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private NotificationManager gerenciador() {
        return (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void criarCanais() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        gerenciador().createNotificationChannel(new NotificationChannel(
            CANAL_FIXO, "Pedido em andamento", NotificationManager.IMPORTANCE_LOW));
        gerenciador().createNotificationChannel(new NotificationChannel(
            CANAL_AVISO, "Mudanças do pedido", NotificationManager.IMPORTANCE_HIGH));
    }

    /** Limite do Android para este tipo de serviço (6 horas): encerra sem erro. */
    @Override
    public void onTimeout(int startId) {
        rodando = false;
        stopSelf();
    }

    /** O mesmo limite, na forma que o Android 15 chama. */
    @Override
    public void onTimeout(int startId, int tipoDoServico) {
        onTimeout(startId);
    }

    @Override
    public void onDestroy() {
        rodando = false;
        if (consulta != null) consulta.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
