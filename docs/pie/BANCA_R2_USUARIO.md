# Banca R2: usuário adversarial (produto e UX)

Revisor: R2. Data: 2026-11-01/02. Commit auditado: `d65c0e5` (main).
Ambiente: web `http://localhost:3200`, painel `http://localhost:3201` (OTP em console, sem SMS real).
Ferramenta: Playwright 1.63 com Edge (`channel: 'msedge'`), perfil Pixel 5 (393×851), user-agent do app
com ` RapidinhoApp/teste` no site. Capturas em `docs/pie/evidencias/r2/`. Scripts em
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\r2\`
(`lib.cjs` e `j1…j11.cjs`; a saída de cada um fica em `jN.out`).

Revisão independente: não li os outros pareceres `BANCA_*`. Não alterei código, configuração nem git.
Neste documento os números de telefone são todos de teste (faixa 44 99777-xxxx, seed e2e) e nenhuma senha
aparece: a senha provisória gerada foi mascarada na saída do script.

---

## 1. Resumo executivo

O fluxo central de compra funciona: entrar pelo app, escolher a loja, montar o carrinho, cadastrar o
endereço e fazer o pedido. Ele resiste a duplo clique (um único POST, e o pedido não sai duplicado) e
volta ao carrinho quando o cliente usa "voltar" depois do pedido. Mesmo assim, um cliente leigo trava
ou se confunde em pontos que se repetem no uso de todo dia:

1. **O app nativo abre na página de propaganda do site**, a que diz "Baixar agora" e "Disponível na App
   Store", e o login devolve o cliente para ela (R2-001).
2. **Na tela do produto, tocar no nome da opção ("Ao ponto") não faz nada.** Só o círculo de 24 px
   responde, e o botão fica travado em "Escolha: Ponto da carne" (R2-002).
3. **O cadastro de loja apaga os 13 campos** quando o servidor devolve um erro (R2-003).
4. **O novo login deixa três grupos sem saída clara.** O cliente de iPhone vê apenas "Baixar o app para
   Android" (R2-004). O lojista antigo, ou o que esqueceu a senha, vê só "E-mail ou senha incorretos.",
   sem "esqueci" e sem contato (R2-005). O entregador, pelo app, é levado ao login de cliente e cai na
   landing, sem caminho visível até o painel (R2-006). Os links "Entre com seu telefone" para lojista
   ainda apontam para o login de cliente (R2-007).
5. **Mensagens e dados errados na tela.** O troco digitado como "R$ 50" devolve "Expected number,
   received nan" (R2-009). A conta mostra o telefone errado, "(55) 44997-7702" (R2-010). O checkout
   mostra "Entrega Grátis" antes de saber o endereço (R2-011).

Severidade dos achados (30): 0 Crítica, 7 Alta, 14 Média, 9 Baixa. O ambiente local ficou instável durante
a revisão (memória da máquina perto do limite; veja a seção 6), o que limitou a cobertura de algumas
jornadas. A seção 4 diz exatamente o que não foi testado.

---

## 2. Jornadas executadas (passos medidos)

Contagem: cada toque/tela que exige decisão = 1 passo; campos digitados e escolhas obrigatórias contados à parte.

| #   | Jornada (perfil)                                         | Script       | Passos                                                                                   | Campos          | Escolhas obrig.         | Resultado                                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- | --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | Abrir site fora do app / iPhone (cliente)                | j1           | 2 (home → /entrar)                                                                       | 0               | 0                       | Convite ao APK só existe em `/entrar`; iPhone sem saída (R2-004, R2-008)                                                                                                                                                                                                                                |
| J2  | Entrar pelo app (cliente)                                | j2           | 3 (telefone → código → entrar)                                                           | 2               | 0                       | OK; problemas de máscara, fixo aceito, sem reenviar (R2-012, R2-013, R2-014, R2-024)                                                                                                                                                                                                                    |
| J3  | Escolher cidade, buscar (cliente)                        | j3           | 1–2                                                                                      | 1               | 0                       | Cidade única: OK. Busca não acha "xis", "coca" (R2-017)                                                                                                                                                                                                                                                 |
| J4  | Loja → produto → carrinho, carrinho de 2 lojas (cliente) | j4           | 4 por item                                                                               | 0               | 1 por grupo obrigatório | Opção só no círculo (R2-002); duplo clique em Adicionar não duplica (OK); carrinhos por loja separados (OK)                                                                                                                                                                                             |
| J5  | Checkout com endereço novo + pedido (cliente)            | j5, j5b, j5c | 7 (continuar → cadastrar endereço → 4 campos → salvar → pagamento → nome → fazer pedido) | 5–6             | 2 (pagamento, endereço) | Pedido criado com 1 POST no duplo clique (OK). Troco texto (R2-009), frete "Grátis" antes do endereço (R2-011), nome sem rótulo e não lembrado (R2-015)                                                                                                                                                 |
| J6  | Acompanhar pedido / meus pedidos (cliente)               | j5c          | 1                                                                                        | 0               | 0                       | "Pedido recebido" e linha do tempo claros; sem cancelar pelo app (R2-019)                                                                                                                                                                                                                               |
| J7  | Favoritos (cliente)                                      | j5c          | 2                                                                                        | 0               | 0                       | Estado vazio claro; favoritar e ver na lista OK                                                                                                                                                                                                                                                         |
| J8  | Conta, exportar dados, excluir (cliente)                 | j5d          | 3–5                                                                                      | 1 ("EXCLUIR")   | 0                       | Telefone errado (R2-010); exclusão barrada com pedido aberto, mensagem longe do botão (R2-026); download não observado (inconclusivo, R2-016)                                                                                                                                                           |
| J9  | Cadastro de loja (lojista)                               | j9           | 1 tela, 13 campos                                                                        | 10 obrigatórios | 1 (cidade)              | Erro do servidor apaga tudo (R2-003); link "Entre com seu telefone" (R2-007)                                                                                                                                                                                                                            |
| J10 | Login lojista com senha, pedidos, produto (lojista)      | j6           | 2                                                                                        | 2               | 0                       | Login OK, e-mail normalizado (maiúsculas/espaço aceitos); erro genérico sem saída (R2-005); lista truncada (R2-021); "Reconectando…" (R2-027)                                                                                                                                                           |
| J11 | Trocar senha (lojista/funcionário)                       | j6, j7b      | 1 tela, 3 campos                                                                         | 3               | 0                       | Veja a seção 2.1                                                                                                                                                                                                                                                                                        |
| J12 | Super admin: lojas, usuários, senha provisória           | j7, j7b      | 3 (usuários → engrenagem → gerar)                                                        | 1 (e-mail)      | 0                       | A senha provisória é gerada com a mensagem "Senha provisória de Gerente do e2e: [oculta] — anote e envie agora, ela não aparece de novo. No painel, a pessoa troca em "Minha senha"." (OK); a cópia e o envio são manuais. Tabelas cortam no celular (R2-022). Aprovar loja não foi executado (seção 4) |
| J13 | Entregador: entrar e ver corridas                        | j8           | 3 (painel com UA do app)                                                                 | 2               | 0                       | Painel OK; caminho até ele inexistente no app (R2-006)                                                                                                                                                                                                                                                  |

### 2.1 Resultados que dependem das últimas execuções

- **360 px com 3G simulado** (`node j11.cjs`; latência de 400 ms e 400 kbps): a vitrine não tem
  rolagem horizontal (`scrollWidth 360 = viewport 360`). Tempos no servidor dev: DOMContentLoaded em
  61,9 s e load em 118,9 s. O bundle de desenvolvimento não é minificado, então o número não vale para
  produção; ainda assim, não existe nenhum esqueleto ou indicador além do que o Next mostra por padrão.
  Captura: `j11-01-vitrine-360-3g.png`.
- **Montador de pizza em 360 px:** tamanhos e sabores legíveis, o texto explica a regra ("Toque em até 2
  sabores: a pizza se divide sozinha. Com mais de um sabor, vale o preço do mais caro."), e a borda vem
  marcada com "Sem borda recheada". Tentei três toques seguidos em sabores numa Média (máximo 2); a tela
  terminou com só "Portuguesa" marcada e "1 de até 2" (`j11-03-pizza-3-sabores.png`). Não consegui
  isolar se foi a troca automática do último sabor ou a lentidão do ambiente: **inconclusivo**. O único
  alvo pequeno na tela é "Voltar para a loja", com 40×40.
- **Fonte ampliada (raiz em 200 %)** na loja: sem rolagem horizontal (`scrollWidth 393 = viewport
393`). Captura: `j11-04-loja-fonte-200.png`.
- **Tablet (820×1180):** a vitrine renderiza (`j11-05-vitrine-tablet.png`); não avaliei em detalhe.
- **Lojista, cadastro de produto:** o preço "12,5" foi salvo como "R$ 12,50" (positivo: o painel
  aceita vírgula). Preço "abc" fica no campo (`inputMode="decimal"` não bloqueia), mas não submeti
  isolado.
- **Lojista, minha senha:** a tela é clara ("Para entrar no painel com lojista@…", "Pelo menos 8
  caracteres.", "Repita a nova senha"), com rótulo em todos os campos. Pelo código
  (`apps/admin/src/lib/trocar-senha.ts:63-66`), a troca não encerra as outras sessões abertas (sem
  `revokeAllSessions`), ao contrário da senha provisória, que encerra. FORTE INDÍCIO, registrado como
  R2-030.

---

## 3. Achados

### R2-001: O app nativo abre na landing de marketing, e o login devolve o cliente para ela

- **Categoria:** Fluxo / primeira impressão (Nielsen: compatibilidade com o mundo real).
- **Severidade:** Alta. É a primeira tela de todo cliente que instala o APK. Ela pede para "Baixar agora"
  um app que a pessoa já tem e promete App Store. O guarda que tiraria a landing do caminho só reconhece
  PWA, não o WebView.
- **Estado:** CONFIRMADO (navegador com o UA do app). Que o WebView do APK reporta `display-mode`
  "browser" é FORTE INDÍCIO: não rodei o app num aparelho.
- **Arquivo:linha:** `apps/web/src/components/landing/guarda-do-app.tsx:7-13` e
  `apps/web/src/components/landing/script-do-app.ts` (só `display-mode: standalone/fullscreen`);
  `apps/cliente-android/app/build.gradle:18` (SITE_URL = raiz) e `MainActivity.java:60`;
  `apps/web/src/app/entrar/page.tsx:46` (`destino ?? '/'`) e `entrar/actions.ts:290-291`.
- **Reprodução:** com o UA ` RapidinhoApp/teste`, abra `/` e entre pelo `/entrar` sem `destino`.
- **Esperado:** dentro do app, abrir em `/app` (cidade ou vitrine) e, depois do login, voltar para lá.
- **Observado:** `APP abre / -> http://localhost:3200/`, com o texto "Seu pedido, na velocidade da sua
  vida… Disponível no Google Play | Disponível na App Store… Baixar agora". Depois do login: `apos entrar
