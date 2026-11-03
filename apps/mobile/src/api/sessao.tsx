import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Usuario } from '@contrato';
import { apagarToken, chamar, ErroDaApi, gravarToken, lerToken } from './cliente';

type Sessao = {
  carregando: boolean;
  usuario: Usuario | null;
  entrar: (token: string, usuario: Usuario) => Promise<void>;
  sair: () => Promise<void>;
  atualizar: (usuario: Usuario) => void;
};

const ContextoDeSessao = createContext<Sessao | null>(null);

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const consultas = useQueryClient();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (await lerToken()) setUsuario(await chamar<Usuario>('eu'));
      } catch (erro) {
        // Sem internet não é sessão inválida: só o 401 apaga o login do aparelho.
        if (erro instanceof ErroDaApi && erro.status === 401) await apagarToken();
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (token: string, novo: Usuario) => {
    await gravarToken(token);
    setUsuario(novo);
  }, []);

  const sair = useCallback(async () => {
    await chamar('auth/sair', { metodo: 'POST' }).catch(() => undefined);
    await apagarToken();
    setUsuario(null);
    consultas.clear();
  }, [consultas]);

  const valor = useMemo(
    () => ({ carregando, usuario, entrar, sair, atualizar: setUsuario }),
    [carregando, usuario, entrar, sair],
  );

  return <ContextoDeSessao.Provider value={valor}>{children}</ContextoDeSessao.Provider>;
}

export function useSessao(): Sessao {
  const sessao = useContext(ContextoDeSessao);
  if (!sessao) throw new Error('useSessao fora do ProvedorDeSessao');
  return sessao;
}
