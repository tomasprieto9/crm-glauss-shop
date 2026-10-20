'use server'

import { revalidatePath } from 'next/cache'
import { normalizarTelefono } from '@/lib/clientes'
import { createClient } from '@/lib/supabase/server'
import { METODOS_PAGO, RECIBIO, hoyEnArgentina, type NuevaVenta } from '@/lib/ventas'

// Valida una venta (nueva o editada) y arma los parámetros de registrar_venta / editar_venta.
function validarVenta(venta: NuevaVenta) {
  if (!Object.hasOwn(METODOS_PAGO, venta.metodoPago)) return { error: 'Elegí el método de pago.' }
  if (!Object.hasOwn(RECIBIO, venta.recibio)) return { error: 'Elegí quién recibió el pago.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venta.fecha) || venta.fecha > hoyEnArgentina()) return { error: 'Revisá la fecha: no puede ser posterior a hoy.' }
  if (!Array.isArray(venta.items) || venta.items.length === 0) return { error: 'Agregá al menos un producto.' }
  if (venta.items.length > 50) return { error: 'Una venta puede tener hasta 50 productos.' }

  const items = []
  for (const item of venta.items) {
    const cantidad = Number(item.cantidad)
    if (typeof item.sabor_id !== 'string' || !item.sabor_id) return { error: 'Elegí marca, producto y sabor en cada línea.' }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) return { error: 'Revisá las cantidades.' }
    items.push({ sabor_id: item.sabor_id, cantidad })
  }

  let total: number | null = null
  if (venta.total !== null) {
    total = Number(venta.total)
    if (!Number.isFinite(total) || total < 0 || total > 100_000_000) return { error: 'Revisá el total cobrado.' }
    total = Math.round(total * 100) / 100
  }

  let nuevoNombre: string | null = null
  let nuevoTelefono: string | null = null
  if (!venta.clienteId) {
    nuevoNombre = String(venta.nuevoNombre ?? '').trim().slice(0, 200)
    if (!nuevoNombre) return { error: 'Elegí un cliente o cargá el nombre del cliente nuevo.' }
    nuevoTelefono = normalizarTelefono(String(venta.nuevoTelefono ?? ''))
    if (!nuevoTelefono) return { error: 'Revisá el teléfono del cliente nuevo: con código de área, sin 0 ni 15 (ej. 221 438 3399).' }
  }

  return {
    parametros: {
      p_cliente_id: venta.clienteId || null,
      p_nuevo_nombre: nuevoNombre,
      p_nuevo_telefono: nuevoTelefono,
      p_fecha: venta.fecha,
      p_metodo_pago: venta.metodoPago,
      p_recibio: venta.recibio,
      p_total: total,
      p_items: items,
    },
  }
}

async function guardar(funcion: 'registrar_venta' | 'editar_venta', parametros: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.rpc(funcion, parametros)
  if (error?.code === '23505') return 'Ya hay un cliente con ese teléfono: buscalo por nombre o teléfono.'
  if (error?.code === 'P0001') return error.message // mensajes propios de la base, en español
  if (error) return 'No se pudo guardar la venta. Probá de nuevo.'
  revalidatePath('/')
  return null
}

export async function registrarVenta(venta: NuevaVenta) {
  const validada = validarVenta(venta)
  if ('error' in validada) return validada.error ?? 'Revisá la venta.'
  return guardar('registrar_venta', validada.parametros)
}

export async function editarVenta(ventaId: string, venta: NuevaVenta) {
  if (typeof ventaId !== 'string' || !ventaId) return 'No se encontró la venta.'
  const validada = validarVenta(venta)
  if ('error' in validada) return validada.error ?? 'Revisá la venta.'
  return guardar('editar_venta', { p_venta_id: ventaId, ...validada.parametros })
}
