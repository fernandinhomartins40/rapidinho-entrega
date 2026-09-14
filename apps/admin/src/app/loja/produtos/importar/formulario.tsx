'use client';

import { useActionState, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Card, CardContent, SwitchField } from '@rapidinho/ui';
import { buildImportTemplate } from '@rapidinho/shared';
import { importarPlanilha, type ResultadoDaImportacao } from './actions';

const INICIAL: ResultadoDaImportacao = { ok: false };

/**
 * O arquivo é lido no navegador e enviado como texto.
 *
 * Assim o lojista vê o nome do arquivo escolhido antes de enviar, e o servidor
 * recebe texto puro em vez de um upload binário — o parser é o mesmo dos
 * testes, e a validação acontece de novo no servidor de qualquer forma.
 */
export function FormularioDeImportacao() {
  const [estado, acao, pendente] = useActionState(importarPlanilha, INICIAL);
  const [conteudo, setConteudo] = useState('');
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setErroDeLeitura(null);

    try {
      const texto = await arquivo.text();
      setConteudo(texto);
      setNomeDoArquivo(arquivo.name);
    } catch {
      setErroDeLeitura('Não consegui ler o arquivo. Tente salvá-lo de novo como CSV.');
      setConteudo('');
      setNomeDoArquivo(null);
    }
  }

  function baixarModelo() {
    // Blob local: o modelo é fixo e não precisa de ida ao servidor.
    const blob = new Blob([`\uFEFF${buildImportTemplate()}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-produtos-rapidinho.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={baixarModelo} type="button">
        <Download className="h-5 w-5" aria-hidden />
        Baixar planilha modelo
      </Button>

      <Card>
        <CardContent className="pt-5">
          <form action={acao} className="space-y-5">
            <input type="hidden" name="conteudo" value={conteudo} />

            <div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={aoEscolherArquivo}
                className="sr-only"
                id="arquivo"
              />
              <label
                htmlFor="arquivo"
                className="border-input hover:border-primary flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
              >
                <Upload className="text-muted-foreground h-8 w-8" aria-hidden />
                <span className="font-semibold">{nomeDoArquivo ?? 'Escolher arquivo CSV'}</span>
                <span className="text-muted-foreground text-sm">
                  {nomeDoArquivo
                    ? 'Clique para trocar'
                    : 'Toque aqui para procurar no seu aparelho'}
                </span>
              </label>
            </div>

            {erroDeLeitura ? (
              <p className="text-destructive text-sm font-medium">{erroDeLeitura}</p>
            ) : null}

            <div className="space-y-3">
              <SwitchField
                name="criarCategorias"
                value="sim"
                defaultChecked
                label="Criar categorias que ainda não existem"
              />
              <SwitchField
                name="atualizarExistentes"
                value="sim"
                defaultChecked
                label="Atualizar produtos que já estão no cardápio"
                description="Casa pelo código interno, ou pelo nome quando não houver código."
              />
            </div>

            <Button type="submit" size="lg" disabled={pendente || conteudo === ''}>
              {pendente ? 'Importando…' : 'Importar agora'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {estado.message ? (
        <Card className={estado.ok ? 'border-success' : 'border-destructive'}>
          <CardContent className="space-y-3 pt-5">
            <p
              className={
                estado.ok ? 'text-success font-semibold' : 'text-destructive font-semibold'
              }
            >
              {estado.message}
            </p>

            {estado.problemas && estado.problemas.length > 0 ? (
              <div>
                <p className="text-sm font-semibold">
                  {estado.problemas.length} linha(s) não foram importadas:
                </p>
                <ul className="text-muted-foreground mt-1 max-h-60 space-y-1 overflow-auto text-sm">
                  {estado.problemas.map((problema) => (
                    <li key={`${problema.line}-${problema.message}`}>
                      Linha {problema.line}: {problema.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
