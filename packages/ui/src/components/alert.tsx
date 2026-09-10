import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Aviso inline.
 *
 * O painel usa aviso junto do formulário em vez de toast flutuante: o toast
 * some antes de quem lê devagar terminar, e some sem deixar rastro para quem
 * usa leitor de tela.
 */
const alertVariants = cva('flex items-start gap-3 rounded-lg border-2 p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-input bg-muted/50 text-foreground',
      success: 'border-success/40 bg-success/10 text-foreground',
      warning: 'border-warning/50 bg-warning/10 text-foreground',
      destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

function Alert({ className, variant, title, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? 'info'];

  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  );
}

export { Alert, alertVariants };
