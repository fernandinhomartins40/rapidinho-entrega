import Link from 'next/link';
import { APP_NAME } from '@rapidinho/shared';

export const metadata = {
  title: 'Política de privacidade',
  description: 'Como o Rapidinho Entrega trata seus dados pessoais.',
};

/**
 * Política de privacidade.
 *
 * Escrita em linguagem direta de propósito: a LGPD exige informação "clara,
 * adequada e ostensiva" (art. 9º), e um texto que ninguém entende não cumpre
 * isso, por mais completo que seja juridicamente.
 */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="text-muted-foreground mt-2">
        Última atualização: setembro de 2026. Em resumo: usamos seus dados para entregar seu pedido,
        e nada além disso.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">Quem somos</h2>
          <p className="mt-2">
            O {APP_NAME} é uma plataforma que liga você ao comércio da sua cidade. Somos
            responsáveis pelos dados que você nos dá aqui. Para falar com nosso encarregado de
            dados, escreva para{' '}
            <a href="mailto:privacidade@rapidinhoentrega.com.br" className="underline">
              privacidade@rapidinhoentrega.com.br
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">O que coletamos e por quê</h2>
          <ul className="mt-2 list-inside list-disc space-y-2">
            <li>
              <strong>Telefone</strong> — é como você entra, no lugar de senha. Sem ele não há
              conta.
            </li>
            <li>
              <strong>Nome</strong> — para a loja saber para quem é o pedido.
            </li>
            <li>
              <strong>Endereço e ponto de referência</strong> — para o entregador chegar até você.
            </li>
            <li>
              <strong>Pedidos</strong> — para você ver seu histórico e a loja cumprir obrigações
              fiscais.
            </li>
            <li>
              <strong>E-mail</strong> — opcional, só se você informar.
            </li>
          </ul>
          <p className="mt-2">
            A base legal é a execução do contrato entre você e a loja (art. 7º, V da LGPD) e, no
            caso dos pedidos guardados, o cumprimento de obrigação legal (art. 7º, II).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Com quem compartilhamos</h2>
          <p className="mt-2">
            Só com quem precisa para o pedido acontecer: <strong>a loja</strong> que vai preparar,
            <strong> o entregador</strong> daquela entrega e o <strong>meio de pagamento</strong>,
            quando você paga pelo app.
          </p>
          <p className="mt-2">
            Não vendemos seus dados. Não os usamos para anúncio de terceiros. Não os mandamos para
            fora do Brasil.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Por quanto tempo guardamos</h2>
          <p className="mt-2">
            Enquanto sua conta existir. Se você excluí-la, apagamos seus dados pessoais na hora; os
            pedidos já entregues continuam sem o que identifica você, porque a loja é obrigada a
            guardá-los por cinco anos para fins fiscais.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Seus direitos</h2>
          <p className="mt-2">
            Você pode ver, corrigir, levar e apagar seus dados quando quiser, sem precisar pedir
            para ninguém:{' '}
            <Link href="/conta/dados" className="underline">
              Meus dados
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Cookies</h2>
          <p className="mt-2">
            Usamos um cookie para manter você conectado e outro para lembrar sua cidade. Não há
            cookie de rastreamento nem pixel de rede social.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Segurança</h2>
          <p className="mt-2">
            As senhas não existem (usamos código por WhatsApp). O código de acesso é guardado com
            hash, expira em minutos e trava após poucas tentativas. O tráfego é criptografado.
          </p>
        </section>
      </div>

      <p className="text-muted-foreground mt-10 text-sm">
        <Link href="/termos" className="underline">
          Termos de uso
        </Link>{' '}
        ·{' '}
        <Link href="/" className="underline">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
