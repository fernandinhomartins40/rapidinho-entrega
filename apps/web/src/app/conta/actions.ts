'use server';

import { redirect } from 'next/navigation';
import { destroyCurrentSession } from '@rapidinho/auth';

/** Encerra a sessão e apaga o registro no banco, não só o cookie. */
export async function sair() {
  await destroyCurrentSession();
  redirect('/');
}
