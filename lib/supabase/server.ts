import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { fetchConReintento } from './reintento'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: fetchConReintento() },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // En un Server Component no se pueden escribir cookies; el proxy ya refresca la sesión.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}
