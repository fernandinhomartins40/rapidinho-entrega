'use client';

import { startTransition, useActionState, useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Alert, Button, Card, CardContent, ConfirmacaoPorSms, Input, Label } from '@rapidinho/ui';
import { formatPhoneBR, maskPhoneBR } from '@rapidinho/shared';
import { autenticar, conferirSms } from './actions';
import { LOGIN_INITIAL_STATE } from './login-state';

/**
 * Login em duas etapas: telefone e código.
 *
 * Sem senha de propósito — o cliente esquece senha, não esquece o celular.
 */
export function LoginForm({
  destino,
  porSms = false,
  canal,
}: {
  destino: string;
  porSms?: boolean;
  canal: 'SMS' | 'WhatsApp';
}) {
  const [state, enviar, enviando] = useActionState(autenticar, LOGIN_INITIAL_STATE);
  const [phone, setPhone] = useState('');
  const conferir = useCallback(() => conferirSms(destino), [destino]);

  if (state.step === 'sms' && state.sms && state.phone) {
    return (
      <ConfirmacaoPorSms
        telefone={formatPhoneBR(state.phone)}
        numero={state.sms.numero}
        texto={state.sms.texto}
        link={state.sms.link}
        conferir={conferir}
        aoTrocarTelefone={() => {
          const dados = new FormData();
          dados.set('intencao', 'trocar-telefone');
          startTransition(() => enviar(dados));
        }}
      />
    );
  }

  if (state.step === 'phone') {
    return (
      <Card>
        <CardContent className="pt-5">
          <form action={enviar} className="space-y-4">
            <div>
              <Label htmlFor="phone" required>
                Seu telefone
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(44) 99999-0000"
                value={phone}
                onChange={(event) => setPhone(maskPhoneBR(event.target.value))}
                autoFocus
                required
              />
              <p className="text-muted-foreground mt-1.5 text-sm">
                {porSms
                  ? 'Você confirma com um SMS enviado do seu celular.'
                  : `Enviamos um código por ${canal}.`}
              </p>
            </div>

            {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

            <Button type="submit" block isLoading={enviando}>
              {porSms ? 'Continuar' : 'Receber código'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="destino" value={destino} />

          <div>
            <Label htmlFor="code" required>
              Código de 6 números
            </Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
              required
            />
            <p className="text-muted-foreground mt-1.5 text-sm">
              Enviado para {state.phone ? formatPhoneBR(state.phone) : 'o seu celular'}
            </p>
          </div>

          {state.devCode ? (
            <Alert variant="warning" title="Modo de desenvolvimento">
              {/* O teste de ponta a ponta lê o código daqui, que é o mesmo
                  caminho de uma pessoa — não há atalho pelo banco. */}
              Código: <strong data-testid="codigo-dev">{state.devCode}</strong>
            </Alert>
          ) : null}

          {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

          <Button type="submit" name="intencao" value="verificar" block isLoading={enviando}>
            Entrar
          </Button>

          <BotaoReenviar telefone={state.phone ?? ''} reiniciar={state} />

          <Button type="submit" name="intencao" value="trocar-telefone" variant="ghost" block>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Usar outro telefone
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const ESPERA_PARA_REENVIAR = 60;

/**
 * "Não chegou?": pede outro código para o mesmo número. A espera evita o
 * toque repetido (cada código é um SMS pago); o limite por telefone do
 * servidor continua valendo. `reiniciar` muda a cada resposta da ação, e a
 * contagem recomeça depois de cada envio.
 */
function BotaoReenviar({ telefone, reiniciar }: { telefone: string; reiniciar: unknown }) {
  const [restante, setRestante] = useState(ESPERA_PARA_REENVIAR);

  useEffect(() => {
    setRestante(ESPERA_PARA_REENVIAR);
    const relogio = setInterval(() => setRestante((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(relogio);
  }, [reiniciar]);

  return (
    <>
      <input type="hidden" name="phone" value={telefone} />
      <Button
        type="submit"
        name="intencao"
        value="reenviar"
        variant="outline"
        block
        formNoValidate
        disabled={restante > 0}
      >
        {restante > 0 ? `Reenviar código em ${restante}s` : 'Reenviar código'}
      </Button>
    </>
  );
}
