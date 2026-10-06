package br.com.rapidinhoentrega.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Recebe cada SMS que chega ao celular.
 *
 * Tenta repassar NA HORA — o cliente está olhando a tela esperando entrar — e,
 * se não houver internet, guarda na fila para o worker reenviar. O Android dá
 * uns 10 segundos a um receptor com goAsync; o envio usa esse tempo numa
 * thread própria.
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] partes = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (partes == null || partes.length == 0) return;

        // SMS longo chega em partes; junta por remetente.
        Map<String, StringBuilder> porRemetente = new LinkedHashMap<>();
        long recebidoEm = System.currentTimeMillis();
        for (SmsMessage parte : partes) {
            if (parte == null) continue;
            String de = parte.getDisplayOriginatingAddress();
            if (de == null) continue;
            StringBuilder texto = porRemetente.get(de);
            if (texto == null) {
                texto = new StringBuilder();
                porRemetente.put(de, texto);
            }
            texto.append(parte.getDisplayMessageBody());
            recebidoEm = parte.getTimestampMillis() > 0 ? parte.getTimestampMillis() : recebidoEm;
        }

        final Context app = contexto.getApplicationContext();
        final PendingResult pendente = goAsync();
        final long quando = recebidoEm;

        new Thread(() -> {
            try {
                for (Map.Entry<String, StringBuilder> sms : porRemetente.entrySet()) {
                    repassar(app, sms.getKey(), sms.getValue().toString(), quando);
                }
            } finally {
                pendente.finish();
            }
        }, "repasse-sms").start();
    }

    private static void repassar(Context contexto, String de, String texto, long recebidoEm) {
        // SMS pessoal não sai do celular.
        if (!Filtro.ehConfirmacao(de, texto)) return;

        if (!Config.configurado(contexto)) {
            Config.registrar(contexto, "SMS de " + mascarar(de) + " ignorado: app não configurado");
            return;
        }

        int codigo = Servidor.enviarSms(contexto, de, texto, recebidoEm);

        if (Servidor.entregue(codigo)) {
            Config.registrar(contexto, "Repassado: " + mascarar(de));
        } else if (codigo == 401) {
            Config.registrar(contexto, "Token recusado pelo servidor — configure de novo");
        } else {
            Config.enfileirar(contexto, de, texto, recebidoEm);
            Config.registrar(contexto, "Sem conexão (" + codigo + "): guardado para reenviar");
            Agendador.reenviarQuandoTiverInternet(contexto);
        }
    }

    /** O histórico fica na tela: mostra só o fim do número. */
    static String mascarar(String numero) {
        String digitos = numero.replaceAll("\\D", "");
        return digitos.length() <= 4 ? numero : "•••" + digitos.substring(digitos.length() - 4);
    }
}
