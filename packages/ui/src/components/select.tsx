import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Select nativo, de propósito.
 *
 * O do Radix é mais bonito, mas o nativo abre a roda de seleção do Android e
 * do iOS — que o público conhece, funciona sem JavaScript e é bem mais leve
 * em celular antigo.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <>
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'border-input bg-background focus-visible:ring-ring flex h-12 w-full rounded-lg border-2 px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p id={errorId} className="text-destructive mt-1.5 text-sm font-medium">
            {error}
          </p>
        ) : null}
      </>
    );
  },
);
Select.displayName = 'Select';

export { Select };
