#!/usr/bin/env python3
"""
Análise somente-leitura da VPS antes do deploy.

Mostra o que já roda no servidor e qual porta está livre para o Rapidinho.
Não altera nada — pode rodar quantas vezes quiser.

Uso:
    pip install paramiko
    VPS_PASSWORD='...' python3 scripts/analisar-vps.py

A senha nunca fica no arquivo: vem da variável de ambiente.
"""

from __future__ import annotations

import os
import sys

try:
    import paramiko
except ImportError:  # pragma: no cover - orientação ao operador
    print("Instale o paramiko primeiro:  pip install paramiko", file=sys.stderr)
    sys.exit(1)

HOST = os.environ.get("VPS_HOST", "rapidinhoentrega.com.br")
USUARIO = os.environ.get("VPS_USER", "root")
SENHA = os.environ.get("VPS_PASSWORD")

# Faixa em que procuramos porta livre. Fica longe das portas de serviço comuns
# e das que o painel de hospedagem costuma usar.
FAIXA_INICIO = 3100
FAIXA_FIM = 3199

INSPECOES: list[tuple[str, str]] = [
    ("Sistema", "cat /etc/os-release | head -2; uname -r; uptime"),
    ("Recursos", "free -h | head -2; df -h / | tail -1; echo \"CPUs: $(nproc)\""),
    ("Docker", "docker --version 2>&1; docker compose version 2>&1 | head -1"),
    (
        "Containers rodando",
        "docker ps --format '{{.Names}}  |  {{.Image}}  |  {{.Ports}}' 2>&1 || echo '(docker indisponível)'",
    ),
    ("Nginx", "nginx -v 2>&1; systemctl is-active nginx"),
    ("Sites nginx habilitados", "ls -1 /etc/nginx/sites-enabled/ 2>&1"),
    (
        "Portas TCP em escuta",
        "ss -ltn 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -n -u | tr '\\n' ' '",
    ),
    (
        "Portas já usadas por proxy_pass de outros sites",
        "grep -rhoE 'proxy_pass +https?://127\\.0\\.0\\.1:[0-9]+' /etc/nginx/sites-available/ 2>/dev/null "
        "| grep -oE '[0-9]+$' | sort -n -u | tr '\\n' ' '",
    ),
    ("Certificados Let's Encrypt existentes", "ls -1 /etc/letsencrypt/live/ 2>/dev/null"),
    ("Aplicações em /opt", "ls -1 /opt 2>&1"),
    ("Firewall", "ufw status 2>&1 | head -8"),
    ("IP público", "curl -s --max-time 10 ifconfig.me"),
]


def executar(cliente: paramiko.SSHClient, comando: str, timeout: int = 60) -> str:
    _, stdout, stderr = cliente.exec_command(comando, timeout=timeout)
    saida = stdout.read().decode(errors="replace").strip()
    erro = stderr.read().decode(errors="replace").strip()

    if saida:
        return saida
    if erro:
        return f"[erro] {erro}"
    return "(vazio)"


def portas_ocupadas(cliente: paramiko.SSHClient) -> set[int]:
    """Portas em escuta agora, mais as que outros sites reservaram no nginx."""
    ocupadas: set[int] = set()

    escutando = executar(
        cliente,
        "ss -ltn 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -n -u",
    )
    reservadas = executar(
        cliente,
        "grep -rhoE 'proxy_pass +https?://127\\.0\\.0\\.1:[0-9]+' /etc/nginx/sites-available/ 2>/dev/null "
        "| grep -oE '[0-9]+$' | sort -n -u",
    )

    for bloco in (escutando, reservadas):
        for linha in bloco.splitlines():
            linha = linha.strip()
            if linha.isdigit():
                ocupadas.add(int(linha))

    return ocupadas


def main() -> int:
    if not SENHA:
        print("Defina VPS_PASSWORD no ambiente. Exemplo:", file=sys.stderr)
        print("  VPS_PASSWORD='sua-senha' python3 scripts/analisar-vps.py", file=sys.stderr)
        return 1

    cliente = paramiko.SSHClient()
    cliente.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        cliente.connect(
            hostname=HOST,
            username=USUARIO,
            password=SENHA,
            timeout=30,
            allow_agent=False,
            look_for_keys=False,
        )
    except Exception as erro:  # noqa: BLE001
        print(f"Não foi possível conectar em {USUARIO}@{HOST}: {erro}", file=sys.stderr)
        return 1

    print(f"Conectado em {USUARIO}@{HOST}\n")

    for titulo, comando in INSPECOES:
        print("=" * 72)
        print(titulo)
        print("=" * 72)
        print(executar(cliente, comando))
        print()

    ocupadas = portas_ocupadas(cliente)
    livres = [porta for porta in range(FAIXA_INICIO, FAIXA_FIM + 1) if porta not in ocupadas]

    print("=" * 72)
    print("PORTA SUGERIDA PARA O RAPIDINHO")
    print("=" * 72)

    if livres:
        print(f"Primeira porta livre entre {FAIXA_INICIO} e {FAIXA_FIM}: {livres[0]}")
        print(f"Outras livres: {', '.join(str(p) for p in livres[1:11])}…")
        print()
        print("O deploy escolhe e fixa a porta sozinho no primeiro run, gravando em")
        print("/opt/rapidinho/.env — nas execuções seguintes ele reaproveita a mesma.")
    else:
        print(f"Nenhuma porta livre entre {FAIXA_INICIO} e {FAIXA_FIM}. Amplie a faixa.")

    cliente.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
