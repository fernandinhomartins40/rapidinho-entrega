import { CascaDoApp } from '@/components/app/casca-do-app';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CascaDoApp>{children}</CascaDoApp>;
}
