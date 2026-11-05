'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Input, Label, cn } from '@rapidinho/ui';

const MINIMO = 8;

/** Campo de senha com o olho para mostrar o que foi digitado. */
export function CampoDeSenha({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visivel ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisivel((atual) => !atual)}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-12 items-center justify-center"
        aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visivel}
      >
        {visivel ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

const NIVEIS = [
  { rotulo: 'Muito fraca', cor: 'bg-red-500', texto: 'text-red-600' },
  { rotulo: 'Fraca', cor: 'bg-orange-500', texto: 'text-orange-600' },
  { rotulo: 'Média', cor: 'bg-yellow-500', texto: 'text-yellow-700' },
  { rotulo: 'Forte', cor: 'bg-green-500', texto: 'text-green-600' },
  { rotulo: 'Muito forte', cor: 'bg-green-600', texto: 'text-green-700' },
] as const;

/** De 0 a 4. Abaixo do mínimo é sempre "muito fraca", seja qual for a mistura. */
function forcaDaSenha(senha: string): number {
  if (senha.length < MINIMO) return 0;
  let pontos = 1;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;
  return Math.min(pontos, 4);
}

/**
 * Senha nova e a repetição, com a força e a conferência das duas na hora.
 * A validação de verdade continua no servidor; aqui é só para a pessoa ver.
 */
export function CamposDeSenhaNova({
  rotulo = 'Senha nova',
  rotuloDaRepeticao = 'Repita a senha nova',
  erroDaNova,
  erroDaRepeticao,
  autoFocus,
}: {
  rotulo?: string;
  rotuloDaRepeticao?: string;
  erroDaNova?: string;
  erroDaRepeticao?: string;
  autoFocus?: boolean;
}) {
  const [nova, setNova] = useState('');
  const [repeticao, setRepeticao] = useState('');
  const forca = forcaDaSenha(nova);
  const nivel = NIVEIS[forca]!;
  const iguais = repeticao.length > 0 && nova === repeticao;

  return (
    <>
      <div>
        <Label htmlFor="nova" required>
          {rotulo}
        </Label>
        <CampoDeSenha
          id="nova"
          name="nova"
          autoComplete="new-password"
          autoFocus={autoFocus}
          required
          value={nova}
          onChange={(evento) => setNova(evento.target.value)}
        />
        {nova ? (
          <div className="mt-2" aria-live="polite">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((barra) => (
                <span
                  key={barra}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    barra < Math.max(forca, 1) ? nivel.cor : 'bg-muted',
                  )}
                />
              ))}
            </div>
            <p className={cn('mt-1 text-sm font-medium', nivel.texto)}>
              Senha {nivel.rotulo.toLowerCase()}
              {nova.length < MINIMO ? ` — faltam ${MINIMO - nova.length} caracteres` : null}
            </p>
          </div>
        ) : null}
        {erroDaNova ? (
          <p className="text-destructive mt-1.5 text-sm">{erroDaNova}</p>
        ) : (
          <p className="text-muted-foreground mt-1.5 text-sm">
            Pelo menos {MINIMO} caracteres. Misture letras maiúsculas, números e símbolos para ficar
            mais forte.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmacao" required>
          {rotuloDaRepeticao}
        </Label>
        <CampoDeSenha
          id="confirmacao"
          name="confirmacao"
          autoComplete="new-password"
          required
          value={repeticao}
          onChange={(evento) => setRepeticao(evento.target.value)}
        />
        {repeticao ? (
          <p
            className={cn(
              'mt-1.5 flex items-center gap-1 text-sm font-medium',
              iguais ? 'text-green-600' : 'text-destructive',
            )}
            aria-live="polite"
          >
            {iguais ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <X className="h-4 w-4" aria-hidden />
            )}
            {iguais ? 'As duas senhas são iguais' : 'As senhas ainda não são iguais'}
          </p>
        ) : null}
        {erroDaRepeticao ? (
          <p className="text-destructive mt-1.5 text-sm">{erroDaRepeticao}</p>
        ) : null}
      </div>
    </>
  );
}
