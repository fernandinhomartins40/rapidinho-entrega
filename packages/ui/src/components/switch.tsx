'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'focus-visible:ring-ring data-[state=checked]:bg-success data-[state=unchecked]:bg-input peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="bg-background pointer-events-none block h-6 w-6 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

/**
 * Interruptor com rótulo clicável.
 *
 * O primitivo do Radix é só o controle. Este embrulho existe para que o texto
 * inteiro seja área de toque — num celular, acertar um botão de 12px de altura
 * com o polegar é o tipo de detalhe que faz o lojista desistir da tela.
 */
export interface SwitchFieldProps extends React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
> {
  label: string;
  description?: string;
}

const SwitchField = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchFieldProps
>(({ label, description, className, id, ...props }, ref) => {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Switch ref={ref} id={switchId} className="mt-0.5" {...props} />
      <label htmlFor={switchId} className="min-h-touch flex-1 cursor-pointer select-none">
        <span className="block font-medium leading-tight">{label}</span>
        {description ? (
          <span className="text-muted-foreground mt-0.5 block text-sm">{description}</span>
        ) : null}
      </label>
    </div>
  );
});
SwitchField.displayName = 'SwitchField';

export { Switch, SwitchField };
