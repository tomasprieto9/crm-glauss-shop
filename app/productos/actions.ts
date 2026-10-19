'use server'

import { revalidatePath } from 'next/cache'
import type { NuevaCompra } from '@/lib/productos'
import { createClient } from '@/lib/supabase/server'
import { hoyEnArgentina } from '@/lib/ventas'

const leerPrecio = (formData: FormData, campo: string) => {
  const texto = String(formData.get(campo) ?? '').trim().replace(',', '.')
  return texto === '' ? null : Number(texto)
}
const precioValido = (precio: number | null) => precio === null || (Number.isFinite(precio) && precio >= 0 && precio <= 100_000_000)
const redondear = (precio: number | null) => precio === null ? null : Math.round(precio * 100) / 100

// Crea un producto o, si viene id, lo actualiza. Los sabores llegan uno por renglón: los nuevos se
// agregan y los que se sacan quedan inactivos (conservan su historial de stock y ventas).
export async function guardarProducto(id: string | null, formData: FormData) {
  const marca = String(formData.get('marca') ?? '').trim().slice(0, 100)
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200)
  const efectivo = leerPrecio(formData, 'precio_efectivo')
  const transferencia = leerPrecio(formData, 'precio_transferencia')
  const usd = leerPrecio(formData, 'precio_usd')
  const promo = leerPrecio(formData, 'promo_x3')
  const sabores = [...new Set(String(formData.get('sabores') ?? '').split('\n').map(sabor => sabor.trim().slice(0, 100)).filter(Boolean))]
  if (!marca) return 'Falta la marca.'
  if (!nombre) return 'Falta el nombre del producto.'
  if (efectivo === null || transferencia === null) return 'Faltan los precios en efectivo y transferencia.'
  if (![efectivo, transferencia, usd, promo].every(precioValido)) return 'Revisá los precios.'
  if (sabores.length === 0) return 'Cargá al menos un sabor (uno por renglón).'
  if (sabores.length > 200) return 'Hay demasiados sabores.'

  const datos = { marca, nombre, precio_efectivo: redondear(efectivo), precio_transferencia: redondear(transferencia), precio_usd: redondear(usd), promo_x3: redondear(promo) }
  const supabase = await createClient()
  const guardado = id
    ? await supabase.from('productos').update(datos).eq('id', id).select('id').single()
    : await supabase.from('productos').insert(datos).select('id').single()
  if (guardado.error?.code === '23505') return 'Ya existe un producto con esa marca y ese nombre.'
  if (guardado.error) return 'No se pudo guardar el producto. Probá de nuevo.'
  const productoId = guardado.data.id

  const { data: existentes, error } = await supabase.from('sabores').select('id, nombre, activo').eq('producto_id', productoId)
  if (error) return 'Se guardó el producto, pero no los sabores. Probá de nuevo.'
  const porNombre = new Map(existentes.map(sabor => [sabor.nombre, sabor]))
  const nuevos = sabores.filter(sabor => !porNombre.has(sabor)).map(sabor => ({ producto_id: productoId, nombre: sabor }))
  const activar = existentes.filter(sabor => !sabor.activo && sabores.includes(sabor.nombre)).map(sabor => sabor.id)
  const desactivar = existentes.filter(sabor => sabor.activo && !sabores.includes(sabor.nombre)).map(sabor => sabor.id)
  const resultados = await Promise.all([
    nuevos.length ? supabase.from('sabores').insert(nuevos) : null,
    activar.length ? supabase.from('sabores').update({ activo: true }).in('id', activar) : null,
    desactivar.length ? supabase.from('sabores').update({ activo: false }).in('id', desactivar) : null,
  ])
  if (resultados.some(resultado => resultado?.error)) return 'Se guardó el producto, pero no todos los sabores. Probá de nuevo.'
  revalidatePath('/')
  return null
}

export async function registrarCompra(compra: NuevaCompra) {
  if (typeof compra.productoId !== 'string' || !compra.productoId) return 'Elegí el producto.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compra.fecha) || compra.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  const costo = Number(compra.costoUnitarioUsd)
  if (!Number.isFinite(costo) || costo < 0 || costo > 1_000_000) return 'Revisá el costo por unidad en dólares.'
  const items = (Array.isArray(compra.items) ? compra.items : []).map(item => ({ sabor_id: String(item.sabor_id), cantidad: Number(item.cantidad) }))
  if (items.length === 0) return 'Cargá la cantidad de al menos un sabor.'
  if (items.some(item => !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 100_000)) return 'Revisá las cantidades.'

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_compra', {
    p_producto_id: compra.productoId,
    p_fecha: compra.fecha,
    p_costo_unitario_usd: Math.round(costo * 100) / 100,
    p_notas: String(compra.notas ?? '').slice(0, 500),
    p_items: items,
  })
  if (error?.code === 'P0001') return error.message
  if (error) return 'No se pudo registrar el ingreso. Probá de nuevo.'
  revalidatePath('/')
  return null
}
