import Link from 'next/link';
import { APP_NAME } from '@rapidinho/shared';

export const metadata = {
  title: 'Excluir sua conta',
  description: 'Como excluir sua conta do Rapidinho Entrega e o que acontece com seus dados.',
};

/**
 * Como excluir a conta — página pública, sem login.
 *
 * A Google Play exige um link aberto que explique a exclusão; o botão em si
 * fica no app (Conta) e no site (Meus dados).
 */
export default function ExcluirContaPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Excluir sua conta do {APP_NAME}</h1>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">No app</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Abra o app {APP_NAME} e entre com seu telefone.</li>
            <li>Toque em Conta, no menu de baixo.</li>
            <li>Toque em &quot;Excluir minha conta&quot; e confirme.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-bold">No site</h2>
          <p className="mt-2">
            Entre no site e abra{' '}
            <Link href="/conta/dados" className="underline">
              Meus dados
            </Link>
            . Lá você também pode baixar uma cópia dos seus dados antes de excluir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Sem acesso ao seu telefone?</h2>
          <p className="mt-2">
            Escreva para{' '}
            <a href="mailto:privacidade@rapidinhoentrega.com.br" className="underline">
              privacidade@rapidinhoentrega.com.br
            </a>{' '}
            com o número da conta. Confirmamos que a conta é sua e excluímos em até 15 dias.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">O que é apagado</h2>
          <p className="mt-2">
            Na hora: nome, telefone, e-mail, endereços, sacola e os comentários das suas avaliações.
            Os pedidos já entregues ficam guardados por cinco anos, sem seu nome, telefone e
            endereço, porque a loja é obrigada a mantê-los para fins fiscais.
          </p>
          <p className="mt-2">
            Se houver um pedido em andamento, a exclusão só fica disponível depois que ele terminar.
          </p>
        </section>
      </div>

      <p className="text-muted-foreground mt-10 text-sm">
        <Link href="/privacidade" className="underline">
          Política de privacidade
        </Link>{' '}
        ·{' '}
        <Link href="/" className="underline">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
