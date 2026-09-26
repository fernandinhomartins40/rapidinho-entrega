/**
 * Script inline que tira a landing do caminho quando ela abre dentro do app
 * instalado (PWA).
 *
 * Roda enquanto o HTML é lido, antes de a página ser desenhada — sem o "pisca"
 * da apresentação. Cobre também quem instalou o app antes de o `start_url`
 * mudar para `/app`: o manifesto no aparelho demora a atualizar.
 *
 * Módulo à parte, e não exportado de `guarda-do-app.tsx`: constante exportada
 * de arquivo `'use client'` chega ao servidor como referência, não como valor.
 * A condição é a mesma de `estaNoApp()` lá — os dois precisam concordar.
 */
export const SCRIPT_GUARDA_DO_APP =
  "try{if(window.matchMedia('(display-mode: standalone)').matches" +
  "||window.matchMedia('(display-mode: fullscreen)').matches" +
  "||window.navigator.standalone===true){location.replace('/app')}}catch(e){}";
