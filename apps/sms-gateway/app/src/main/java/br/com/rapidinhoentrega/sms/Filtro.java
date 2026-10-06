package br.com.rapidinhoentrega.sms;

import java.util.regex.Pattern;

/**
 * Decide, NO CELULAR, se um SMS é de confirmação e pode sair do aparelho.
 *
 * Este é um celular de verdade, com SMS pessoais. Só vai para o servidor o que
 * tem cara de confirmação:
 *  - remetente é um celular brasileiro (SMS de banco e operadora vêm de
 *    números curtos e ficam de fora);
 *  - texto curto (o de confirmação tem ~16 caracteres);
 *  - tem um código de 6 dígitos solto.
 *
 * A regra de verdade (código certo, do número certo, dentro do prazo) é do
 * servidor; aqui é só para não mandar o que claramente não é login.
 */
final class Filtro {
    /** "Rapidinho 123456" com folga para quem digitar uma frase. */
    static final int TAMANHO_MAXIMO = 80;

    private static final Pattern CODIGO = Pattern.compile("(?<!\\d)\\d{6}(?!\\d)");

    private Filtro() {}

    static boolean ehConfirmacao(String remetente, String texto) {
        if (remetente == null || texto == null) return false;
        if (texto.length() > TAMANHO_MAXIMO) return false;
        if (!CODIGO.matcher(texto).find()) return false;

        String digitos = remetente.replaceAll("\\D", "");
        // Com DDD são 10 ou 11 dígitos; com +55, "0" ou código de operadora,
        // até 14. Menos que 10 é número curto de empresa.
        return digitos.length() >= 10 && digitos.length() <= 14;
    }
}
