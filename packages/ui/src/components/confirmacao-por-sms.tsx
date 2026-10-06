'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, MessageSquareText } from 'lucide-react';
import { Alert } from './alert';
import { Button } from './button';
import { Card, CardContent } from './card';

export type ResultadoDaConferencia =
  { status: 'ok'; destino: string } | { status: 'aguardando' } | { status: 'erro'; reason: string };

interface Props {
  /** Telefone que está entrando, já formatado. */
  telefone: string;
  /** Número que recebe o SMS, formatado para exibir. */
  numero: string;
  /** Texto exato do SMS. */
  texto: string;
  /** `sms:` com destinatário e texto preenchidos. */
  link: string;
  /** Server Action que pergunta se o SMS já chegou. */
  conferir: () => Promise<ResultadoDaConferencia>;
  /** Volta para a etapa do telefone. */
  aoTrocarTelefone: () => void;
}

/** De quanto em quanto tempo a tela pergunta se o SMS chegou. */
const INTERVALO_MS = 2500;

/**
 * Confirmação do telefone por SMS enviado PELO cliente.
 *
 * Um toque abre o app de mensagens com tudo preenchido; o cliente só aperta
 * enviar. A tela fica perguntando ao servidor e entra sozinha quando o SMS
 * chega — não há código para digitar.
 *
 * O SMS sai do plano do cliente como um SMS comum. No computador, onde o link
 * não abre nada, a tela mostra número e texto para enviar pelo celular.
 */
export function ConfirmacaoPorSms({
  telefone,
  numero,
  texto,
  link,
  conferir,
  aoTrocarTelefone,
}: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [tocouEmEnviar, setTocouEmEnviar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const conferindo = useRef(false);

  useEffect(() => {
    let ativo = true;

    const intervalo = setInterval(async () => {
      // Uma pergunta por vez: rede lenta não pode empilhar consultas.
      if (conferindo.current || !ativo) return;
      conferindo.current = true;
      try {
        const resultado = await conferir();
        if (!ativo) return;
        if (resultado.status === 'ok') {
          clearInterval(intervalo);
          // Recarga completa: a sessão nova está num cookie, e as telas
          // seguintes precisam ser montadas já com ela.
          window.location.assign(resultado.destino);
        } else if (resultado.status === 'erro') {
          clearInterval(intervalo);
          setErro(resultado.reason);
        }
      } catch {
        // Rede caiu por um instante: a próxima volta tenta de novo.
      } finally {
        conferindo.current = false;
      }
    }, INTERVALO_MS);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [conferir]);

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="font-semibold">Confirme que o número é seu</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Envie um SMS do celular {telefone}. É um SMS comum, do seu plano — e a tela entra
            sozinha assim que ele chegar.
          </p>
        </div>

        {erro ? (
          <Alert variant="destructive">{erro}</Alert>
        ) : (
          <>
            <Button asChild block size="lg">
              <a href={link} onClick={() => setTocouEmEnviar(true)}>
                <MessageSquareText className="h-5 w-5" aria-hidden />
                Enviar SMS de confirmação
              </a>
            </Button>

            <div className="bg-secondary space-y-1 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Ou envie você mesmo:</p>
              <p>
                Para: <strong>{numero}</strong>
              </p>
              <p className="flex flex-wrap items-center gap-2">
                Texto: <strong className="tracking-wide">{texto}</strong>
                <button
                  type="button"
                  onClick={copiarTexto}
                  className="text-muted-foreground inline-flex items-center gap-1 text-xs underline"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </p>
            </div>

            <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
              <span className="bg-primary inline-block h-2 w-2 animate-pulse rounded-full" />
              {tocouEmEnviar
                ? 'Aguardando o SMS chegar… costuma levar alguns segundos.'
                : 'Aguardando o seu SMS…'}
            </p>
          </>
        )}

        <Button type="button" variant="ghost" block onClick={aoTrocarTelefone}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Usar outro telefone
        </Button>
      </CardContent>
    </Card>
  );
}
