import Link from 'next/link';
import { APP_NAME } from '@rapidinho/shared';

export const metadata = {
  title: 'Termos de uso',
  description: 'As regras de uso do Rapidinho Entrega.',
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
      <p className="text-muted-foreground mt-2">Última atualização: setembro de 2026.</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">O que o {APP_NAME} é</h2>
          <p className="mt-2">
            Somos o intermediário entre você e as lojas da sua cidade. Quem prepara o pedido é a
            loja; quem entrega é o entregador. Nós cuidamos da plataforma, do pagamento e do
            acompanhamento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Sua conta</h2>
          <p className="mt-2">
            A conta é sua e pessoal, identificada pelo seu telefone. O código que chega no WhatsApp
            dá acesso a ela — não repasse para ninguém.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Pedidos e pagamento</h2>
          <p className="mt-2">
            O preço, a disponibilidade e o prazo são informados pela loja. Ao confirmar, você fecha
            a compra com ela. A loja pode recusar um pedido — por falta de item, por estar fechando
            ou por não conseguir entregar no seu endereço — e explica o motivo.
          </p>
          <p className="mt-2">
            Pagamento em dinheiro ou maquininha é acertado na entrega, direto com o entregador. Pix
            e cartão pelo app passam por nós.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Cancelamento</h2>
          <p className="mt-2">
            Enquanto a loja não aceitar, dá para cancelar sem custo. Depois de a loja começar a
            preparar, o cancelamento depende dela — o alimento já foi produzido. Problema com o
            pedido: fale primeiro com a loja, pelo botão de WhatsApp na tela do pedido.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">O que não pode</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Usar a conta de outra pessoa</li>
            <li>Fazer pedidos falsos ou trotes</li>
            <li>Ofender lojistas ou entregadores nas avaliações</li>
            <li>Tentar burlar cupons, preços ou o funcionamento da plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">Avaliações</h2>
          <p className="mt-2">
            Você pode avaliar a loja e o entregador depois da entrega. A avaliação é pública e
            precisa se referir à sua experiência real.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Mudanças nestes termos</h2>
          <p className="mt-2">
            Se mudarmos algo relevante, avisamos pelo app antes de valer. Continuar usando depois
            disso significa que você concorda.
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
