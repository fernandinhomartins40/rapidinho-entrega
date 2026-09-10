const PASSOS = [
  {
    titulo: 'Escolha a loja',
    texto: 'Veja quem está aberto agora na sua cidade, com o cardápio e a taxa de entrega na tela.',
  },
  {
    titulo: 'Monte o pedido',
    texto:
      'Adicione observações, escolha os complementos e informe o ponto de referência da entrega.',
  },
  {
    titulo: 'Acompanhe até chegar',
    texto: 'A loja confirma, prepara e despacha. Você recebe aviso em cada etapa.',
  },
] as const;

export function ComoFunciona() {
  return (
    <section
      aria-labelledby="como-funciona"
      className="mx-auto w-full max-w-5xl px-5 pt-20 sm:pt-24"
    >
      <h2 id="como-funciona" className="text-2xl font-bold tracking-tight sm:text-3xl">
        Como funciona
      </h2>

      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {PASSOS.map((passo, indice) => (
          <li key={passo.titulo} className="relative">
            {/* Linha ligando os passos no desktop; some no celular, onde a
                leitura já é vertical. */}
            {indice < PASSOS.length - 1 ? (
              <span
                className="bg-border absolute left-11 top-5 hidden h-px w-[calc(100%-2rem)] sm:block"
                aria-hidden
              />
            ) : null}

            <span className="bg-brand-gradient text-brand-deep relative flex h-10 w-10 items-center justify-center rounded-full text-lg font-extrabold shadow-[0_6px_16px_-6px_hsl(var(--brand-flame))]">
              {indice + 1}
            </span>
            <h3 className="mt-4 text-lg font-bold">{passo.titulo}</h3>
            <p className="text-muted-foreground mt-1.5 leading-relaxed">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
