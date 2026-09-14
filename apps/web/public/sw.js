/**
 * Service worker do Rapidinho Entrega.
 *
 * Escrito à mão, sem Workbox: são três estratégias de cache e umas 80 linhas.
 * Puxar uma biblioteca de 20 KB para isso sairia caro justamente para quem
 * mais precisa de leveza — o público está em 3G e celular antigo.
 */

const VERSAO = 'rapidinho-v1';
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const CACHE_IMAGENS = `${VERSAO}-imagens`;

/** Guarda o essencial para a tela offline aparecer sem rede. */
const ESSENCIAIS = ['/offline', '/marca/lettering.webp', '/marca/icone-192.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      // `addAll` falha inteiro se um item falhar; pré-cache não pode impedir
      // a instalação do service worker.
      .then((cache) => Promise.allSettled(ESSENCIAIS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((chave) => !chave.startsWith(VERSAO)).map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Guarda no cache sem deixar ele crescer para sempre. */
async function guardar(nomeDoCache, requisicao, resposta, maximo) {
  const cache = await caches.open(nomeDoCache);
  await cache.put(requisicao, resposta);

  const chaves = await cache.keys();
  if (chaves.length > maximo) {
    // As mais antigas saem primeiro; o Cache API mantém a ordem de inserção.
    await Promise.all(chaves.slice(0, chaves.length - maximo).map((chave) => cache.delete(chave)));
  }
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;

  // Só GET: POST de pedido ou de login nunca pode sair do cache.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Requisição para outro domínio é problema de quem a fez.
  if (url.origin !== self.location.origin) return;

  // Rotas de API e de autenticação sempre vão à rede: servir um carrinho ou
  // uma sessão do cache é pior que falhar.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;

  // Imagens: cache primeiro. O nome carrega hash, então o conteúdo nunca muda
  // sob a mesma URL.
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/marca/')) {
    evento.respondWith(
      caches.match(request).then(
        (emCache) =>
          emCache ??
          fetch(request).then((resposta) => {
            if (resposta.ok) {
              void guardar(CACHE_IMAGENS, request, resposta.clone(), 120);
            }
            return resposta;
          }),
      ),
    );
    return;
  }

  // Navegação: rede primeiro, cache como rede de segurança. Preço e status de
  // loja mudam o tempo todo — servir do cache mostraria loja fechada como
  // aberta.
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            void guardar(CACHE_PAGINAS, request, resposta.clone(), 40);
          }
          return resposta;
        })
        .catch(async () => {
          const emCache = await caches.match(request);
          return emCache ?? caches.match('/offline');
        }),
    );
  }
});

/** Notificação push de mudança de status do pedido. */
self.addEventListener('push', (evento) => {
  if (!evento.data) return;

  let dados;
  try {
    dados = evento.data.json();
  } catch {
    dados = { title: 'Rapidinho Entrega', body: evento.data.text() };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.title ?? 'Rapidinho Entrega', {
      body: dados.body ?? '',
      icon: '/marca/icone-192.png',
      badge: '/marca/icone-192.png',
      // A tag agrupa: várias mudanças do mesmo pedido substituem a anterior em
      // vez de empilhar quatro notificações na tela.
      tag: dados.tag ?? 'rapidinho',
      data: { url: dados.url ?? '/pedidos' },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url ?? '/pedidos';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Reaproveita uma aba já aberta em vez de abrir outra a cada toque.
      for (const janela of janelas) {
        if (janela.url.includes(destino) && 'focus' in janela) return janela.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
