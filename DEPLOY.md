# Deploy em produção

A aplicação roda na VPS **72.60.10.108**, que é compartilhada com outros sites.
Por isso o deploy só adiciona: nunca mexe em pacote, container ou site de
terceiros.

## Arquitetura de portas

```
internet
   │  443 (TLS)
   ▼
Nginx do HOST  ──── termina o TLS, um bloco por domínio
   │  proxy_pass 127.0.0.1:DEPLOY_PORT   ← única porta da aplicação
   ▼
Nginx do CONTAINER  ──── roteia por Host
   ├── rapidinhoentrega.com.br        → web:3000    (app do cliente)
   ├── www.rapidinhoentrega.com.br    → web:3000
   └── painel.rapidinhoentrega.com.br → admin:3001  (painel)
```

`DEPLOY_PORT` é escolhida **uma vez**, no primeiro deploy, entre 3100 e 3199 —
o script pula portas já em escuta e portas que outros sites reservaram em
`proxy_pass` no nginx. A escolha fica gravada em `/opt/rapidinho/.env` e é
reaproveitada nos deploys seguintes.

O Nginx do container escuta em `127.0.0.1:DEPLOY_PORT`, nunca em `0.0.0.0`:
assim ninguém alcança a aplicação pela porta numérica contornando o
certificado. Postgres, Redis e MinIO não publicam porta nenhuma no host.

O painel usa **subdomínio**, não caminho. Servir o painel em `/painel` daria
404 em toda navegação interna, porque o Next gera os links a partir da raiz.

## Antes do primeiro deploy

1. **Criar os secrets no GitHub**
   `Settings → Secrets and variables → Actions → New repository secret`

   | Secret              | Obrigatório | Para quê                           |
   | ------------------- | ----------- | ---------------------------------- |
   | `VPS_PASSWORD`      | sim         | senha de root da VPS               |
   | `SUPER_ADMIN_PHONE` | sim         | telefone do primeiro administrador |
   | `SENTRY_DSN`        | não         | monitoramento de erro              |

   Nenhum deles entra no repositório.

   Sem `SUPER_ADMIN_PHONE` o seed não cria administrador nenhum — e é assim de
   propósito: cair para um número fixo daria acesso ao painel a quem soubesse
   o número. Sem `SENTRY_DSN` o erro vai só para o log estruturado, que já
   basta numa operação de uma cidade.

2. **Criar o registro DNS do painel**

   | Tipo | Nome     | Valor          |
   | ---- | -------- | -------------- |
   | A    | `painel` | `72.60.10.108` |

   `rapidinhoentrega.com.br` e `www` já apontam para a VPS. Sem o registro do
   painel o deploy funciona igual — o certificado sai só para os domínios que
   resolvem, e o painel entra quando o DNS existir (o deploy amplia o
   certificado sozinho no run seguinte).

3. **Conferir a VPS** (opcional, mas recomendado)

   ```bash
   pip install paramiko
   VPS_PASSWORD='...' python3 scripts/analisar-vps.py
   ```

   Mostra o que já roda no servidor e qual porta seria escolhida. É só leitura.

## Rodando o deploy

Automático a cada push na `main`, ou manualmente em
`Actions → Deploy Production → Run workflow`.

O workflow tem dois jobs. O segundo só roda se o primeiro passar:

1. **verificar** — formatação, lint, tipos, testes, migrations e seed
2. **deploy** — envia o código, sobe, configura o Nginx e emite o certificado

Passo a passo do deploy:

| Etapa                              | Onde roda  | O que faz                                                              |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Preparar o ambiente                | VPS        | Instala Docker, Nginx, certbot e utilitários que faltarem              |
| **Construir as imagens**           | **runner** | `compose build` das cinco imagens, com as URLs públicas                |
| **Enviar as imagens**              | runner→VPS | `docker save \| zstd \| ssh \| docker load`, sem arquivo intermediário |
| Enviar o código                    | VPS        | `tar` da árvore para `/opt/rapidinho/releases/<versão>`                |
| Escolher a porta e montar o `.env` | VPS        | Fixa `DEPLOY_PORT` e gera os segredos na primeira vez                  |
| Subir a aplicação                  | VPS        | Confere as imagens, migrations, `up -d` e espera responder             |
| Nginx (HTTP)                       | VPS        | Serve a aplicação e o desafio do Let's Encrypt                         |
| Emitir SSL                         | VPS        | Certificado para os domínios que apontam para a VPS                    |
| Nginx (HTTPS)                      | VPS        | Redireciona 80 → 443 e termina o TLS                                   |
| Conferir                           | VPS        | Loopback, domínio público e os cabeçalhos de segurança                 |

### Por que a VPS não constrói

Ela não dá conta. O deploy #21 mediu a máquina antes de começar:

```
load average: 243.67, 245.10, 247.30
Mem: 15988 total, 494 free | Swap: 2757 de 4095 em uso
```

Carga 243 já nos quinze minutos anteriores, portanto não causada pelo deploy.
Nesse estado ela não termina um `next build` nem completa um handshake TLS com
o Docker Hub — os deploys #20 e #21 morreram exatamente assim, um por tempo e
outro por rede.

A imagem passa a ser construída no runner do GitHub, que tem CPU e rede de
sobra, e chega pronta. A VPS só descomprime, carrega e sobe. Se as imagens não
chegarem, o deploy falha dizendo quais faltaram, em vez de tentar construir.

## Segurança do deploy

- O link `current` só troca **depois** que a aplicação responde. Se o build,
  a migration ou o healthcheck falharem, a versão anterior continua no ar.
- Se a configuração gerada não passar no `nginx -t`, a anterior é restaurada e
  recarregada — um reload recusado derrubaria os outros sites da VPS.
- O certbot **espera** o lock em vez de matar o processo: a VPS renova
  certificados de dezenas de domínios e matar o certbot abortaria a renovação
  dos vizinhos.
- Segredos gerados (`AUTH_SECRET`, senha do Postgres, do MinIO) nunca são
  regerados. Trocar o `AUTH_SECRET` desconectaria todos os usuários; trocar a
  senha do Postgres deixaria o banco inacessível, porque o Postgres só aplica
  `POSTGRES_PASSWORD` no primeiro boot.
- As 5 últimas releases ficam em `/opt/rapidinho/releases` para rollback.

## Provedores externos

O `.env` da VPS nasce com os provedores em modo local:

```
PAYMENT_PROVIDER=fake
WHATSAPP_PROVIDER=fake
OTP_PROVIDER=whatsapp
```

Para ligar de verdade, edite `/opt/rapidinho/.env` na VPS e reinicie:

```bash
cd /opt/rapidinho/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Os deploys seguintes preservam o que você escreveu ali.

> Atenção: com `NODE_ENV=production`, `OTP_PROVIDER=console` faz a aplicação
> recusar subir — é proposital, senão o código de acesso ficaria só no log e
> ninguém conseguiria entrar.

## Operação no dia a dia

```bash
# Estado dos containers
cd /opt/rapidinho/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Logs da aplicação
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f web admin

# Rollback para a release anterior
ls -1t /opt/rapidinho/releases | head -5
ln -sfn /opt/rapidinho/releases/<versão> /opt/rapidinho/current
cd /opt/rapidinho/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Backup do banco
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  pg_dump -U rapidinho rapidinho > /backup/rapidinho-$(date +%F).sql
```

Sempre passe os **dois** arquivos com `-f`. Sem isso o Compose carrega o
`docker-compose.override.yml` de desenvolvimento, que publica Postgres, Redis e
MinIO no host — algo que não deve acontecer em produção.
