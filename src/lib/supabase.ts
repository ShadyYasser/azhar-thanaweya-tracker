import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing (copy .env.example to .env).');
}

// PKCE puts the auth code in ?code=… so it never collides with the hash router.
export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const siteUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;

// A password-reset link signs the user in and fires PASSWORD_RECOVERY while the client
// initializes, possibly before React subscribes, so remember it from module load.
let recoveryPending = false;
const recoveryListeners = new Set<() => void>();
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryPending = true;
    recoveryListeners.forEach((fn) => fn());
  }
});

export function isRecoveryPending(): boolean {
  return recoveryPending;
}

export function onRecovery(fn: () => void): () => void {
  recoveryListeners.add(fn);
  return () => recoveryListeners.delete(fn);
}

export function clearRecovery(): void {
  recoveryPending = false;
}

// PostgREST returns at most 1000 rows per request; page through larger results.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
