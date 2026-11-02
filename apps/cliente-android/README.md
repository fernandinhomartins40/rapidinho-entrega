# Rapidinho — app Android do cliente

App nativo que abre o site do Rapidinho numa tela própria (WebView). É por ele
que cliente e entregador entram: o login por SMS só existe dentro do app, e o
app guarda a sessão, então a pessoa confirma o número uma vez e continua
conectada, como no WhatsApp.

O app se identifica acrescentando `RapidinhoApp/<versão>` ao user agent
(`estaNoAppNativo` em `@rapidinho/shared`). Fora dele, a tela de login do site
mostra o botão para baixar o APK.

## Gerar o APK

```bash
cd apps/cliente-android
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../web/public/baixar/rapidinho.apk
```

O site serve o arquivo em `/baixar/rapidinho.apk`. Para apontar para outro
servidor num teste: `./gradlew assembleRelease -PsiteUrl=https://outro.endereco`.

A cada versão nova, suba `versionCode` e `versionName` em `app/build.gradle`:
o Android só instala por cima de uma versão menor.

## Assinatura

Por enquanto o APK é assinado com a chave de depuração da máquina que compila.
Isso basta para instalar à mão, mas um APK compilado em outra máquina não
instala por cima deste (o celular pede para desinstalar antes). Para a Play
Store, gere uma chave própria e guarde fora do repositório.
