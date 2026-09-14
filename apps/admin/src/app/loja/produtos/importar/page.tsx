import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { getStoreContext } from '@/lib/store-context';
import { FormularioDeImportacao } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Importar planilha' };

export default async function ImportarPage() {
  // Só confirma o vínculo com a loja; a importação em si vive na Server Action.
  await getStoreContext();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/loja/produtos" className="text-muted-foreground text-sm underline">
          ← Voltar para os produtos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Importar planilha</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre centenas de itens de uma vez, a partir do arquivo que você já tem.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Como a planilha precisa estar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            A primeira linha precisa ter os títulos das colunas. Só <strong>Nome</strong> e{' '}
            <strong>Preço</strong> são obrigatórios.
          </p>
          <ul className="text-muted-foreground list-inside list-disc space-y-1">
            <li>
              <strong>Nome</strong> — também vale &quot;Produto&quot; ou &quot;Item&quot;
            </li>
            <li>
              <strong>Preço</strong> — pode vir como 12,90 ou R$ 12,90
            </li>
            <li>
              <strong>Categoria</strong> — as que não existirem são criadas
            </li>
            <li>
              <strong>Descrição</strong>, <strong>Código</strong>, <strong>Código de barras</strong>
            </li>
            <li>
              <strong>Disponível</strong> — &quot;não&quot; deixa o item pausado
            </li>
            <li>
              <strong>Unidade</strong> — escreva &quot;kg&quot; para venda por peso
            </li>
          </ul>
          <p className="text-muted-foreground">
            Se o arquivo for Excel, use <em>Arquivo → Salvar como → CSV</em>. Acentos, maiúsculas e
            linhas em branco não são problema.
          </p>
        </CardContent>
      </Card>

      <FormularioDeImportacao />
    </div>
  );
}
