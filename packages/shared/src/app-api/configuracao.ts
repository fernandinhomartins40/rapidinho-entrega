import type { ConfiguracaoDoApp } from './tipos';

/**
 * Ajustes remotos do app, servidos em `GET configuracao`.
 *
 * Constante por enquanto: mudar aqui dispensa publicar versão nova na loja de
 * aplicativos, que é tudo o que se precisa hoje. Quando alguém precisar mudar
 * sem deploy, a leitura passa para `PlatformSetting` sem mudar o contrato.
 * `loginPorFirebase` fica de fora: vem do ambiente, na rota.
 */
export const CONFIGURACAO_DO_APP: Omit<ConfiguracaoDoApp, 'loginPorFirebase'> = {
  versaoMinima: { android: '1.0.0', ios: '1.0.0' },
  recursos: {
    pedidoPorLista: true,
    toComFome: true,
    comprovantePix: true,
    modoEntregador: true,
  },
  textos: { aviso: null, suporteWhatsapp: null },
};
