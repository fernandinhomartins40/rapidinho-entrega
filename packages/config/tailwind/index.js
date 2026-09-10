/**
 * Preset Tailwind compartilhado (design tokens do Rapidinho Entrega).
 *
 * Público-alvo inclui celular antigo e usuário pouco familiarizado com apps:
 * a escala de fonte parte de 16px e os alvos de toque mínimos são 44px.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Cores da identidade visual. `deep`/`deeper` são o navy do contorno
        // do logotipo e cobrem as superfícies grandes; `amber` e `flame` vêm
        // do símbolo e do rastro de velocidade; `tint` é o âmbar claro que
        // fica legível sobre o navy.
        brand: {
          deep: 'hsl(var(--brand-deep))',
          deeper: 'hsl(var(--brand-deeper))',
          tint: 'hsl(var(--brand-tint))',
          amber: 'hsl(var(--brand-amber))',
          flame: 'hsl(var(--brand-flame))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing: {
        touch: '2.75rem',
      },
      minHeight: {
        touch: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      backgroundImage: {
        // Trama de pontos e brilho radial do hero: puro CSS, zero requisição
        // extra — o público está em 3G.
        'dot-grid':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
        'radial-glow':
          'radial-gradient(ellipse 70% 55% at 15% 0%, rgba(255,176,0,0.3), transparent 70%)',
        // Degradê âmbar→laranja do logotipo, para botões e detalhes.
        'brand-gradient': 'linear-gradient(105deg, hsl(45 100% 52%), hsl(24 100% 50%))',
      },
      backgroundSize: {
        'dot-grid': '22px 22px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-alert': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-alert': 'pulse-alert 1s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
