'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function iniciarSesion(_error: string | null, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return 'Completá el email y la contraseña.'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'invalid_credentials') return 'El email o la contraseña no son correctos.'
    if (error.code === 'email_not_confirmed') return 'Este usuario todavía no está confirmado.'
    if (error.status === 429) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
    return 'No se pudo iniciar sesión. Probá de nuevo en un rato.'
  }
  redirect('/')
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
