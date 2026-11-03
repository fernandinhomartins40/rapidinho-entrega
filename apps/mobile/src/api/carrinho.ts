import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { EntradaAdicionarAoCarrinho, RespostaCarrinho } from '@contrato';
import { chamar, ErroDaApi } from './cliente';
import { useSessao } from './sessao';

export function useCarrinho() {
  const { usuario } = useSessao();
  return useQuery({
    queryKey: ['carrinho'],
    queryFn: () => chamar<RespostaCarrinho>('carrinho'),
    enabled: !!usuario,
  });
}

/** Ação que precisa de conta: sem login, leva para a tela de entrar. */
export function useExigirLogin() {
  const { usuario } = useSessao();
  return (acao: () => void) => {
    if (usuario) acao();
    else router.push('/entrar');
  };
}

export function avisarErro(erro: unknown) {
  Alert.alert(
    'Não deu certo',
    erro instanceof ErroDaApi ? erro.message : 'Tente de novo em instantes.',
  );
}

export function useAdicionarAoCarrinho() {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: (entrada: EntradaAdicionarAoCarrinho) =>
      chamar<RespostaCarrinho>('carrinho/itens', { metodo: 'POST', corpo: entrada }),
    onSuccess: (carrinho) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      consultas.setQueryData(['carrinho'], carrinho);
    },
    onError: avisarErro,
  });
}

export function useAlterarItem() {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantidade }: { id: string; quantidade: number }) =>
      chamar<RespostaCarrinho>(`carrinho/itens/${id}`, { metodo: 'PATCH', corpo: { quantidade } }),
    onSuccess: (carrinho) => consultas.setQueryData(['carrinho'], carrinho),
    onError: avisarErro,
  });
}
