# Publicar o app no iPhone (App Store)

O app do iPhone é o mesmo código do Android. Só que ele precisa ser compilado
num Mac, então a compilação roda na nuvem da Expo (EAS), que entrega o
arquivo direto no App Store Connect. Os passos 1 a 4 são feitos uma vez só.

## 1. Apple: criar o app e a chave de notificação

1. Em <https://developer.apple.com/account/resources/authkeys/list>, clique
   em **+**, marque **Apple Push Notifications service (APNs)** e baixe a chave
   (`.p8`). Guarde em `C:\Users\fusea\.rapidinho-contas\` e anote o **Key ID**
   e o **Team ID** (aparece no canto de cima da página). O `.p8` só baixa uma
   vez e **nunca** vai para o repositório.
2. Em <https://appstoreconnect.apple.com>, vá em **Apps > + > Novo app**:
   - Plataforma: iOS
   - Nome: Rapidinho Entrega
   - Idioma: Português (Brasil)
   - ID do pacote (Bundle ID): `br.com.rapidinhoentrega.app`. Se ele não
     aparecer na lista, faça antes o passo 4, que cria o ID, e volte aqui.
   - SKU: `rapidinho`
3. Abra o app criado, vá em **Informações do app** e copie o **ID Apple**
   (um número de 10 dígitos). Ele entra no `eas.json`, no lugar de
   `PREENCHER_COM_O_APPLE_ID_DO_APP`.

## 2. Firebase: registrar o app do iPhone (login por SMS)

1. No console do Firebase do projeto do Rapidinho, vá em **Configurações do
   projeto > Seus apps > Adicionar app > iOS**, com o pacote
   `br.com.rapidinhoentrega.app`.
2. Baixe o `GoogleService-Info.plist` e salve em
   `C:\Users\fusea\.rapidinho-contas\GoogleService-Info.plist`.
3. Na aba **Cloud Messaging**, em **Configuração do app Apple**, envie a chave
   APNs (`.p8`) do passo 1, com o Key ID e o Team ID. Sem ela, o login por SMS
   no iPhone cai num captcha antes de mandar o código.

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
