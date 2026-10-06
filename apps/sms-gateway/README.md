# Rapidinho SMS — gateway de confirmação por SMS

App Android para o celular da operação. O cliente confirma o número **enviando**
um SMS do celular dele para este celular; o app repassa o SMS ao servidor, que
confere o remetente e o código e libera o login. A plataforma não paga envio de
SMS: o cliente gasta um SMS comum do plano dele.

## Como funciona

1. O cliente digita o telefone no app (ou no painel) e toca em **Continuar**.
2. A tela mostra **Enviar SMS de confirmação**. O botão abre o app de mensagens
   com o número da operação e o texto `Rapidinho 123456` já preenchidos.
3. Este app recebe o SMS e o repassa para `POST /api/sms/recebido`, com o token.
4. O servidor confere duas coisas: o **remetente** do SMS é o número que pediu o
   login, e o código é o daquele pedido. A tela do cliente entra sozinha, em
   cerca de 2 segundos.

O código aparece na tela, então não é segredo, e por isso não vale digitado. A
prova de posse do número é o remetente, informado pela operadora. Um segundo
segredo, guardado num cookie do navegador que pediu o login, garante que só
esse navegador entra.

## Privacidade no celular

O app só repassa SMS com cara de confirmação. As três condições abaixo
precisam valer ao mesmo tempo:

- o remetente é um celular brasileiro (SMS de banco e operadora vêm de números
  curtos e ficam de fora);
- o texto tem até 80 caracteres;
- o texto tem um código de 6 dígitos.

Recados pessoais ficam no aparelho. O servidor também não grava o texto no log.

## Instalar e configurar

O app já vem apontando para `https://rapidinhoentrega.com.br`.

1. Instale o APK no celular do número da operação. Em aparelhos recentes no
   Brasil, a permissão de SMS fica bloqueada para APK instalado pelo próprio
   celular; instale pelo computador (`adb install`), que não tem essa trava.
2. Abra o app e entre com o e-mail e a senha do app gateway. O app recebe o
   token do servidor; a senha não fica guardada no celular.
3. Toque em **Permitir receber SMS** e em **Tirar da economia de bateria**. Os
   três itens precisam ficar verdes. Em Xiaomi, ligue também o **Início
   automático** e deixe a bateria do app **Sem restrições**.

O link **Configurar o app neste celular** da página **Login por SMS** do painel
continua funcionando como alternativa ao login.

Deixe o celular ligado, com chip ativo e internet. O app manda sinal de vida a
cada 15 minutos, e o painel avisa quando o celular some.

## Ligar em produção

1. No GitHub, em **Settings → Secrets and variables → Actions**, crie:
   - `SMS_GATEWAY_NUMBER`: o número deste celular, por exemplo `44999998888`;
   - `SMS_APP_SENHA`: a senha do login do app.
2. Faça um deploy. O script `preparar-env.sh` gera `SMS_GATEWAY_TOKEN` uma única
   vez (sem regerar depois), muda `OTP_PROVIDER` para `sms-reverso` e grava o
   SHA-256 da senha em `SMS_APP_SENHA_SHA256`. O e-mail do app fica em
   `SMS_APP_EMAIL` no `.env` da VPS.
3. Siga "Instalar e configurar" acima.

Para trocar a senha, mude o secret e faça um deploy. Para desligar o login por
SMS, apague `SMS_GATEWAY_NUMBER` e troque `OTP_PROVIDER` no `.env` da VPS.

## Compilar

Requisitos: o JDK do Android Studio e o Android SDK com a plataforma 35.

```bash
cd apps/sms-gateway
echo "sdk.dir=C:/Users/<você>/AppData/Local/Android/Sdk" > local.properties
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

O APK é assinado com a chave de depuração da máquina que compila. Uma
atualização só instala por cima se for compilada na mesma máquina; em outra,
desinstale o app antes de instalar a nova versão.

## Se o login parar

- **Painel mostra "sem sinal":** o celular está desligado, sem internet ou o app
  foi encerrado à força. Abra o app uma vez.
- **"Acesso expirou" no app:** o token mudou no servidor; entre de novo.
- **"O servidor respondeu 404/500" ao entrar:** o login do app não está ligado;
  confira o secret `SMS_APP_SENHA` e faça um deploy.
- **SMS chegou e nada aconteceu:** veja "Últimos acontecimentos" no app. Se
  aparecer "guardado para reenviar", faltou internet, e o app reenvia sozinho
  quando a conexão volta.