url http://localhost:3200/` mostrando a mesma landing. O "Baixar agora" leva a `#pedir`.
- **Evidência:** `node j3.cjs` → `j3-01-app-abre-landing.png`; `node j2.cjs` → `j2-07-apos-login.png`.
- **Impacto:** o cliente leigo não reconhece que "já está no app" e pode tentar baixar de novo ou
  desistir. Cada abertura custa um passo a mais.
- **Correção proposta:** em `app/page.tsx`, `if (estaNoAppNativo(ua)) redirect('/app')`. Usar `/app`
  como destino padrão do login no app. Opcionalmente, mudar a SITE_URL do APK para `/app`.
- **Teste de aceite:** um GET em `/` com o UA `RapidinhoApp/x` responde 307 para `/app`, e o login sem
  `destino` termina em `/app` ou `/<cidade>`.

### R2-002: Opção de complemento só responde ao toque no círculo de 24 px; tocar no nome não faz nada

- **Categoria:** Interação / acessibilidade (alvo de toque, rótulo clicável).
- **Severidade:** Alta. Bloqueia a montagem do item mais comum (lanche com "Ponto da carne"
  obrigatório). O cliente toca em "Ao ponto", nada acontece, e o botão continua desabilitado com o texto
  "Escolha: Ponto da carne".
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/[cidade]/produto/[id]/formulario.tsx:269-324`. O nome fica num
  `<p>` dentro de `<li>`, e o `<input>` de `h-6 w-6` tem só `aria-label`, sem `<label>` envolvendo a
  linha. Os botões +/− dos grupos com repetição têm `h-9 w-9` (36 px), nas linhas 288-307.
- **Reprodução:** entre pelo app, abra `/palmital-pr/produto/<X-Salada>` e toque no texto "Ao ponto".
- **Esperado:** a linha inteira (nome e preço) marca a opção.
- **Observado:** `antes: Escolha: Ponto da carne` / `depois: Escolha: Ponto da carne true` (o botão
  continua desabilitado). Medida dos alvos: `input "Ao ponto" 24x24`, `input "Bacon extra" 24x24`…
- **Evidência:** `node dbg.cjs` → `dbg-produto.png`; `node j4.cjs` → `j4-02-produto.png`.
- **Impacto:** desistência na tela de produto, a de maior intenção de compra. Pior em telas pequenas e
  para quem tem pouca coordenação motora.
- **Correção proposta:** trocar o `<li>` por `<label className="flex … min-h-touch">` contendo o texto e
  o input (o mesmo padrão já usado nas formas de pagamento do checkout) e subir os +/− para 44 px.
- **Teste de aceite:** um teste e2e que clica em `getByText('Ao ponto')` e espera o botão
  "Adicionar · R$ 22,00" habilitado.

### R2-003: O cadastro de loja apaga todos os campos quando o servidor devolve erro

- **Categoria:** Prevenção de erro / perda de trabalho.
- **Severidade:** Alta. São 13 campos, incluindo senha e confirmação. Um erro simples (CPF inválido ou
  já usado, e-mail em uso) obriga a digitar tudo de novo, e o lojista com pressa desiste.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/cadastro-loja/formulario.tsx:16` e `:30`
  (`<form action={acao}>` com inputs não controlados e sem `defaultValue` do estado). Com React 19, o
  formulário é resetado depois da action. O mesmo padrão aparece em
  `apps/web/src/app/enderecos/novo/formulario.tsx:26,36`: o risco é idêntico, mas não testei o erro de
  servidor nessa tela.
