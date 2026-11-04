import Link from 'next/link';
import { APP_NAME } from '@rapidinho/shared';

export const metadata = {
  title: 'Política de privacidade',
  description: 'Como o Rapidinho Entrega trata seus dados pessoais, no site e no app.',
};

/**
 * Política de privacidade — do site e do app Android.
 *
 * Escrita em linguagem direta de propósito: a LGPD exige informação "clara,
 * adequada e ostensiva" (art. 9º), e um texto que ninguém entende não cumpre
 * isso, por mais completo que seja juridicamente. É também o link que a Google
 * Play exige: o que está aqui tem de bater com a "Segurança dos dados" do
 * Play Console.
 */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="text-muted-foreground mt-2">
        Última atualização: novembro de 2026. Vale para o site e para o app {APP_NAME} no Android.
        Em resumo: usamos seus dados para o seu pedido chegar, e nada além disso.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">Quem somos</h2>
          <p className="mt-2">
            O {APP_NAME} é uma plataforma que liga você ao comércio da sua cidade: restaurantes,
            mercados e farmácias. Somos responsáveis pelos dados que você nos dá aqui. Para falar
            com nosso encarregado de dados, escreva para{' '}
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
              <strong>Telefone</strong> — é como você entra: mandamos um código por SMS, no lugar de
              senha. Sem ele não há conta.
            </li>
            <li>
              <strong>Nome</strong> — para a loja saber para quem é o pedido.
            </li>
            <li>
              <strong>Endereço e ponto de referência</strong> — para o entregador chegar até você.
            </li>
            <li>
              <strong>Localização</strong> — só quando você toca em &quot;usar minha
              localização&quot; para preencher o endereço. No modo entregador, a posição é enviada
              durante a corrida, com o app aberto, para o cliente acompanhar a entrega. Não
              rastreamos ninguém com o app fechado.
            </li>
            <li>
              <strong>Fotos</strong> — só as que você escolhe enviar: a receita de um remédio, para
              a farmácia conferir, ou o comprovante do Pix, para a loja. A câmera só abre quando
              você pede.
            </li>
            <li>
              <strong>Pedidos</strong> — para você ver seu histórico e a loja cumprir obrigações
              fiscais.
            </li>
            <li>
              <strong>E-mail</strong> — opcional, só se você informar.
            </li>
            <li>
              <strong>Dados técnicos</strong> — registros de erro e de acesso (data, hora,
              aparelho), para manter o serviço funcionando e seguro. Notificações só são enviadas se
              você permitir.
            </li>
          </ul>
          <p className="mt-2">
            A base legal é a execução do contrato entre você e a loja (art. 7º, V da LGPD) e, no
            caso dos pedidos guardados, o cumprimento de obrigação legal (art. 7º, II). A receita
            médica é dado de saúde: só é usada para a farmácia atender o seu pedido (art. 11, II).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Pagamento</h2>
          <p className="mt-2">
            O {APP_NAME} não recebe nem guarda dados de cartão ou de conta bancária. Você paga
            direto à loja, no Pix dela ou na entrega.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Com quem compartilhamos</h2>
          <p className="mt-2">
            Só com quem precisa para o pedido acontecer: <strong>a loja</strong> que vai preparar e
            <strong> o entregador</strong> daquela entrega.
          </p>
          <p className="mt-2">
            Usamos também serviços de tecnologia que tratam dados só em nosso nome: o Google
            Firebase, para enviar o código por SMS e as notificações, e a empresa que hospeda nossos
            servidores. Esses serviços podem guardar dados fora do Brasil, com as garantias do art.
            33 da LGPD.
          </p>
          <p className="mt-2">
            Não vendemos seus dados. Não os usamos para anúncio de terceiros. Não há anúncios no
            app.
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
            para ninguém: no site, em{' '}
            <Link href="/conta/dados" className="underline">
              Meus dados
            </Link>
            ; no app, em Conta. Veja{' '}
            <Link href="/excluir-conta" className="underline">
              como excluir sua conta
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Crianças</h2>
          <p className="mt-2">O {APP_NAME} não é feito para menores de 18 anos.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Cookies</h2>
          <p className="mt-2">
            No site, usamos um cookie para manter você conectado e outro para lembrar sua cidade.
            Não há cookie de rastreamento nem pixel de rede social.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Segurança</h2>
          <p className="mt-2">
            Não existe senha de cliente: você entra com um código por SMS, que expira em minutos. O
            tráfego entre o app, o site e nossos servidores é criptografado.
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
