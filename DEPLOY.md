# Deploy em produção

A aplicação é executada na VPS `72.60.10.108`. O GitHub Actions compila as imagens e publica cada serviço no GitHub Container Registry (GHCR). A VPS recebe apenas os arquivos operacionais da release, autentica no GHCR, baixa as imagens e executa migrations, seed e Compose. Nenhum build de aplicação acontece na VPS.

## Configuração inicial

1. Crie os secrets do repositório:

   | Secret              | Obrigatório | Uso                                |
   | ------------------- | ----------- | ---------------------------------- |
   | `VPS_PASSWORD`      | Sim         | Acesso SSH à VPS                   |
   | `SUPER_ADMIN_PHONE` | Sim         | Telefone do primeiro administrador |
   | `SENTRY_DSN`        | Não         | Monitoramento de erros             |

   Não há token do GHCR para configurar: o job de deploy baixa as imagens com o `GITHUB_TOKEN` do próprio job (`packages: read`), que expira quando ele termina.

2. Os pacotes ficam em `ghcr.io/<owner>/rapidinho-{web,admin,realtime,worker,migrate,nginx}`, vinculados a este repositório pelos builds.

3. Configure DNS para `rapidinhoentrega.com.br`, `www.rapidinhoentrega.com.br` e `painel.rapidinhoentrega.com.br` apontando para a VPS.

## Pipeline

O workflow `.github/workflows/deploy.yml` executa validação e, após sucesso, seis jobs de build independentes em paralelo: `build-web`, `build-admin`, `build-realtime`, `build-worker`, `build-migrate` e `build-nginx`. Cada job publica uma imagem com a tag imutável do commit (`github.sha`) e usa cache BuildKit do GitHub Actions.

O job `deploy` só começa depois que os cinco builds concluem. Ele envia os arquivos Compose, scripts operacionais e configuração Nginx; não envia código-fonte nem arquivos de imagem. Na VPS, a release:

1. faz login no GHCR com o `GITHUB_TOKEN` do job, passado por stdin, numa pasta de credenciais só desta aplicação (`$APP_ROOT/.docker-ghcr`) — a VPS é compartilhada e o `~/.docker` do root guarda o login GHCR de outros projetos, que um login/logout global apagaria;
2. baixa as seis imagens da mesma tag SHA;
3. inicia Postgres, Redis e MinIO;
4. aplica migrations e seed essencial pela imagem `migrate`;
5. inicia os serviços e verifica healthcheck HTTP;
6. aponta `current` para a release e grava a tag no `.env`;
7. apaga a pasta de credenciais do GHCR, mesmo em caso de falha.

Use `docker-compose.yml` junto com `docker-compose.prod.yml` em produção. Não inclua `docker-compose.override.yml`, que publica portas de desenvolvimento.

## Deploy manual

O deploy ocorre automaticamente em push para `main` ou pode ser iniciado em `Actions → Deploy Production → Run workflow`. Uma execução manual também exige que as imagens correspondentes ao SHA estejam publicadas no GHCR.

## Rollback

As cinco releases mais recentes são mantidas em `/opt/rapidinho/releases`. Para voltar à release anterior, aponte `current` para o diretório desejado, atualize `RELEASE_TAG` em `/opt/rapidinho/.env` para o SHA dessa release e então execute:

```bash
cd /opt/rapidinho/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

O rollback de código não desfaz migrations incompatíveis. Migrations devem permanecer compatíveis com a versão anterior durante a janela de rollback.

## Operação

```bash
cd /opt/rapidinho/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f web admin
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  pg_dump -U rapidinho rapidinho > /opt/rapidinho/backups/rapidinho-$(date +%F).sql
```

O deploy não coleta métricas ou informações de capacidade da VPS. A verificação final é funcional: containers e endpoints de saúde.
