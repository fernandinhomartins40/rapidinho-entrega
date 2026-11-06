import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Usuario } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, T, Toque } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Campo } from '@/componentes/formulario';
import { cores, espaco, raio, toqueMinimo } from '@/tema/tokens';

const SUGESTOES = [
  'Cebola',
  'Alho',
  'Pimentão',
  'Coentro',
  'Cheiro-verde',
  'Tomate',
  'Azeitona',
  'Milho',
  'Ervilha',
  'Pimenta',
  'Maionese',
  'Picles',
];
const MAXIMO = 15;

export default function ItensQueOdeio() {
  const folga = useFolgaInferior(espaco.xxl);
  const { usuario, atualizar } = useSessao();
  const [novo, setNovo] = useState('');

  const salvar = useMutation({
    mutationFn: (itensQueOdeio: string[]) =>
      chamar<Usuario>('eu', { metodo: 'PATCH', corpo: { itensQueOdeio } }),
    onSuccess: atualizar,
    onError: avisarErro,
  });

  // Muda na hora; se o servidor recusar, volta ao que era.
  const itens = salvar.isPending ? salvar.variables : (usuario?.itensQueOdeio ?? []);
  const jaTem = (nome: string) => itens.some((i) => i.toLowerCase() === nome.toLowerCase());
  const sugestoes = SUGESTOES.filter((s) => !jaTem(s));
  const digitado = novo.trim();

  const adicionar = (nome: string) => {
    if (!jaTem(nome)) salvar.mutate([...itens, nome]);
    setNovo('');
  };

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Itens que odeio' }} />
      <T cor={cores.textoMedio}>
        Odeia cebola? Marque aqui. Em cada item de restaurante, o app pergunta se é para tirar, e a
        loja recebe o pedido junto do item.
      </T>

      {itens.length ? (
        <View style={estilos.fichas}>
          {itens.map((item) => (
            <Toque
              key={item}
              accessibilityLabel={`Tirar ${item} da lista`}
              onPress={() => salvar.mutate(itens.filter((i) => i !== item))}
              style={[estilos.ficha, estilos.fichaMarcada]}
            >
              <T v="corpoForte" cor={cores.perigo}>
                {item}
              </T>
              <X size={16} color={cores.perigo} />
            </Toque>
          ))}
        </View>
      ) : (
        <T v="corpoForte">Nada na lista ainda.</T>
      )}

      {itens.length < MAXIMO ? (
        <>
          <Campo
            rotulo="O que você odeia?"
            placeholder="Ex.: cebola"
            value={novo}
            onChangeText={setNovo}
            maxLength={30}
            onSubmitEditing={() => digitado.length >= 2 && adicionar(digitado)}
          />
          <Botao
            titulo="Adicionar"
            variante="secundario"
            Icone={Plus}
            desativado={digitado.length < 2}
            aoTocar={() => adicionar(digitado)}
          />
          <T v="titulo3">Sugestões</T>
          <View style={estilos.fichas}>
            {sugestoes.map((sugestao) => (
              <Toque
                key={sugestao}
                accessibilityLabel={`Odeio ${sugestao}`}
                onPress={() => adicionar(sugestao)}
                style={estilos.ficha}
              >
                <T v="corpoForte">{sugestao}</T>
              </Toque>
            ))}
          </View>
        </>
      ) : (
        <T cor={cores.textoMedio}>Sua lista chegou a {MAXIMO} itens.</T>
      )}

      <T v="legenda" cor={cores.textoMedio}>
        O pedido depende da loja atender. Se for alergia, fale também com ela.
      </T>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.m },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  ficha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    minHeight: toqueMinimo,
    paddingHorizontal: espaco.m,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
  },
  fichaMarcada: { backgroundColor: cores.perigoClaro },
});
