# Publicar o app no iPhone (App Store)

O app do iPhone é o mesmo código do Android. Ele é compilado no macOS do
GitHub Actions, como os outros apps da conta, e enviado direto ao TestFlight
pela chave da API do App Store Connect. Nada de Expo/EAS.

## Como gerar uma versão

GitHub > Actions > **App iOS** > **Run workflow**. Em 30 a 60 minutos o build
aparece no TestFlight. A versão vem de `expo.version` no `app.json` (a mesma do
Android); o número do build é o da execução, sempre crescente.

## O que já está configurado (2026-11-15)

- **Conta Apple:** time `P8XTL43RG6` (Fuse Agencia LTDA).
- **App:** "Rapidinho Entrega", ID Apple `6835245037`, pacote
  `br.com.rapidinhoentrega.app` (registrado pela API, com notificações).
- **Firebase:** app iOS no mesmo projeto `rapidinho-entrega` do Android, com a
  chave APNs `LG4UHJ43LY` enviada (desenvolvimento e produção).
- **Secrets do GitHub:** `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`,
  `APPSTORE_API_KEY_P8`, `APPLE_TEAM_ID`, `GOOGLE_SERVICE_INFO_PLIST_B64`.
  Os originais ficam em `C:\Users\fusea\.rapidinho-contas\` (IDs em
  `apple.env`), nunca no repositório.
- **Ícone:** `assets/marca/icone-ios.png`, 1024 × 1024 sem transparência.

## Ficha da loja (App Store Connect)

- **Capturas:** iPhone 6,9" (1320 × 2868) ou 6,5" (1284 × 2778), tiradas no
  iPhone pelo TestFlight. As do Android não servem.
- **Política de privacidade:** `https://rapidinhoentrega.com.br/privacidade`
- **Suporte:** `https://rapidinhoentrega.com.br`
- **Privacidade do app** (feita à mão no console): telefone, nome, endereço,
  localização (só com o app em uso) e histórico de pedidos, ligados à conta e
  sem rastreamento.
- **Conta de revisão:** a mesma da Play (`.rapidinho-contas\revisao-play.txt`);
  na nota ao revisor, explicar que o login é por SMS e que essa conta entra com
  código fixo.
- **Exclusão de conta:** Conta > Excluir minha conta.
