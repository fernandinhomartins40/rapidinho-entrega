#!/usr/bin/env python3
"""
Diagnóstico somente-leitura da VPS. NÃO altera nada — pode rodar à vontade.

Responde as perguntas que a auditoria de recursos deixou abertas, em especial a
que decide tudo: o load alto vem da aplicação ou da hospedagem? A coluna `st`
do vmstat é o tempo em que a máquina estava pronta para rodar e o hipervisor
deu a CPU para outro cliente. Se ela for alta, nenhuma otimização no código
resolve.

Uso:
    pip install paramiko
    VPS_PASSWORD='...' python3 scripts/diagnosticar-vps.py

A senha nunca fica no arquivo: vem da variável de ambiente.
"""
import os, sys, paramiko

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
senha = os.environ.get("VPS_PASSWORD")
if not senha:
    print("Defina VPS_PASSWORD no ambiente.", file=sys.stderr)
    sys.exit(1)

cli.connect(os.environ.get("VPS_HOST", "rapidinhoentrega.com.br"),
            username=os.environ.get("VPS_USER", "root"), password=senha,
            timeout=30, banner_timeout=30, auth_timeout=30)

BLOCOS = [
    ("1. CPU e carga", "nproc; uptime; echo; cat /proc/loadavg"),
    ("2. STEAL TIME (coluna st)", "vmstat 1 4 2>/dev/null | tail -3 || awk '/^cpu /{printf \"steal %.2f%%\\n\", ($9*100)/($2+$3+$4+$5+$6+$7+$8+$9)}' /proc/stat"),
    ("3. Quem consome CPU", "ps -eo pcpu,pmem,rss,comm --sort=-pcpu | head -12"),
    ("4. Memória e swap", "free -m"),
    ("5. Disco", "df -h / /var/lib/docker 2>/dev/null | sort -u"),
    ("6. Containers", "timeout 45 docker ps --format '{{.Names}}\t{{.Status}}' 2>&1 | head -20"),
    ("7. Uso do Docker", "timeout 60 docker system df 2>&1 | head -8"),
    ("8. Tamanho dos logs de container", "du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -rh | head -8 || echo '(sem acesso)'"),
    ("9. Volumes órfãos", "timeout 45 docker volume ls -qf dangling=true 2>&1 | head -10; echo '--- total:'; timeout 45 docker volume ls -qf dangling=true 2>/dev/null | wc -l"),
    ("10. Releases acumuladas", "ls -1 /opt/rapidinho/releases 2>/dev/null | wc -l; du -sh /opt/rapidinho 2>/dev/null"),
    ("11. Ferramentas necessárias ao deploy", "for b in zstd docker vmstat nproc; do printf '%-8s %s\\n' \"$b\" \"$(command -v $b || echo AUSENTE)\"; done"),
    ("12. Imagens do Rapidinho já presentes", "timeout 45 docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' 2>&1 | grep -i rapidinho | head -10 || echo '(nenhuma)'"),
]

for titulo, cmd in BLOCOS:
    print(f"\n=== {titulo} ===")
    try:
        _, out, err = cli.exec_command(cmd, timeout=90)
        saida = (out.read().decode(errors="replace") + err.read().decode(errors="replace")).strip()
        print("\n".join("  " + l for l in saida.splitlines()[:16]) or "  (vazio)")
    except Exception as e:
        print(f"  ERRO: {type(e).__name__}: {e}")

cli.close()
