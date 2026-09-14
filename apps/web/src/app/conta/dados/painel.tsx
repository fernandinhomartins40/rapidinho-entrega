'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@rapidinho/ui';
import { excluirMinhaConta, exportarMeusDados } from './actions';

const CONFIRMACAO = 'EXCLUIR';

export function MeusDados() {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [abrindoExclusao, setAbrindoExclusao] = useState(false);

  function exportar() {
    setErro(null);

    iniciarTransicao(async () => {
      const resultado = await exportarMeusDados();

      if (!resultado.ok || !('json' in resultado) || !resultado.json) {
        setErro(resultado.message ?? 'Não foi possível exportar.');
        return;
      }

      // Baixa no próprio navegador: os dados já estão na resposta, e mandá-los
      // para o storage só para gerar um link criaria mais uma cópia do que a
      // pessoa está justamente tentando controlar.
      const blob = new Blob([resultado.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meus-dados-rapidinho.json';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-5">
      {erro ? <p className="text-destructive font-medium">{erro}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Levar meus dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Baixa um arquivo com seu cadastro, endereços, pedidos e avaliações.
          </p>
          <Button variant="outline" disabled={pendente} onClick={exportar}>
            <Download className="h-5 w-5" aria-hidden />
            {pendente ? 'Preparando…' : 'Baixar meus dados'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Excluir minha conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Apagamos seu nome, telefone, e-mail e endereços. Os pedidos já entregues continuam no
            sistema sem os seus dados — a loja precisa deles para a contabilidade, e a lei obriga a
            guardá-los.
          </p>

          {abrindoExclusao ? (
            <>
              <label htmlFor="confirmacao" className="block text-sm font-semibold">
                Digite {CONFIRMACAO} para confirmar
              </label>
              <Input
                id="confirmacao"
                value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value.toUpperCase())}
                autoComplete="off"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={pendente || confirmacao !== CONFIRMACAO}
                  onClick={() =>
                    iniciarTransicao(async () => {
                      const resultado = await excluirMinhaConta();
                      if (resultado.ok) router.push('/');
                      else setErro(resultado.message ?? 'Não foi possível excluir.');
                    })
                  }
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                  Excluir para sempre
                </Button>
                <Button variant="ghost" onClick={() => setAbrindoExclusao(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={() => setAbrindoExclusao(true)}>
              Quero excluir minha conta
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
