import { useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as WebViewOriginal, type WebViewProps } from 'react-native-webview';
import type { PontoNoMapa } from '@contrato';
import { URL_DA_API } from '@/api/cliente';
import { cores, raio } from '@/tema/tokens';

type ControleDaPagina = { injectJavaScript: (codigo: string) => void };

// Os tipos da 14.x declaram componente de função sem `ref`, mas ele repassa o
// ref para a instância nativa, que tem `injectJavaScript`.
const WebView = WebViewOriginal as unknown as ComponentType<
  WebViewProps & { ref?: Ref<ControleDaPagina> }
>;

type Pontos = {
  loja: PontoNoMapa | null;
  destino: PontoNoMapa | null;
  entregador: PontoNoMapa | null;
};

/**
 * Google Maps dentro da tela do pedido, pela Maps JavaScript API.
 *
 * Não é o mapa nativo de propósito: o nativo só aceita a chave gravada no APK,
 * e esta vem do painel do super admin. A página carrega com o endereço do site
 * como origem, que é o domínio liberado na restrição da chave.
 *
 * A posição nova entra por `atualizar()`, sem recarregar a página: a moto
 * desliza do ponto antigo ao novo.
 */
export function MapaDaEntrega({
  chave,
  pontos,
  aoFalhar,
}: {
  chave: string;
  pontos: Pontos;
  aoFalhar: () => void;
}) {
  const web = useRef<ControleDaPagina>(null);
  const [pronto, setPronto] = useState(false);
  const html = useMemo(() => paginaDoMapa(chave), [chave]);
  const dados = JSON.stringify(pontos);

  useEffect(() => {
    if (pronto) web.current?.injectJavaScript(`window.atualizar(${dados});true;`);
  }, [pronto, dados]);

  return (
    <View style={estilos.moldura}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html, baseUrl: URL_DA_API }}
        onMessage={(evento) => {
          if (evento.nativeEvent.data === 'pronto') setPronto(true);
          if (evento.nativeEvent.data === 'falha') aoFalhar();
        }}
        onError={aoFalhar}
        scrollEnabled={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        style={estilos.web}
      />
    </View>
  );
}

const icone = (fundo: string, simbolo: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="${fundo}" stroke="#fff" stroke-width="4"/><text x="22" y="29" font-size="20" text-anchor="middle">${simbolo}</text></svg>`,
  )}`;

function paginaDoMapa(chave: string) {
  const icones = {
    loja: icone('#FFFFFF', '🏪'),
    destino: icone('#FFFFFF', '🏠'),
    entregador: icone(cores.marca, '🛵'),
  };
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#mapa{margin:0;height:100%;width:100%;background:${cores.superficieAlta}}</style>
</head><body><div id="mapa"></div><script>
var avisar=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)};
window.gm_authFailure=function(){avisar('falha')};
var mapa,marcas={},enquadrado=false,icones=${JSON.stringify(icones)};
function marca(nome,ponto){
  if(!ponto){if(marcas[nome]){marcas[nome].setMap(null);delete marcas[nome]}return}
  var destino=new google.maps.LatLng(ponto.latitude,ponto.longitude);
  var m=marcas[nome];
  if(!m){
    marcas[nome]=new google.maps.Marker({map:mapa,position:destino,zIndex:nome==='entregador'?3:1,
      icon:{url:icones[nome],scaledSize:new google.maps.Size(44,44),anchor:new google.maps.Point(22,22)}});
    return;
  }
  var de=m.getPosition(),inicio=performance.now(),tempo=1500;
  (function passo(agora){
    var t=Math.min(1,(agora-inicio)/tempo);
    m.setPosition(new google.maps.LatLng(de.lat()+(destino.lat()-de.lat())*t,de.lng()+(destino.lng()-de.lng())*t));
    if(t<1)requestAnimationFrame(passo);
  })(inicio);
}
window.atualizar=function(p){
  if(!mapa)return;
  marca('loja',p.loja);marca('destino',p.destino);marca('entregador',p.entregador);
  var limites=new google.maps.LatLngBounds(),n=0;
  [p.loja,p.destino,p.entregador].forEach(function(x){if(x){limites.extend({lat:x.latitude,lng:x.longitude});n++}});
  if(!n)return;
  var visivel=mapa.getBounds();
  var fugiu=p.entregador&&visivel&&!visivel.contains({lat:p.entregador.latitude,lng:p.entregador.longitude});
  if(!enquadrado||fugiu){
    if(n===1){mapa.setCenter(limites.getCenter());mapa.setZoom(16)}else{mapa.fitBounds(limites,48)}
    enquadrado=true;
  }
};
function iniciar(){
  mapa=new google.maps.Map(document.getElementById('mapa'),{center:{lat:-14.2,lng:-51.9},zoom:4,
    disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',clickableIcons:false});
  avisar('pronto');
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chave)}&callback=iniciar&language=pt-BR&region=BR" onerror="avisar('falha')"></script>
</body></html>`;
}

const estilos = StyleSheet.create({
  moldura: { height: 240, borderRadius: raio.folha, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: cores.superficieAlta },
});
