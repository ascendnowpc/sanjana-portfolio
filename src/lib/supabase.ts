/**
 * A ~40-line PostgREST client, so the project has zero runtime dependencies
 * on a database until one is actually configured.
 *
 * If you would rather use the official SDK, `npm i @supabase/supabase-js` and
 * replace the body of `sbSelect` with a `supabase.from(table).select(...)`
 * call — nothing else in the codebase needs to change.
 *
 * See DATABASE.md for the full setup, and supabase/schema.sql for the tables.
 */

const URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Whether the app should attempt remote reads at all. */
export const isSupabaseConfigured = Boolean(URL && KEY)

export async function sbSelect<T>(
  table: string,
  query: Record<string, string> = {},
): Promise<T[]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const params = new URLSearchParams({ select: '*', ...query })
  const res = await fetch(`${URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: KEY as string,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Supabase ${table} -> ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T[]
}
