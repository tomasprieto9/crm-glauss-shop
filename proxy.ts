import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Valida la sesión (y la refresca si venció). No poner código entre createServerClient y esta llamada.
  const { data } = await supabase.auth.getClaims()
  const logueado = Boolean(data?.claims)
  const enLogin = request.nextUrl.pathname === '/login'

  if (!logueado && !enLogin) return redirigir(request, response, '/login')
  if (logueado && enLogin) return redirigir(request, response, '/')
  return response
}

function redirigir(request: NextRequest, response: NextResponse, pathname: string) {
  const destino = request.nextUrl.clone()
  destino.pathname = pathname
  destino.search = ''
  const redireccion = NextResponse.redirect(destino)
  // Conserva las cookies de sesión que Supabase haya actualizado en este request.
  response.cookies.getAll().forEach(cookie => redireccion.cookies.set(cookie))
  return redireccion
}

export const config = {
  // Todo salvo los archivos internos de Next, el manifiesto de la app y las imágenes/íconos de /public.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
