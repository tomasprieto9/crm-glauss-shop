'use server'

import { revalidatePath } from 'next/cache'
import { normalizarTelefono } from '@/lib/clientes'
import { createClient } from '@/lib/supabase/server'
import { METODOS_PAGO, hoyEnArgentina, type ItemVenta, type NuevaVenta } from '@/lib/ventas'

export async function registrarVenta(venta: NuevaVenta) {
  if (venta.dniVerificado !== true) return 'Para registrar la venta tenés que verificar el DNI (mayor de 18).'
  if (!Object.hasOwn(METODOS_PAGO, venta.metodoPago)) return 'Elegí el método de pago.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venta.fecha) || venta.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  if (!Array.isArray(venta.items) || venta.items.length === 0) return 'Agregá al menos un producto.'
  if (venta.items.length > 50) return 'Una venta puede tener hasta 50 productos.'

  const items: ItemVenta[] = []
  for (const item of venta.items) {
    const descripcion = String(item.descripcion ?? '').trim().slice(0, 200)
    const cantidad = Number(item.cantidad)
    const precio = Number(item.precio_unitario)
    if (!descripcion) return 'A cada producto le falta escribir qué es.'
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) return `Revisá la cantidad de "${descripcion}".`
    if (!Number.isFinite(precio) || precio < 0 || precio > 100_000_000) return `Revisá el precio de "${descripcion}".`
    items.push({ descripcion, cantidad, precio_unitario: Math.round(precio * 100) / 100 })
  }

  let nuevoNombre: string | null = null
  let nuevoTelefono: string | null = null
  if (!venta.clienteId) {
    nuevoNombre = String(venta.nuevoNombre ?? '').trim().slice(0, 200)
    if (!nuevoNombre) return 'Elegí un cliente o cargá el nombre del cliente nuevo.'
    nuevoTelefono = normalizarTelefono(String(venta.nuevoTelefono ?? ''))
    if (!nuevoTelefono) return 'Revisá el teléfono del cliente nuevo: con código de área, sin 0 ni 15 (ej. 221 438 3399).'
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_venta', {
    p_cliente_id: venta.clienteId || null,
    p_nuevo_nombre: nuevoNombre,
    p_nuevo_telefono: nuevoTelefono,
    p_fecha: venta.fecha,
    p_metodo_pago: venta.metodoPago,
    p_items: items,
  })
  if (error?.code === '23505') return 'Ya hay un cliente con ese teléfono: buscalo por nombre o teléfono.'
  if (error) return 'No se pudo registrar la venta. Probá de nuevo.'
  revalidatePath('/')
  return null
}
