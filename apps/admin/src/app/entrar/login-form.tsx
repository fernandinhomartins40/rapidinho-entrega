'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Alert, Button, Card, CardContent, ConfirmacaoPorSms, Input, Label } from '@rapidinho/ui';
import { formatPhoneBR, maskPhoneBR } from '@rapidinho/shared';
import { autenticar, conferirSms } from './actions';
import { LOGIN_INITIAL_STATE } from './login-state';

/**
 * Login em duas etapas: telefone e código.
 *
 * Lojista entra sem senha de propósito — esquece senha, não esquece o
 * WhatsApp. E-mail e senha ficam como alternativa para a equipe da plataforma.
 */
export function LoginForm({ destino, porSms = false }: { destino: string; porSms?: boolean }) {
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

  if (state.step === 'senha') {
    return (
      <Card>
        <CardContent className="pt-5">
          <form action={enviar} className="space-y-4">
            <input type="hidden" name="destino" value={destino} />

            <div>
              <Label htmlFor="email" required>
                E-mail
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                defaultValue={state.email}
                autoFocus={!state.email}
                required
              />
            </div>

            <div>
              <Label htmlFor="senha" required>
                Senha
              </Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                autoFocus={Boolean(state.email)}
                required
              />
            </div>

            {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

            <Button
              type="submit"
              name="intencao"
              value="entrar-com-senha"
              block
              isLoading={enviando}
            >
              Entrar
            </Button>

            <Button
              type="submit"
              name="intencao"
              value="trocar-telefone"
              variant="ghost"
              block
              formNoValidate
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Entrar com telefone
            </Button>
          </form>
        </CardContent>
      </Card>
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
                  : 'Enviamos um código pelo WhatsApp.'}
              </p>
            </div>

            {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

            <Button type="submit" block isLoading={enviando}>
              {porSms ? 'Continuar' : 'Receber código'}
            </Button>
          </form>

          <form action={enviar} className="mt-2">
            <Button type="submit" name="intencao" value="usar-senha" variant="ghost" block>
              Equipe da plataforma? Entrar com e-mail e senha
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
