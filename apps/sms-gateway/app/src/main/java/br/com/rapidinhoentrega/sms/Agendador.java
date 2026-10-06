package br.com.rapidinhoentrega.sms;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * Trabalho em segundo plano, com o WorkManager: sobrevive a reinício do
 * celular e respeita a economia de bateria sem ser morto por ela.
 *
 *  - sinal de vida a cada 15 minutos (o mínimo que o Android permite), que
 *    também esvazia a fila;
 *  - reenvio da fila assim que a internet voltar.
 */
final class Agendador {
    private static final String SINAL = "sinal-de-vida";
    private static final String REENVIO = "reenvio";

    private Agendador() {}

    private static Constraints comInternet() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    static void manterSinalDeVida(Context contexto) {
        PeriodicWorkRequest pedido =
                new PeriodicWorkRequest.Builder(Trabalho.class, 15, TimeUnit.MINUTES)
                        .setConstraints(comInternet())
                        .build();
        WorkManager.getInstance(contexto)
                .enqueueUniquePeriodicWork(SINAL, ExistingPeriodicWorkPolicy.KEEP, pedido);
    }

    static void reenviarQuandoTiverInternet(Context contexto) {
        OneTimeWorkRequest pedido =
                new OneTimeWorkRequest.Builder(Trabalho.class)
                        .setConstraints(comInternet())
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                        .build();
        WorkManager.getInstance(contexto)
                .enqueueUniqueWork(REENVIO, ExistingWorkPolicy.REPLACE, pedido);
    }

    /** Esvazia a fila; o que falhar volta para ela. Devolve se sobrou algo. */
    static boolean esvaziarFila(Context contexto) {
        JSONArray fila = Config.lerFila(contexto);
        if (fila.length() == 0) return false;

        JSONArray sobra = new JSONArray();
        for (int i = 0; i < fila.length(); i++) {
            JSONObject sms = fila.optJSONObject(i);
            if (sms == null) continue;
            int codigo = Servidor.enviarSms(
                    contexto, sms.optString("from"), sms.optString("body"), sms.optLong("receivedAt"));
            if (Servidor.entregue(codigo)) {
                Config.registrar(contexto, "Reenviado: " + SmsReceiver.mascarar(sms.optString("from")));
            } else if (codigo != 401) {
                sobra.put(sms);
            }
        }
        Config.gravarFila(contexto, sobra);
        return sobra.length() > 0;
    }

    public static class Trabalho extends Worker {
        public Trabalho(@NonNull Context contexto, @NonNull WorkerParameters parametros) {
            super(contexto, parametros);
        }

        @NonNull
        @Override
        public Result doWork() {
            Context contexto = getApplicationContext();
            if (!Config.configurado(contexto)) return Result.success();

            boolean sobrou = esvaziarFila(contexto);
            int sinal = Servidor.enviarSinal(contexto);

            if (sinal == 401) {
                Config.registrar(contexto, "Token recusado pelo servidor — configure de novo");
                return Result.success();
            }
            return sobrou || !Servidor.entregue(sinal) ? Result.retry() : Result.success();
        }
    }
}