- **Reprodução:** em `/cadastro-loja`, preencha tudo com CPF `11111111111` e toque em "Enviar cadastro".
- **Esperado:** os dados continuam na tela, e só o campo com problema fica destacado.
- **Observado:** a captura de "Enviando…" mostra tudo preenchido (`j9-02-erros.png`). A seguinte mostra
  todos os campos vazios, com "CPF ou CNPJ inválido" e "Confira os campos destacados."
  (`j9-03-resultado.png`).
- **Evidência:** `node j9.cjs`.
- **Impacto:** perda de lojistas no topo do funil de oferta.
- **Correção proposta:** devolver os valores enviados no `ActionResult` (sem as senhas) e usar
  `defaultValue`, ou controlar os campos. Ao exibir o erro, levar o foco ao primeiro campo inválido.
- **Teste de aceite:** enviar com CPF inválido e verificar que os outros 12 campos mantêm o valor.

### R2-004: Cliente de iPhone sem login nem explicação; a landing promete App Store e iOS

- **Categoria:** Impacto do novo login / comunicação (CDC, oferta).
- **Severidade:** Alta. Exclui um público inteiro e o engana: a landing diz "Disponível na App Store" e
  "Disponível para Android e iOS". No iPhone, `/pedidos`, `/conta` e o checkout levam a uma tela que só
  oferece "Baixar o app para Android".
- **Estado:** CONFIRMADO (perfil iPhone 13 no Playwright).
- **Arquivo:linha:** `apps/web/src/app/entrar/page.tsx:68-98`;
  `apps/web/src/components/landing/pecas.tsx:62-65` (selos) e `conteudo.ts:52-53` (as URLs são `null`);
  textos "Disponível para Android e iOS" nos componentes da landing.
- **Reprodução:** no iPhone, abra `/pedidos`.
- **Esperado:** dizer com clareza que ainda não há app para iPhone e dar uma alternativa (pedir pelo
  WhatsApp da loja, ou um login por SMS no navegador com limite) ou, no mínimo, uma lista de espera.
  Não anunciar iOS.
- **Observado:** `iPhone /pedidos -> /entrar?destino=/pedidos | Entre pelo app Rapidinho | Você confirma o
número uma vez por SMS e fica conectado, sem senha. | Baixar o app para Android | Depois de baixar,
toque no arquivo para instalar…`
- **Evidência:** `node j1.cjs` → `j1-04-entrar-iphone.png`, `j1-01-home-fora-app.png`.
- **Impacto:** perda de todo cliente de iPhone e risco de reclamação por propaganda enganosa.
- **Correção proposta:** detectar iOS no `BaixeOApp`, trocar o texto e dar a alternativa; tirar o selo
  App Store e o "iOS" até haver app (decisão de produto).
- **Teste de aceite:** com o UA de iPhone, `/entrar` não mostra "Android" como única saída nem cita
  App Store na landing.

### R2-005: Lojista sem senha (antigo) ou que esqueceu a senha fica preso no painel, sem orientação

- **Categoria:** Impacto do novo login / mensagem de erro sem ação.
- **Severidade:** Alta. Quem não tem senha não opera a loja (pedidos parados). A tela não diz o que fazer.
  Hoje os funcionários do seed (Gerente e Operador) e todo lojista anterior à mudança só têm telefone.
- **Estado:** CONFIRMADO (tela); a população afetada sai do seed (`packages/database/prisma/seed/e2e.ts:39-44`).
- **Arquivo:linha:** `apps/admin/src/app/entrar/login-form.tsx:49-110` (sem link de ajuda) e
  `apps/admin/src/app/entrar/actions.ts:225-228`.
- **Reprodução:** no painel, fora do app, digite o telefone no campo de e-mail ou um e-mail com senha
  errada.
- **Esperado:** abaixo do botão, algo como "Esqueceu a senha ou ainda não tem? Fale com a equipe
  Rapidinho" (link de WhatsApp do suporte), e uma dica de que o acesso agora é por e-mail.
- **Observado:** "E-mail ou senha incorretos." Os únicos controles da tela são `Entrar`. Com o telefone
  no campo de e-mail, o navegador mostra: `Inclua um "@" no endereço de email. "44998000002" não contém
um "@".`
- **Evidência:** `node j6.cjs` → `j6-02-senha-errada.png`, `j6-03-telefone-no-email.png`.
- **Impacto:** suporte sobrecarregado e lojas paradas logo depois do deploy.
- **Correção proposta:** link de ajuda fixo. Se o login vier com um telefone, mensagem específica: "O
  painel agora usa e-mail e senha. Peça seu acesso à equipe". Avisar os lojistas antigos por WhatsApp
  antes do deploy.
- **Teste de aceite:** a tela de login tem um link visível de ajuda com senha, e digitar um telefone
  gera uma mensagem orientadora.

### R2-006: O entregador não tem caminho visível até o painel pelo app; "Entre com seu telefone" o loga como cliente

- **Categoria:** Fluxo / impacto do novo login.
- **Severidade:** Alta. O APK abre o site do cliente. A página "Seja entregador" manda para o `/entrar`
  do site. O entregador entra e cai na landing. No WebView não há barra de endereço para digitar o
  painel, e o único link até ele está no rodapé da landing ("Sou lojista", 15 px de altura).
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/entregador/page.tsx:56-61` (`href="/entrar"`);
  `apps/web/src/components/landing/rodape.tsx:60-62`.
- **Reprodução:** com o UA do app, abra `/entregador`, toque em "Entre com seu telefone" e entre com o
  telefone do entregador do seed.
- **Esperado:** levar ao painel `/entregador` (`painel…/entrar?destino=/entregador`) ou, se o usuário
  for COURIER, redirecionar depois do login.
- **Observado:** `link "Entre com seu telefone" href: /entrar` → `entregador logado no SITE ->
http://localhost:3200/ | ENTREGAS MAIS RÁPIDAS…`. Pelo painel com o UA do app, o fluxo funciona:
  `entregador painel -> http://localhost:3201/entregador | Olá, Pedro | … Você está offline`.
