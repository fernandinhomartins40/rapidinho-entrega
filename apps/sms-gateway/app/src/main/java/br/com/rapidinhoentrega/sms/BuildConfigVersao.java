package br.com.rapidinhoentrega.sms;

import android.content.Context;
import android.content.pm.PackageManager;

/** Versão instalada, para o painel mostrar qual app está no celular. */
final class BuildConfigVersao {
    private BuildConfigVersao() {}

    static String nome(Context contexto) {
        try {
            return contexto.getPackageManager()
                    .getPackageInfo(contexto.getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "?";
        }
    }
}
