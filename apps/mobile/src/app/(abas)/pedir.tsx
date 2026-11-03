import { Redirect } from 'expo-router';

/** A aba do meio abre a sacola; esta rota só existe para a barra ter o lugar. */
export default function Pedir() {
  return <Redirect href="/sacola" />;
}