- **Evidência:** `node j8.cjs` → `j8-01…j8-04`.
- **Impacto:** o entregador não fica online, e os pedidos não saem.
- **Correção proposta:** trocar o link por `${NEXT_PUBLIC_ADMIN_URL}/entrar?destino=/entregador` e, no
  login do site, mandar COURIER para o painel. Pôr um atalho "Sou entregador" no `/conta` do app.
- **Teste de aceite:** um e2e que, partindo de `/entregador` no site com o UA do app, chega a
  `painel/entregador`.

### R2-007: "Já tem loja cadastrada? Entre com seu telefone" leva ao login de cliente

- **Categoria:** Texto / fluxo desatualizado pela mudança de login.
- **Severidade:** Média. Fora do app, o lojista cai em "Baixar o app para Android" (R2-004) e não chega
  ao painel.
- **Estado:** CONFIRMADO (código e tela).
- **Arquivo:linha:** `apps/web/src/app/cadastro-loja/page.tsx:74-78`.
- **Reprodução:** `/cadastro-loja`, link no rodapé.
- **Esperado:** "Já tem loja? Entrar no painel" apontando para `NEXT_PUBLIC_ADMIN_URL/entrar`.
- **Observado:** `a "Entre com seu telefone" 153x17` com `href="/entrar"`.
- **Evidência:** `node j9.cjs` → `j9-01-cadastro-loja.png`.
- **Correção proposta:** trocar o texto e o href.
- **Teste de aceite:** o link aponta para o painel.

### R2-008: A landing não oferece o APK; "Baixar agora" e os selos levam a "#pedir"

- **Categoria:** Fluxo de aquisição.
- **Severidade:** Média. O único convite ao APK está em `/entrar`, e a pessoa só chega lá ao tentar
  comprar.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/components/landing/pecas.tsx:4-5,79`; `conteudo.ts:47-54`.
- **Observado:** `Baixar agora href: #pedir`. O APK existe e responde: `APK status 200
application/vnd.android.package-archive 101135`.
- **Evidência:** `node j3.cjs`, `node j1.cjs`.
- **Correção proposta:** no Android, "Baixar agora" vai para `LINK_DO_APK` com as instruções de
  instalação; no iOS, para o texto de R2-004.
- **Teste de aceite:** com o UA Android sem a marca do app, o botão aponta para `/baixar/rapidinho.apk`.

### R2-009: Troco em texto ("cinquenta", "R$ 50") gera "Expected number, received nan"

- **Categoria:** Mensagem de erro / linguagem do usuário.
- **Severidade:** Média. "R$ 50" é a forma natural de digitar. A mensagem sai em inglês técnico e não
  diz o que fazer.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/checkout/actions.ts:78-80` (`Number(...replace(',', '.'))` sem
  limpar "R$" e espaços) e `apps/web/src/lib/action.ts:17-24` (repassa a mensagem do zod).
- **Reprodução:** no checkout, escolha "Dinheiro na entrega", digite `R$ 50` no troco e toque em
  "Fazer pedido".
- **Esperado:** aceitar "R$ 50", "50,00" e "50" (como o painel faz em `centsFromForm`); se não der,
  "Digite só o valor, por exemplo 50".
- **Observado:** `troco "cinquenta" -> Expected number, received nan / Confira os campos destacados.` e
  `troco "R$ 50" -> Expected number, received nan / Confira os campos destacados.`
- **Evidência:** `node j5b.cjs` → `j5b-01-troco-texto.png`.
- **Correção proposta:** reaproveitar a lógica de `apps/admin/src/lib/admin-action.ts:100-109`
  (`centsFromForm`) e traduzir as mensagens do zod.
- **Teste de aceite:** "R$ 50" vira 5000 centavos, e texto inválido mostra uma mensagem em português.

### R2-010: A conta mostra o telefone errado: "(55) 44997-7702" em vez de "(44) 99777-0203"

- **Categoria:** Dado incorreto na tela / confiança.
- **Severidade:** Média. O cliente acha que entrou com o número errado ou que a conta não é dele.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/conta/page.tsx:33` (`maskPhoneBR(user.phone)` sobre o E.164; o
  certo é `formatPhoneBR`). O mesmo uso de `maskPhoneBR` em valor salvo aparece em
  `apps/admin/src/app/loja/configuracoes/formularios.tsx:164,175` e
  `apps/admin/src/app/loja/entregadores/equipe.tsx:157`; veja R2-028.
- **Observado:** `conta: Cliente | (55) 44997-7702 | Meus pedidos…` para a conta (44) 99777-0203.
- **Evidência:** `node j5d.cjs` → `j5c-05-conta.png`.
- **Correção proposta:** trocar por `formatPhoneBR`.
- **Teste de aceite:** `/conta` mostra "(44) 99777-0203".

### R2-011: O checkout mostra "Entrega Grátis" e o total sem frete antes de haver endereço

- **Categoria:** Estado visível / preço.
- **Severidade:** Média. A pessoa vê R$ 15,00 com "Grátis" e, depois de cadastrar o endereço, o total
  passa a R$ 20,00. Parece cobrança escondida.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/checkout/[storeId]/formulario.tsx:426-437` mostra "Grátis" com
  `deliveryFeeCents === 0`, e `apps/web/src/lib/checkout.ts:84` inicia `deliveryFeeCents = 0` sem
  endereço.
- **Observado:** sem endereço: `Subtotal R$ 15,00 | Entrega Grátis | Total R$ 15,00 | Escolha um
endereço de entrega.`; com endereço: `Entrega R$ 5,00 | Total R$ 20,00`.
- **Evidência:** `node j5.cjs` → `j5-01-checkout-sem-endereco.png`; `node j5b.cjs`.
- **Correção proposta:** sem endereço, mostrar "Entrega: calculada após o endereço" (ou a faixa da
  loja, "a partir de R$ 5,00"). Usar "Grátis" só quando a regra concede.
- **Teste de aceite:** sem endereço não aparece "Grátis" e o total diz "+ entrega".

### R2-012: Telefone com +55 (autopreenchimento ou colado) é cortado pela máscara e recusado

- **Categoria:** Entrada de dados / prevenção de erro.
- **Severidade:** Média. O Android preenche `autoComplete="tel"` com "+55…". A máscara corta em 11
  dígitos e mostra "(55) 44997-7701", e o servidor diz "Informe um telefone válido com DDD." O cliente
  vê que digitou certo e não entende.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `packages/shared/src/utils/phone.ts:55-64` (`slice(0, 11)` antes de tirar o 55);
  `apps/web/src/app/entrar/login-form.tsx:62`; o mesmo vale para o painel.
- **Observado:** `+55 colado -> (55) 44997-7701` → `Informe um telefone válido com DDD.`
- **Evidência:** `node j2.cjs` → `j2-03-mais55.png`.
- **Correção proposta:** na máscara, remover o 55 e o 0 de operadora iniciais quando houver mais de 11
  dígitos.
