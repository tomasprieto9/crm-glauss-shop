'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function guardarCotizacion(pesosPorDolar: number) {
  const valor = Number(pesosPorDolar)
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) return 'Escribí cuántos pesos vale 1 dólar (ej. 1400).'
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('configuracion')
    .update({ cotizacion_usd: Math.round(valor * 100) / 100, actualizada_en: new Date().toISOString() })
    .eq('id', 1)
    .select('id')
  if (error || data.length === 0) return 'No se pudo guardar la cotización. Probá de nuevo.'
  revalidatePath('/')
  return null
}

export async function guardarStockBajo(unidades: number) {
  const valor = Number(unidades)
  if (!Number.isInteger(valor) || valor < 0 || valor > 1000) return 'Escribí un número de unidades (ej. 4).'
  const supabase = await createClient()
  const { data, error } = await supabase.from('configuracion').update({ stock_bajo: valor, actualizada_en: new Date().toISOString() }).eq('id', 1).select('id')
  if (error || data.length === 0) return 'No se pudo guardar. Probá de nuevo.'
  revalidatePath('/')
  return null
}
