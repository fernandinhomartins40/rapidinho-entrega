import type { Config } from 'tailwindcss';
import preset from '@rapidinho/config/tailwind';

export default {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