- **Teste de aceite:** um teste unitário em que `maskPhoneBR('+55 44 99777-0101')` resulta em
  `(44) 99777-0101`.

### R2-013: Número de 10 dígitos (celular antigo sem o 9, ou fixo) é aceito no login por SMS

- **Categoria:** Prevenção de erro.
- **Severidade:** Média. Quem digita o celular sem o nono dígito recebe a tela de código "Enviado para
  …" e espera um SMS que não chega a um fixo. Em produção, isso gasta crédito.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `packages/shared/src/utils/phone.ts:30-32` (10 dígitos válidos) e o uso em
  `requestOtpSchema` (`packages/shared/src/schemas/auth.ts:4`).
- **Observado:** `10 dig -> (44) 9977-0101` levou à tela de código com `Enviado para +554499770101`.
- **Evidência:** `node j2.cjs` → `j2-05-codigo.png`.
- **Correção proposta:** no login por SMS, exigir celular (11 dígitos com 9) e dizer "Use o número do
  celular, com o 9 na frente".
- **Teste de aceite:** "(44) 9977-0101" no login recebe uma mensagem sobre o 9 e não gera envio.

### R2-014: A tela do código não tem "Reenviar código"; recarregar volta ao telefone

- **Categoria:** Controle e liberdade do usuário.
- **Severidade:** Média. O SMS atrasa, comum no interior. A única saída é "Usar outro telefone",
  redigitar o mesmo número e pedir de novo, sem saber quanto esperar.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/entrar/login-form.tsx:84-129`.
- **Observado:** `botoes na tela de codigo: Aguarde… | Usar outro telefone`; `apos reload: Entre com seu
telefone | Seu telefone*…`. Positivo: código errado → "Código incorreto."; letras → "O código tem 6
  números."
- **Evidência:** `node j2.cjs` → `j2-05-codigo.png`, `j2-06-codigo-errado.png`.
- **Correção proposta:** botão "Reenviar código" com contagem regressiva ("Reenviar em 0:45") e guardar
  o passo em `sessionStorage`.
- **Teste de aceite:** o botão aparece depois do tempo de espera e respeita o limite.

### R2-015: "Como a loja te chama?" sem rótulo associado, e o nome não fica salvo

- **Categoria:** Acessibilidade / reconhecimento em vez de memória.
- **Severidade:** Média. O leitor de tela anuncia só "Seu nome" (placeholder). O nome digitado no pedido
  não vai para o perfil: a conta continua "Cliente", o admin lista "Sem nome", e o próximo pedido pede o
  nome de novo.
- **Estado:** CONFIRMADO (sem rótulo; conta "Cliente" e admin "Sem nome" depois de um pedido feito com o
  nome "Maria").
- **Arquivo:linha:** `apps/web/src/app/checkout/[storeId]/formulario.tsx:403-415`; em
  `apps/web/src/app/checkout/actions.ts`, nenhum `user.update` do nome (por volta da linha 240).
- **Observado:** `checkout sem rotulo: ["input[name=customerName] … ph=Seu nome"]`; depois do pedido,
  `conta: Cliente | …`; no admin, `Sem nome | (44) 99777-0203 | Cliente Ativo 1`.
- **Evidência:** `node j5.cjs`, `node j5d.cjs`, `node j7.cjs` → `j7-03-usuarios.png`.
- **Correção proposta:** `<Label htmlFor>` e salvar `user.name` no primeiro pedido.
- **Teste de aceite:** o segundo pedido não mostra o campo de nome.

### R2-016: O WebView do APK não trata download nem seleção de arquivo (receita, exportar dados)

- **Categoria:** Plataforma / impacto do "login só no app".
- **Severidade:** Alta. Como o cliente só consegue entrar pelo app, o que não funciona no WebView deixa
  de existir para ele. A foto da receita (obrigatória para remédio com receita) usa `<input type=file>`,
  que não abre sem `onShowFileChooser`. "Baixar meus dados" (portabilidade, LGPD) usa um download
  `blob:`, que não acontece sem `DownloadListener`.
- **Estado:** FORTE INDÍCIO. A leitura do código é inequívoca, mas não instalei o APK num aparelho. No
  Edge de desktop o download também não foi observado em 120 s (`download: nenhum`), o que não
  basta para concluir.
- **Arquivo:linha:** `apps/cliente-android/app/src/main/java/br/com/rapidinhoentrega/app/MainActivity.java:54`
  (`new WebChromeClient()` puro) e a ausência de `setDownloadListener`; `packages/ui/src/components/image-uploader.tsx:285`;
  `apps/web/src/app/conta/dados/painel.tsx:32-38`.
- **Reprodução segura:** instalar o APK de teste num Android, ir ao checkout de farmácia com item de
  receita e tocar em "Foto da receita"; em "Meus dados", tocar em "Baixar meus dados".
- **Esperado:** abrir a câmera/galeria e salvar o JSON.
- **Correção proposta:** implementar `onShowFileChooser` (com permissão de câmera) e um
  `DownloadListener` (ou, para o export, enviar por e-mail ou abrir em uma nova aba com URL temporária).
- **Teste de aceite:** um teste instrumentado no Android, ou manual com checklist, nos dois fluxos.

### R2-017: A busca não acha termos regionais ("xis", "coca"), embora o cardápio tenha "X-Salada" e refrigerante

- **Categoria:** Linguagem do usuário / busca.
- **Severidade:** Média. "Xis" é como se pede lanche no PR. A tela vazia sugere buscar pelo tipo de
  loja, o que não ajuda quem quer o lanche.
- **Estado:** CONFIRMADO.
- **Observado:** `BUSCA "xis": Nada encontrado para "xis". Tente outra palavra — buscar pelo tipo de
loja (mercado, farmácia) costuma achar mais.` e o mesmo para "coca". "pizza" funciona.
- **Evidência:** `node j3.cjs` → `j3-04-busca-xis.png`.
- **Correção proposta:** uma tabela de sinônimos (xis→x-, refri/coca→refrigerante, hamburguer→burger) e
  busca sem acento e por prefixo. No vazio, mostrar as lojas abertas.
- **Teste de aceite:** "xis" retorna os X-*.

### R2-018: Enter ("Ir") no campo do cupom não aplica o cupom

- **Categoria:** Expectativa de teclado móvel.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO. Com pagamento escolhido e cupom "NAOEXISTE", Enter não fez nenhum POST nem
  mostrou mensagem sobre o cupom; também não enviou o pedido por engano. O envio acidental foi
  NÃO REPRODUZIDO.
- **Arquivo:linha:** `apps/web/src/app/checkout/[storeId]/formulario.tsx:288-302`.
- **Observado:** `Enter no cupom -> url /checkout/… | POSTs: []`.
- **Evidência:** `node j5b.cjs` → `j5b-03-enter-no-cupom.png`.
- **Correção proposta:** `onKeyDown` com Enter chama `atualizarBusca('cupom', …)` e faz `preventDefault`.
- **Teste de aceite:** Enter no cupom mostra a mensagem do cupom.

### R2-019: O cliente não consegue cancelar um pedido recém-feito; não há confirmação antes de "Fazer pedido"

- **Categoria:** Controle do usuário / prevenção de erro.
- **Severidade:** Média. Um toque cria o pedido. Se errou o endereço ou a forma de pagamento, a única
  saída é o WhatsApp da loja.
- **Estado:** CONFIRMADO (a tela do pedido em "Pedido recebido" só tem "Falar com a loja" e "Meus
  pedidos").
- **Arquivo:linha:** `apps/web/src/app/pedidos/[id]/acompanhamento.tsx:410-428`.
- **Evidência:** `node j5c.cjs` → `j5c-01-pedido-acompanhamento.png`.
- **Correção proposta:** "Cancelar pedido" enquanto o status for RECEIVED (antes de a loja aceitar).
  Com isso, a confirmação prévia deixa de ser necessária.
- **Teste de aceite:** com o pedido RECEIVED, o cliente cancela e a loja vê o cancelamento.

### R2-020: Números e depoimento provisórios publicados como fato na landing

- **Categoria:** Conteúdo / confiança (o próprio código cita o CDC, art. 37).
- **Severidade:** Média.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/components/landing/conteudo.ts:19-44`, marcados como "PROVISÓRIO".
- **Observado:** "+10 mil usuários | +500 lojas parceiras | +50 mil entregas realizadas". O admin local
  mostra 12 lojas ativas e 1 cidade (`j7-01-admin-home.png`).
