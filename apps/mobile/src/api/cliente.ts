import * as SecureStore from 'expo-secure-store';

const CHAVE_DO_TOKEN = 'rapidinho.sessao';

/** Em desenvolvimento aponte para a máquina: EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 */
export const URL_DA_API = process.env.EXPO_PUBLIC_API_URL ?? 'https://rapidinhoentrega.com.br';

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: string,
  ) {
    super(message);
  }
}

// Guardado no armazenamento cifrado do aparelho: é a chave da conta da pessoa.
export const lerToken = () => SecureStore.getItemAsync(CHAVE_DO_TOKEN);
export const gravarToken = (token: string) => SecureStore.setItemAsync(CHAVE_DO_TOKEN, token);
export const apagarToken = () => SecureStore.deleteItemAsync(CHAVE_DO_TOKEN);

type Opcoes = { metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; corpo?: unknown };

export async function chamar<T>(
  caminho: string,
  { metodo = 'GET', corpo }: Opcoes = {},
): Promise<T> {
  const token = await lerToken();

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_DA_API}/api/app/v1/${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDaApi('Sem conexão. Confira a internet e tente de novo.', 0, 'SEM_CONEXAO');
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = dados as { erro?: string; codigo?: string } | null;
    throw new ErroDaApi(
      erro?.erro ?? 'Algo deu errado. Tente de novo em instantes.',
      resposta.status,
      erro?.codigo,
    );
  }

  return dados as T;
}

/** Envia a foto tirada ou escolhida no aparelho; a resposta traz o id para o pedido. */
export async function enviarImagem(
  uri: string,
  contexto: 'receita' | 'comprovante' | 'documento',
): Promise<{ id: string; url: string }> {
  const token = await lerToken();
  const formulario = new FormData();
  formulario.append('contexto', contexto);
  // O React Native aceita o arquivo como { uri, name, type } no FormData.
  formulario.append('arquivo', { uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_DA_API}/api/app/v1/uploads`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formulario,
    });
  } catch {
    throw new ErroDaApi('Sem conexão. Confira a internet e tente de novo.', 0, 'SEM_CONEXAO');
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroDaApi(
      dados?.erro ?? 'Não deu para enviar a foto.',
      resposta.status,
      dados?.codigo,
    );
  }
  return dados;
}

export function urlDaImagem(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${URL_DA_API}${url}`;
}
