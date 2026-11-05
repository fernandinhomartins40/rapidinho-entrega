import { useMutation } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import type { Usuario } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, T } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Campo } from '@/componentes/formulario';
import { cores, espaco } from '@/tema/tokens';

export default function MeusDados() {
  const folga = useFolgaInferior(espaco.xxl);
  const { usuario, atualizar } = useSessao();
  const [nome, setNome] = useState(usuario?.nome ?? '');

  const salvar = useMutation({
    mutationFn: () => chamar<Usuario>('eu', { metodo: 'PATCH', corpo: { nome: nome.trim() } }),
    onSuccess: (novo) => {
      atualizar(novo);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    },
    onError: avisarErro,
  });

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Meus dados' }} />
      <ScrollView
        contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
        keyboardShouldPersistTaps="handled"
      >
        {!usuario?.nome ? (
          <T cor={cores.textoMedio}>
            Como a loja e o entregador devem te chamar? O nome vai junto com seus pedidos.
          </T>
        ) : null}
        <Campo
          rotulo="Seu nome"
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Maria da Silva"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={120}
          autoFocus={!usuario?.nome}
        />
        <Campo
          rotulo="Celular"
          value={usuario?.telefone ?? ''}
          editable={false}
          dica="É o número que você usa para entrar. Para trocar, saia e entre com o novo."
        />
        <Botao
          titulo="Salvar"
          desativado={nome.trim().length < 2 || nome.trim() === usuario?.nome}
          carregando={salvar.isPending}
          aoTocar={() => salvar.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xxl },
});