- **Correção proposta:** esconder até haver números apurados.
- **Teste de aceite:** a landing não exibe números sem fonte.

### R2-021: Lista de produtos do painel no celular corta o nome em cerca de 7 letras

- **Categoria:** Layout móvel (lojista).
- **Severidade:** Baixa. "Produto…", "Produto…" e "Batata i…" ficam indistinguíveis.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/admin/src/app/loja/produtos/lista-de-produtos.tsx:161-162` (`truncate`).
- **Evidência:** `node j6.cjs` → `j6-06-produtos.png`.
- **Correção proposta:** nome em duas linhas (`line-clamp-2`) e as ações abaixo ou num menu.

### R2-022: Tabela de lojas do super admin corta colunas no celular

- **Categoria:** Layout móvel (super admin).
- **Severidade:** Baixa. O selo "Aguardando aprovação" fica cortado, e Documento, Produtos e Pedidos
  ficam fora da tela.
- **Estado:** CONFIRMADO.
- **Evidência:** `node j7.cjs` → `j7-02-lojas.png`. Na lista de usuários, a tabela aparece rolada
  horizontalmente: a coluna "Ações" fica visível e a de nomes fica fora da tela, então o super admin não
  vê de quem é a engrenagem em que vai tocar (`node j7b.cjs`; não guardei a captura porque ela mostrava a
  senha provisória em claro).
- **Correção proposta:** em telas menores que `sm`, uma lista em cartões com a situação como selo em
  cima.

### R2-023: Alvos de toque abaixo de 44 px

- **Categoria:** Acessibilidade.
- **Severidade:** Baixa (mais grave nos casos já tratados em R2-002).
- **Estado:** CONFIRMADO (medida por `getBoundingClientRect`).
- **Observado:** landing: links do topo com 17 px de altura, rodapé com 15 px ("Cadastrar minha loja",
  "Seja entregador", "Acesso administrativo"); `/entrar`: "termos de uso" 81×15; vitrine: "Ver todas
  (5)" 104×20; loja: "Voltar" 40×40 e coração 40×44; produto: os radios de 24×24; pizza: "Fechar
  aviso" 28×28 (`montador.tsx:442-448`); cadastro de loja: "Minha cidade não está na lista" 175×16;
  admin: links "Ver lojas" e os da lista com 24 px de altura; filtros de usuários com 38 px.
- **Evidência:** saídas `alvos<44` de j1, j3, j4, j7, j9.

### R2-024: A tela do código mostra o telefone cru ("+554499770101")

- **Categoria:** Linguagem do usuário.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `apps/web/src/app/entrar/login-form.tsx:105` (sem `formatPhoneBR`). O placeholder
  "000000" também parece um código já preenchido (HIPÓTESE de confusão).
- **Evidência:** `j2-05-codigo.png`.

### R2-025: Usuário logado em `/entrar?destino=<URL externa>` é redirecionado sem validação

- **Categoria:** Segurança/UX (redirecionamento aberto, usado em golpe por link).
- **Severidade:** Média. Um link do domínio oficial manda o cliente logado para um site de golpe; é
  fácil de explorar por WhatsApp.
- **Estado:** CONFIRMADO.
- **Evidência:** `node j10.cjs` → `logado GET /entrar?destino=https://example.com/ -> 307 Location:
https://example.com/`.
- **Arquivo:linha:** `apps/web/src/app/entrar/page.tsx:26` (`if (user) redirect(destino ?? '/')`), ao
  contrário das actions, que validam (`entrar/actions.ts:288-291`).
- **Correção proposta:** a mesma validação `startsWith('/') && !startsWith('//')`.
- **Teste de aceite:** logado, um GET em `/entrar?destino=https://example.com/` redireciona para `/`.

### R2-026: Na exclusão de conta, a mensagem de bloqueio aparece longe do botão

- **Categoria:** Visibilidade de estado.
- **Severidade:** Baixa. A pessoa toca em "Excluir para sempre", no fim da página, e a mensagem
  aparece acima de "Levar meus dados", às vezes fora da tela.
- **Estado:** CONFIRMADO. A mensagem em si é boa: "Você tem pedidos em andamento. Aguarde a entrega para
  excluir a conta."
- **Arquivo:linha:** `apps/web/src/app/conta/dados/painel.tsx:44`.
- **Evidência:** `node j5d.cjs` → `j5c-08-apos-excluir.png`.
- **Correção proposta:** mostrar o erro dentro do cartão "Excluir minha conta", com `role="alert"`.

### R2-027: O painel de pedidos mostra "Reconectando…" sem explicar o que fazer

- **Categoria:** Estado visível (lojista).
- **Severidade:** Baixa (no local o servidor de tempo real provavelmente não estava ativo; em produção é
  HIPÓTESE).
- **Estado:** CONFIRMADO localmente.
- **Observado:** `pedidos: Supermercado Palmital | Aberta agora | Pedidos | Reconectando… | Aguardando
você | 0 | Nenhum pedido novo agora. Assim que entrar um, ele aparece aqui e o alerta toca.` Isso
  promete o alerta enquanto o canal está caído.
- **Evidência:** `node j6.cjs` → `j6-05-pedidos.png`.
- **Correção proposta:** depois de N segundos, "Sem conexão em tempo real: a tela atualiza a cada 30 s.
  Mantenha o som ligado", com atualização periódica de reserva.

