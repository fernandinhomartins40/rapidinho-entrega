import { Clock, Radio, Wallet } from 'lucide-react';

/**
 * Os três motivos que decidem a compra aqui.
 *
 * Nada de "tecnologia de ponta": o que pesa para quem mora no interior é
 * chegar rápido, poder pagar como sempre pagou e saber onde o pedido está.
 */
const BENEFICIOS = [
  {
    icone: Clock,
    titulo: 'Chega rápido de verdade',
    texto:
      'Lojas da sua própria cidade, com entregadores daqui. O caminho é curto e o pedido não esfria.',
  },
  {
    icone: Wallet,
    titulo: 'Pague do seu jeito',
    texto:
      'Pix na hora, cartão pelo app ou na entrega — e dinheiro, com troco certo se você pedir.',
  },
  {
    icone: Radio,
    titulo: 'Acompanhe em tempo real',
    texto: 'Você vê quando a loja aceita, quando começa a preparar e quando sai para entrega.',
  },
] as const;

export function Beneficios() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-20 sm:pt-24">
      <ul className="grid gap-6 sm:grid-cols-3">
        {BENEFICIOS.map((beneficio) => {
          const Icone = beneficio.icone;

          return (
            <li key={beneficio.titulo}>
              <span className="bg-brand-gradient text-brand-deep flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_8px_20px_-10px_hsl(var(--brand-flame))]">
                <Icone className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{beneficio.titulo}</h3>
              <p className="text-muted-foreground mt-1.5 leading-relaxed">{beneficio.texto}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
