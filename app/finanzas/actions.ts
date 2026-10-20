'use server'

import { revalidatePath } from 'next/cache'
import { CATEGORIAS_EGRESO, TIPOS_MOVIMIENTO, type NuevoMovimiento } from '@/lib/finanzas'
import { createClient } from '@/lib/supabase/server'
import { METODOS_PAGO, RECIBIO, hoyEnArgentina } from '@/lib/ventas'

const montoValido = (monto: unknown) => typeof monto === 'number' && Number.isFinite(monto) && monto > 0 && monto <= 1_000_000_000
const redondear = (monto: number) => Math.round(monto * 100) / 100

export async function registrarMovimiento(movimiento: NuevoMovimiento) {
  const { tipo } = movimiento
  if (!Object.hasOwn(TIPOS_MOVIMIENTO, tipo) || tipo === 'ajuste') return 'Tipo de movimiento inválido.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movimiento.fecha) || movimiento.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  if (!Object.hasOwn(RECIBIO, movimiento.persona) || !Object.hasOwn(METODOS_PAGO, movimiento.medio)) return 'Elegí de qué caja sale (persona y medio).'
  if (!montoValido(movimiento.monto)) return 'Revisá el monto.'
  if (tipo === 'egreso' && !Object.hasOwn(CATEGORIAS_EGRESO, movimiento.categoria ?? '')) return 'Elegí la categoría del egreso.'

  const datos: Record<string, unknown> = {
    tipo,
    fecha: movimiento.fecha,
    persona: movimiento.persona,
    medio: movimiento.medio,
    monto: redondear(movimiento.monto),
    categoria: tipo === 'egreso' ? movimiento.categoria : null,
    descripcion: String(movimiento.descripcion ?? '').trim().slice(0, 300) || null,
  }
  if (tipo === 'pase') {
    if (!Object.hasOwn(RECIBIO, movimiento.destinoPersona ?? '') || !Object.hasOwn(METODOS_PAGO, movimiento.destinoMedio ?? '')) return 'Elegí a qué caja va la plata.'
    if (movimiento.destinoPersona === movimiento.persona && movimiento.destinoMedio === movimiento.medio) return 'La caja de origen y la de destino son la misma.'
    // Si no cambia de moneda llega lo mismo que sale; si pasa de pesos a dólares (o al revés), se indica lo que llega.
    const cambiaMoneda = (movimiento.medio === 'dolares') !== (movimiento.destinoMedio === 'dolares')
    const llega = cambiaMoneda ? movimiento.montoDestino : movimiento.monto
    if (!montoValido(llega)) return 'Indicá cuánto llega en la otra moneda.'
    Object.assign(datos, { destino_persona: movimiento.destinoPersona, destino_medio: movimiento.destinoMedio, monto_destino: redondear(llega as number) })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('movimientos_caja').insert(datos)
  if (error) return 'No se pudo registrar. Probá de nuevo.'
  revalidatePath('/')
  return null
}

export async function borrarMovimiento(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('movimientos_caja').delete().eq('id', id).select('id')
  if (error || data.length === 0) return 'No se pudo borrar.'
  revalidatePath('/')
  return null
}

// Devuelve la diferencia registrada (contado - calculado) o un mensaje de error.
export async function registrarArqueo(persona: string, medio: string, contado: number, nota: string) {
  if (!Object.hasOwn(RECIBIO, persona) || !Object.hasOwn(METODOS_PAGO, medio)) return { error: 'Elegí la caja.' }
  if (typeof contado !== 'number' || !Number.isFinite(contado) || contado < 0 || contado > 1_000_000_000) return { error: 'Revisá cuánto contaste.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_arqueo', { p_persona: persona, p_medio: medio, p_contado: redondear(contado), p_nota: String(nota ?? '').slice(0, 300) })
  if (error) return { error: 'No se pudo registrar el arqueo. Probá de nuevo.' }
  revalidatePath('/')
  return { diferencia: Number(data) }
}
