# Publicar o app no iPhone (App Store)

O app do iPhone é o mesmo código do Android. Só que ele precisa ser compilado
num Mac, então a compilação roda na nuvem da Expo (EAS), que entrega o
arquivo direto no App Store Connect. Os passos 1 a 4 são feitos uma vez só.

## Já feito (2026-11-15)

- **Conta Apple:** time `P8XTL43RG6` (Fuse Agencia LTDA). Chave da API do App
  Store Connect `TP5NTH496M` e chave APNs `LG4UHJ43LY` em
  `C:\Users\fusea\.rapidinho-contas\` (IDs em `apple.env`), fora do repositório.
- **Bundle ID** `br.com.rapidinhoentrega.app` registrado pela API, com
  notificações ligadas.
- **Firebase:** app iOS registrado no mesmo projeto `rapidinho-entrega` do
  Android (`1:542492977454:ios:dfada2802dce85c303f2bf`) e
  `GoogleService-Info.plist` salvo em `.rapidinho-contas`. O login por SMS usa o
  captcha pelo "Encoded App ID" quando a notificação silenciosa falhar.

## 1. Apple: criar o app

A Apple não deixa criar o app pela API. Em <https://appstoreconnect.apple.com>,
**Apps > + > Novo app**: iOS, nome "Rapidinho Entrega", Português (Brasil),
pacote `br.com.rapidinhoentrega.app`, SKU `rapidinho`. Depois, em
**Informações do app**, copie o **ID Apple** (10 dígitos) para o `eas.json`.

## 2. Firebase: enviar a chave APNs

Só pelo console (a API não aceita): **Configurações do projeto > Cloud
Messaging > Configuração do app Apple > Chave de autenticação de APNs**, envie
`AuthKey_LG4UHJ43LY.p8` com Key ID `LG4UHJ43LY` e Team ID `P8XTL43RG6`.

## 3. Expo: conta e ligação do projeto

No terminal, dentro de `C:\FuseDev\rapidinho-entrega\apps\mobile`:

```
npx eas-cli login
npx eas-cli init
npx eas-cli env:create --name GOOGLE_SERVICE_INFO_PLIST --type file --value C:\Users\fusea\.rapidinho-contas\GoogleService-Info.plist --environment production --visibility secret
```

O `init` grava o ID do projeto no `app.json`; esse arquivo vai para o
repositório.

## 4. Compilar e enviar

```
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production --latest
```

Na primeira compilação, a Expo pede o login da Apple (com o código de
verificação) e cria sozinha o certificado e o perfil de distribuição. Em
cerca de 20 minutos, o build aparece no **TestFlight**, onde dá para instalar
no seu iPhone antes de mandar para revisão.

A cada versão nova, suba o `buildNumber` em `app.json` (`ios.buildNumber`) e
repita o passo 4.

## 5. Ficha da loja (App Store Connect)

- **Capturas de tela:** iPhone de 6,9" (1320 × 2868) ou 6,5" (1284 × 2778).
  Tire no próprio iPhone pelo TestFlight. As capturas do Android não servem,
  porque a Apple recusa barra de status e botões do Android.
- **Política de privacidade:** `https://rapidinhoentrega.com.br/privacidade`
- **Suporte:** `https://rapidinhoentrega.com.br`
- **Privacidade do app:** declare telefone, nome, endereço, localização (só
  com o app em uso) e histórico de pedidos, todos ligados à conta e sem
  rastreamento para anúncios.
- **Conta de revisão:** a mesma usada na Play (em
  `C:\Users\fusea\.rapidinho-contas\revisao-play.txt`). Explique na nota para
  o revisor que o login é por SMS e que essa conta entra com código fixo.
- **Exclusão de conta:** já existe em Conta > Excluir minha conta, como a
  Apple exige.
