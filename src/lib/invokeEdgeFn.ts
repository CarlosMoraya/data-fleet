import { supabase } from './supabase';

/**
 * Invokes a Supabase Edge Function with the current user's session.
 * @param fnName - The function name (e.g., 'create-driver-user')
 * @param body - The JSON body to send
 * @returns Parsed JSON response from the edge function
 */
export async function invokeEdgeFunction(fnName: string, body: object): Promise<any> {
  // Force a session refresh to avoid stale/expired tokens
  const { data: { session } } = await supabase.auth.refreshSession();
  if (!session) throw new Error('Sessão expirada. Faça login novamente.');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Edge function error: ${res.status} ${errorText}`);
  }

  return res.json();
}
