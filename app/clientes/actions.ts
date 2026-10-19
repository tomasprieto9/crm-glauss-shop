'use server'

import { revalidatePath } from 'next/cache'
import { CONSENTIMIENTOS, ESTADOS_CAMPANA, SEGMENTOS, ZONAS, normalizarTelefono, type CambiosCliente } from '@/lib/clientes'
import { createClient } from '@/lib/supabase/server'

export async function actualizarCliente(id: string, cambios: CambiosCliente) {
  const datos: CambiosCliente = {}
  if (cambios.notas !== undefined) datos.notas = cambios.notas?.trim().slice(0, 2000) || null
  if (cambios.edad_verificada !== undefined) datos.edad_verificada = cambios.edad_verificada === true
  if (cambios.consentimiento !== undefined) {
    if (!Object.hasOwn(CONSENTIMIENTOS, cambios.consentimiento)) return 'Valor de consentimiento inválido.'
    datos.consentimiento = cambios.consentimiento
  }
  if (cambios.estado_campana !== undefined) {
    if (!Object.hasOwn(ESTADOS_CAMPANA, cambios.estado_campana)) return 'Estado de campaña inválido.'
    datos.estado_campana = cambios.estado_campana
  }
  if (Object.keys(datos).length === 0) return null

  const supabase = await createClient()
  const { data, error } = await supabase.from('clientes').update(datos).eq('id', id).select('id')
  if (error) return 'No se pudo guardar. Probá de nuevo.'
  if (data.length === 0) return 'No se pudo guardar: el cliente no existe o se venció tu sesión.'
  revalidatePath('/')
  return null
}

export async function crearCliente(formData: FormData) {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const telefono = normalizarTelefono(String(formData.get('telefono') ?? ''))
  const segmento = String(formData.get('segmento') ?? '')
  const zona = String(formData.get('zona') ?? '')
  const notas = String(formData.get('notas') ?? '').trim()
  if (formData.get('mayor_de_18') !== 'si') return 'Solo se cargan clientes mayores de 18 años.'
  if (!nombre) return 'Falta el nombre.'
  if (!telefono) return 'Revisá el teléfono: con código de área, sin 0 ni 15 (ej. 221 438 3399), o con + y código de país.'
  if (!Object.hasOwn(SEGMENTOS, segmento)) return 'Elegí un segmento.'
  if (zona && !Object.hasOwn(ZONAS, zona)) return 'Zona inválida.'

  const supabase = await createClient()
  const { error } = await supabase.from('clientes').insert({ nombre, telefono, segmento, zona: zona || null, notas: notas.slice(0, 2000) || null })
  if (error?.code === '23505') return 'Ya hay un cliente con ese teléfono.'
  if (error) return 'No se pudo guardar. Probá de nuevo.'
  revalidatePath('/')
  return null
}
