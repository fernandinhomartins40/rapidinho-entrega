'use client';

import { useActionState, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Alert, Button, Card, CardContent, Input, Label } from '@rapidinho/ui';
import { maskPhoneBR } from '@rapidinho/shared';
import { autenticar } from './actions';
import { LOGIN_INITIAL_STATE } from './login-state';

/**
 * Login em duas etapas: telefone e código.
 *
 * Sem senha de propósito — o lojista esquece senha, não esquece o WhatsApp.
 */
export function LoginForm({ destino }: { destino: string }) {
  const [state, enviar, enviando] = useActionState(autenticar, LOGIN_INITIAL_STATE);
  const [phone, setPhone] = useState('');

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
                Enviamos um código pelo WhatsApp.
              </p>
            </div>

            {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

            <Button type="submit" block isLoading={enviando}>
              Receber código
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
            <p className="text-muted-foreground mt-1.5 text-sm">Enviado para {state.phone}</p>
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

          <Button type="submit" name="intencao" value="trocar-telefone" variant="ghost" block>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Usar outro telefone
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
