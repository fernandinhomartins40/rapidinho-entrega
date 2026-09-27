'use client';

import { useActionState, useState } from 'react';
import { Bike, PartyPopper, ShoppingBag, Store } from 'lucide-react';
import { maskPhoneBR } from '@rapidinho/shared';
import { Button, cn } from '@rapidinho/ui';
import { UFS } from '@/lib/ufs';
import { pedirMinhaCidade, type EstadoDoPedidoDeCidade } from './actions';

const PERFIS = [
  { valor: 'CUSTOMER', rotulo: 'Quero pedir', icone: ShoppingBag },
  { valor: 'STORE', rotulo: 'Tenho loja', icone: Store },
  { valor: 'COURIER', rotulo: 'Quero entregar', icone: Bike },
] as const;

const INICIAL: EstadoDoPedidoDeCidade = { ok: false };

export function FormularioDeCidade() {
  const [estado, enviar, enviando] = useActionState(pedirMinhaCidade, INICIAL);
  const [perfil, setPerfil] = useState<(typeof PERFIS)[number]['valor']>('CUSTOMER');
  const [whatsapp, setWhatsapp] = useState('');

  if (estado.ok) {
    return (
      <div className="bg-card mt-6 space-y-3 rounded-3xl border p-6 text-center" role="status">
        <PartyPopper className="text-primary mx-auto h-10 w-10" aria-hidden />
        <p className="text-xl font-extrabold">Pedido registrado!</p>
        <p className="text-muted-foreground">
          {estado.naFila === 1
            ? `Você é a primeira pessoa a pedir ${estado.cidade}. Chame mais gente — cada pedido aproxima a abertura.`
            : `${estado.naFila} pessoas já pediram ${estado.cidade}. Chame mais gente — cada pedido aproxima a abertura.`}
        </p>
        <Button asChild block>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Tô chamando o Rapidinho, app de entrega, para ${estado.cidade}. Pede também: ${typeof window === 'undefined' ? '' : window.location.origin}/minha-cidade`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Chamar amigos no WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  const erro = (campo: string) => estado.fieldErrors?.[campo];

  return (
    <form action={enviar} className="mt-6 space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Você quer…</legend>
        <div className="grid grid-cols-3 gap-2">
          {PERFIS.map((opcao) => {
            const Icone = opcao.icone;
            const ativo = perfil === opcao.valor;
            return (
              <label
                key={opcao.valor}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-sm font-semibold transition-colors',
                  ativo ? 'border-primary bg-accent' : 'border-input',
                )}
              >
                <input
                  type="radio"
                  name="perfil"
                  value={opcao.valor}
                  checked={ativo}
                  onChange={() => setPerfil(opcao.valor)}
                  className="sr-only"
                />
                <Icone className={cn('h-6 w-6', ativo && 'text-primary')} aria-hidden />
                {opcao.rotulo}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <Campo rotulo="Sua cidade" erro={erro('cidade')}>
          <input name="cidade" autoComplete="address-level2" className={estiloDoCampo} />
        </Campo>
        <Campo rotulo="UF" erro={erro('uf')}>
          <select name="uf" defaultValue="" className={estiloDoCampo}>
            <option value="" disabled>
              —
            </option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo rotulo="Seu nome" erro={erro('nome')}>
        <input name="nome" autoComplete="given-name" className={estiloDoCampo} />
      </Campo>

      {perfil === 'STORE' ? (
        <Campo rotulo="Nome da loja" erro={erro('negocio')}>
          <input name="negocio" placeholder="Ex.: Mercado do Zé" className={estiloDoCampo} />
        </Campo>
      ) : null}

      <Campo rotulo="WhatsApp" erro={erro('whatsapp')}>
        <input
          name="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onChange={(evento) => setWhatsapp(maskPhoneBR(evento.target.value))}
          placeholder="(00) 90000-0000"
          className={estiloDoCampo}
        />
      </Campo>

      {estado.message ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {estado.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block isLoading={enviando}>
        Quero o Rapidinho na minha cidade
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Usamos seu WhatsApp só para avisar quando o Rapidinho chegar na sua cidade.
      </p>
    </form>
  );
}

const estiloDoCampo = 'border-input bg-card min-h-touch w-full rounded-xl border px-3';

function Campo({
  rotulo,
  erro,
  children,
}: {
  rotulo: string;
  erro?: string;
  children: React.ReactElement;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{rotulo}</span>
      {children}
      {erro ? <span className="text-destructive mt-1 block text-xs">{erro}</span> : null}
    </label>
  );
}