### R2-028: Configurações da loja preenchem o telefone com a máscara errada sobre o E.164

- **Categoria:** Dado incorreto / risco de não conseguir salvar.
- **Severidade:** Média. O lojista vê o número da loja errado. Ao salvar qualquer configuração, o valor
  "(55) 44423-3100" (11 dígitos, terceiro dígito diferente de 9) não passa em `normalizePhoneBR`, então
  ou ele percebe e redigita os dois telefones, ou não consegue salvar.
- **Estado:** CONFIRMADO para a exibição; FORTE INDÍCIO para a falha ao salvar (não submeti, para não
  alterar a loja compartilhada).
- **Arquivo:linha:** `apps/admin/src/app/loja/configuracoes/formularios.tsx:164,175`
  (`defaultValue={maskPhoneBR(loja.phone)}`); `apps/admin/src/app/loja/entregadores/equipe.tsx:157`.
- **Observado:** `telefones em configuracoes: ["phone=(55) 44423-3100","whatsapp=(55) 44423-3100"]`
  para a loja cujo telefone o admin lista como "(44) 4233-1001".
- **Evidência:** `node j10.cjs` → `j10-01-configuracoes.png`.
- **Correção proposta:** `formatPhoneBR`.
- **Teste de aceite:** o campo mostra "(44) 4233-1001", e salvar sem mexer no telefone funciona.

### R2-029: O texto da tela de entregadores da loja ainda descreve o login antigo

- **Categoria:** Texto desatualizado pela mudança de login.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Observado:** "Ele entra com o próprio telefone, pelo mesmo código que você usa. Não precisa criar
  senha." O lojista agora entra com e-mail e senha, e o entregador só entra por SMS dentro do app.
- **Evidência:** `node j10.cjs` → `j10-02-entregadores.png`.
- **Correção proposta:** "Ele entra pelo app Rapidinho com o próprio telefone (código por SMS)."

### R2-030: Trocar a senha não desconecta as outras sessões

- **Categoria:** Segurança percebida (o lojista troca a senha porque desconfia de vazamento).
- **Severidade:** Baixa para UX. Pode ser maior na visão de segurança (R1).
- **Estado:** FORTE INDÍCIO (código; não abri duas sessões para comprovar).
- **Arquivo:linha:** `apps/admin/src/lib/trocar-senha.ts:63-66`, que só faz `user.update`. Compare com
  `apps/admin/src/app/admin/usuarios/actions.ts:225`, onde a senha provisória chama `revokeAllSessions`.
- **Correção proposta:** encerrar as outras sessões ao trocar a senha e informar: "Senha trocada. Saímos
  dos outros aparelhos."
- **Teste de aceite:** com duas sessões abertas, a troca na sessão A derruba a sessão B.

---

## 4. O que foi inspecionado, testado e não testado

### Inspecionado (código)

- Site: `entrar/*`, `cadastro-loja/*`, `checkout/*`, `carrinho/actions.ts`, `[cidade]/produto/[id]/formulario.tsx`,
  `[cidade]/pizza/[loja]/montador.tsx` (barra fixa), `conta/*`, `conta/dados/*`, `pedidos/[id]/*`,
  `enderecos/novo/formulario.tsx`, `entregador/page.tsx`, landing (`components/landing/*`), `lib/action.ts`,
  `lib/checkout.ts`.
- Painel: `entrar/*`, `admin/usuarios/*`, `admin/lojas/[id]/acoes-da-loja.tsx`, `loja/senha/page.tsx`,
  `lib/trocar-senha.ts`, `lib/admin-action.ts`, `loja/produtos/*`, `loja/pedidos/painel-de-pedidos.tsx`, `entregador/painel.tsx`.
- Shared: `utils/phone.ts`, `utils/app-nativo.ts`, `schemas/common.ts`; auth `senha.ts`.
- APK: `MainActivity.java`, `AndroidManifest.xml`, `build.gradle`.

### Testado (comando → resultado resumido)

- `node j1.cjs`: landing fora do app, `/entrar` fora do app, APK (200, 101 KB), iPhone em `/entrar` e `/pedidos`.
- `node j2.cjs`: telefone vazio ("Preencha este campo."), sem DDD, letras (o campo descarta), +55 colado,
  10 dígitos, código curto, código com letras, código errado, código antigo, recarregar, duplo clique em "Entrar".
- `node j3.cjs`: app em `/`, troca de cidade, vitrine, busca ("pizza", "xis", "coca", "zzzz", vazia, `<script>` sem efeito), loja, pizzaria.
- `node j4.cjs` e `node dbg.cjs`: produto com grupo obrigatório, duplo clique em "Adicionar" (1 item), açaí, carrinho de 2 lojas.
- `node j5.cjs`, `j5b.cjs`, `j5c.cjs`, `j5d.cjs`: checkout sem endereço, cadastro de endereço (vazio → validação nativa; CEP opcional), troco inválido, Enter no cupom, duplo clique em "Fazer pedido" (1 POST, pedido criado), voltar depois do pedido (vai ao carrinho), meus pedidos, favoritos (vazio → cheio), conta, exportar, excluir com pedido aberto.
- `node j6.cjs`: login do painel (senha errada, telefone no campo de e-mail, e-mail com maiúsculas e espaço aceito), pedidos, produtos (cadastro vazio → validação; preço "abc" fica no campo), minha senha.
- `node j7.cjs` e `j7b.cjs`: super admin (home, lojas, usuários, senha provisória e uso dela).
- `node j8.cjs`: entregador pelo site e pelo painel com o UA do app; cliente comum no painel ("Este número não é de entregador cadastrado. Lojista e equipe entram com e-mail e senha.").
- `node j9.cjs`: cadastro de loja vazio, com CPF inválido, com senhas diferentes.
- `node j10.cjs`: telefones nas configurações, open redirect.
- `node j11.cjs`: 360 px com 3G simulado, pizza, fonte em 200 %, tablet.

### Não testado

- Avaliar pedido: exige um pedido ENTREGUE de uma loja que eu operasse; o pedido criado foi para o Açaí
  do Parque, cujo dono não tem senha no seed. Inspecionei só o código (`avaliar/formulario.tsx`: botão
  desabilitado sem nota, estrelas com `aria-label`).
- Operar pedidos no painel (aceitar, recusar com motivo): a loja do lojista do e2e não tinha pedido
  aberto. Só inspecionei o código (`BotaoRecusar` exige motivo com 3 ou mais caracteres).
- Aprovar loja: a única pendente era de outro revisor, e não quis mexer no estado dele. O cadastro que
  eu criaria falhou (R2-003). A confirmação "Aprovar {loja}?" existe no código.
- Pix e cartão online, OTP expirado (TTL real), loja fechada de verdade (o seed e2e deixa todas abertas
  24 h) e produto que fica indisponível com item no carrinho: verificados só pela mensagem no código
  ("Há itens indisponíveis no carrinho. Remova-os para continuar.").
