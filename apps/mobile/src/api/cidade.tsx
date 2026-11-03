import { useQuery } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Cidade, RespostaCidades } from '@contrato';
import { chamar } from './cliente';

const CHAVE_DA_CIDADE = 'rapidinho.cidade';

type ContextoDaCidade = {
  /** Slug da cidade escolhida; null até a lista chegar. */
  cidade: string | null;
  cidades: Cidade[];
  escolher: (slug: string) => void;
};

const Contexto = createContext<ContextoDaCidade | null>(null);

export function ProvedorDeCidade({ children }: { children: ReactNode }) {
  const [guardada, setGuardada] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void SecureStore.getItemAsync(CHAVE_DA_CIDADE)
      .then(setGuardada)
      .catch(() => setGuardada(null));
  }, []);

  const lista = useQuery({
    queryKey: ['cidades'],
    queryFn: () => chamar<RespostaCidades>('cidades'),
    staleTime: 10 * 60_000,
  });

  const cidades = lista.data?.cidades ?? [];

  // A cidade guardada pode ter saído do ar: cai na primeira atendida.
  const cidade =
    guardada === undefined || !lista.data
      ? null
      : (cidades.find((c) => c.slug === guardada)?.slug ?? cidades[0]?.slug ?? null);

  const escolher = useCallback((slug: string) => {
    setGuardada(slug);
    void SecureStore.setItemAsync(CHAVE_DA_CIDADE, slug);
  }, []);

  const valor = useMemo(() => ({ cidade, cidades, escolher }), [cidade, cidades, escolher]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCidade(): ContextoDaCidade {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCidade fora do ProvedorDeCidade');
  return contexto;
}
