import { invokeEdgeFunction } from '../lib/invokeEdgeFn';

export interface ToggleUserActiveTarget {
  id: string;
  active?: boolean | null;
}

/**
 * Inverte o estado de ativação de um usuário do sistema.
 *
 * A operação inteira (banimento no Auth + escrita atômica em profiles e
 * drivers) acontece dentro da Edge Function `create-user`, ação `set_active`.
 * Este serviço não escreve no banco diretamente: fazê-lo reintroduziria o
 * estado parcial que a ação transacional existe para eliminar.
 */
export async function toggleUserActive(target: ToggleUserActiveTarget): Promise<void> {
  const nextActive = target.active === false;

  await invokeEdgeFunction('create-user', {
    action: 'set_active',
    user_id: target.id,
    active: nextActive,
  });
}