- O APK num aparelho real (R2-001 e R2-016 dependem disso para virar CONFIRMADO).
- Contraste medido por ferramenta: só avaliação visual das capturas. Os textos `text-muted-foreground`
  em cinza sobre fundo claro parecem limítrofes, sem medição.

---

## 5. Oportunidades (ELIMINAR → JUNTAR → AUTOMATIZAR → ANTECIPAR → CRIAR)

**Fundamentadas** (com base no que observei):

| Ordem | Tipo        | Oportunidade                                                                                                                                                                        | Problema observado                                         | Antes → depois             | Impacto | Esforço | Justificativa                                    |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- | ------- | ------- | ------------------------------------------------ |
| 1     | ELIMINAR    | Tirar a landing de dentro do app (R2-001)                                                                                                                                           | O app abre e volta para a propaganda                       | 2 passos → 0 até a vitrine | Alto    | P       | Um `redirect` por UA, e afeta todas as aberturas |
| 2     | ELIMINAR    | Linha inteira clicável nas opções (R2-002)                                                                                                                                          | Toque no nome não marca                                    | Toques falhos → 1 toque    | Alto    | P       | Troca de `li` por `label`                        |
| 3     | ELIMINAR    | Não apagar o cadastro de loja em erro (R2-003)                                                                                                                                      | 13 campos perdidos                                         | 13 campos → 1              | Alto    | P       | Devolver os valores no estado                    |
| 4     | JUNTAR      | Salvar o nome no perfil no primeiro pedido (R2-015)                                                                                                                                 | O nome é pedido a cada pedido                              | 1 campo por pedido → 0     | Médio   | P       | Um `update` na action                            |
| 5     | AUTOMATIZAR | "Pedir acesso / esqueci a senha" com WhatsApp do suporte já preenchido ("Sou lojista da loja X, e-mail Y") e, no admin, um botão "Enviar pelo WhatsApp" ao gerar a senha provisória | Lojista sem senha preso; o super admin copia a senha à mão | Telefonema → 2 toques      | Alto    | P/M     | Mitiga R2-005 sem e-mail transacional            |
| 6     | AUTOMATIZAR | Interpretar o troco como o painel faz ("R$ 50", "50,00") (R2-009)                                                                                                                   | Erro em inglês                                             | Erro → aceito              | Médio   | P       | `centsFromForm` já existe                        |
| 7     | ANTECIPAR   | Mostrar o frete da loja antes do endereço ("a partir de R$ 5,00") (R2-011)                                                                                                          | "Grátis" que vira R$ 5                                     | Surpresa → nenhuma         | Médio   | P       | O dado já existe na loja                         |
| 8     | ANTECIPAR   | Avisar lojistas e funcionários antigos antes do deploy do novo login e gerar as senhas em lote                                                                                      | Gerente e Operador do seed sem e-mail/senha                | Bloqueio → acesso no dia 1 | Alto    | M       | Evita a avalanche no suporte                     |
| 9     | ANTECIPAR   | Para iPhone, uma saída honesta (pedir pelo WhatsApp da loja e lista de espera) (R2-004)                                                                                             | Beco sem saída                                             | 0 pedidos → algum          | Alto    | P/M     | A loja já tem WhatsApp na vitrine                |
| 10    | CRIAR       | Cancelar pedido enquanto estiver "Pedido recebido" (R2-019)                                                                                                                         | Sem desfazer                                               | WhatsApp → 1 toque         | Médio   | M       | Regra simples por status                         |
| 11    | CRIAR       | Sinônimos regionais na busca (R2-017)                                                                                                                                               | "xis" vazio                                                | 0 resultados → lista       | Médio   | P/M     | Tabela pequena                                   |
| 12    | JUNTAR      | Link "Sou entregador" no `/conta` do app, levando ao painel (R2-006)                                                                                                                | Entregador perdido                                         | Sem caminho → 1 toque      | Alto    | P       | Corrige o fluxo inteiro do entregador            |

**Hipóteses** (não validadas com usuário):

- H1. Unificar endereço e checkout numa tela só: os 4 campos de endereço dentro do cartão "Onde
  entregar" quando não há endereço, em vez de ir para outra página e voltar. Antes: 7 passos e 2 trocas
  de tela; depois: 5 passos e 0 trocas. Estrutura proposta: [Receber em casa | Retirar] → Onde entregar
  (Rua, Número, Bairro com lista, Referência*) → Como pagar → Troco (atalhos) → Nome (só no primeiro
  pedido) → barra fixa com total e "Fazer pedido". Esforço M. Risco: validação do endereço dentro da
  action do pedido.
- H2. Login por SMS no navegador para iPhone, com limite agressivo por telefone e IP e captcha. Custo de
  SMS contra vendas perdidas; decisão do dono.
- H3. Forçar a troca da senha provisória no primeiro acesso: hoje a pessoa pode seguir com ela para
  sempre.
- H4. Placeholder "000000" no código pode parecer já preenchido; trocar por "Digite os 6 números".

---

## 6. Limitações

- O ambiente local ficou instável: em vários momentos os dois servidores Next (dev) deixaram de
  responder por minutos (`curl /api/health` → 000 com timeout de 60 s), com memória livre perto de
  400 MB de 20 GB. Os scripts tiveram de ser repetidos com timeouts maiores, e algumas jornadas ficaram
  curtas ou viraram "Não testado".
- Os tempos medidos (por exemplo, a home em 5,5 s) refletem o servidor de desenvolvimento local e não
  servem como métrica de desempenho de produção.
- Não abri o APK num aparelho; o comportamento do WebView foi inferido do código.
- Não fiz nenhuma chamada à produção.
- Os dados criados localmente: pedido #02116242 (Açaí do Parque, cliente (44) 99777-0203), endereço
  "Rua das Flores, 123", um favorito, o produto "Teste R2 pastel" (R$ 12,50) no Supermercado Palmital, e a senha provisória e a troca de senha do "Gerente do e2e" (e-mail
  `gerente.r2@e2e.rapidinho.test`).

---

## 7. Parecer

**Aprovado com ressalvas, condicionado às correções de prioridade alta.** A compra principal funciona e
resiste a duplo clique. Antes de tratar a mudança de login como pronta para o público, porém, é preciso
corrigir:

1. R2-001: o app abre na landing.
2. R2-002: opção só no círculo.
3. R2-003: o cadastro de loja apaga os campos.
4. R2-004, R2-005, R2-006 e R2-007: saídas para iPhone, lojista sem senha e entregador.
5. R2-016: o upload e o download no WebView, a validar num aparelho.

Os achados médios (R2-009 a R2-015, R2-017, R2-019, R2-020, R2-025, R2-028) são correções pequenas,
quase todas de esforço P, e tiram pontos de confusão diários do cliente leigo.
