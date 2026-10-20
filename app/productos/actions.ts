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

// Un renglón de sabor: "Watermelon Ice" o, con código, "ELF15-02 | Watermelon Ice".
function leerSabores(texto: string) {
  const porNombre = new Map<string, string | null>()
  for (const renglon of texto.split('\n')) {
    const [primero, ...resto] = renglon.split('|')
    const nombre = (resto.length ? resto.join('|') : primero).trim().slice(0, 100)
    const codigo = resto.length ? primero.trim().toUpperCase().slice(0, 40) || null : null
    if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, codigo)
  }
  return porNombre
}

// Crea un producto o, si viene id, lo actualiza. Los sabores llegan uno por renglón: los nuevos se
// agregan y los que se sacan quedan inactivos (conservan su historial de stock y ventas).
export async function guardarProducto(id: string | null, formData: FormData) {
  const marca = String(formData.get('marca') ?? '').trim().slice(0, 100)
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200)
  const efectivo = leerPrecio(formData, 'precio_efectivo')
  const transferencia = leerPrecio(formData, 'precio_transferencia')
  const usd = leerPrecio(formData, 'precio_usd')
  const promo = leerPrecio(formData, 'promo_x3')
  const costo = leerPrecio(formData, 'costo_usd')
  const codigos = leerSabores(String(formData.get('sabores') ?? ''))
  const sabores = [...codigos.keys()]
  if (!marca) return 'Falta la marca.'
  if (!nombre) return 'Falta el nombre del producto.'
  if (efectivo === null || transferencia === null) return 'Faltan los precios en efectivo y transferencia.'
  if (![efectivo, transferencia, usd, promo, costo].every(precioValido)) return 'Revisá los precios y el costo.'
  if (sabores.length === 0) return 'Cargá al menos un sabor (uno por renglón).'
  if (sabores.length > 200) return 'Hay demasiados sabores.'

  const datos = { marca, nombre, precio_efectivo: redondear(efectivo), precio_transferencia: redondear(transferencia), precio_usd: redondear(usd), promo_x3: redondear(promo), costo_usd: redondear(costo) }
  const supabase = await createClient()
  const guardado = id
    ? await supabase.from('productos').update(datos).eq('id', id).select('id').single()
    : await supabase.from('productos').insert(datos).select('id').single()
  if (guardado.error?.code === '23505') return 'Ya existe un producto con esa marca y ese nombre.'
  if (guardado.error) return 'No se pudo guardar el producto. Probá de nuevo.'
  const productoId = guardado.data.id

  const { data: existentes, error } = await supabase.from('sabores').select('id, nombre, codigo, activo').eq('producto_id', productoId)
  if (error) return 'Se guardó el producto, pero no los sabores. Probá de nuevo.'
  const porNombre = new Map(existentes.map(sabor => [sabor.nombre, sabor]))
  const nuevos = sabores.filter(sabor => !porNombre.has(sabor)).map(sabor => ({ producto_id: productoId, nombre: sabor, codigo: codigos.get(sabor) ?? null }))
  const activar = existentes.filter(sabor => !sabor.activo && sabores.includes(sabor.nombre)).map(sabor => sabor.id)
  const desactivar = existentes.filter(sabor => sabor.activo && !sabores.includes(sabor.nombre)).map(sabor => sabor.id)
  // Solo se cambia el código si el renglón trae uno (escribir solo el nombre no borra el código).
  const conCodigoNuevo = existentes.filter(sabor => codigos.get(sabor.nombre) && codigos.get(sabor.nombre) !== sabor.codigo)
  const resultados = await Promise.all([
    nuevos.length ? supabase.from('sabores').insert(nuevos) : null,
    activar.length ? supabase.from('sabores').update({ activo: true }).in('id', activar) : null,
    desactivar.length ? supabase.from('sabores').update({ activo: false }).in('id', desactivar) : null,
    ...conCodigoNuevo.map(sabor => supabase.from('sabores').update({ codigo: codigos.get(sabor.nombre) }).eq('id', sabor.id)),
  ])
  if (resultados.some(resultado => resultado?.error?.code === '23505')) return 'Se guardó el producto, pero algún código de sabor ya lo usa otro sabor.'
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

// Defectuosos (unidades que se descartan) o conteo (se corrige el stock al número contado).
export async function ajustarStock(productoId: string, motivo: 'defectuoso' | 'conteo', items: { sabor_id: string; cantidad: number }[]) {
  if (typeof productoId !== 'string' || !productoId) return 'Elegí el producto.'
  if (motivo !== 'defectuoso' && motivo !== 'conteo') return 'Elegí qué querés registrar.'
  const limpios = (Array.isArray(items) ? items : []).map(item => ({ sabor_id: String(item.sabor_id), cantidad: Number(item.cantidad) }))
  if (limpios.length === 0) return motivo === 'defectuoso' ? 'Cargá cuántas unidades defectuosas hay.' : 'Cargá lo que contaste.'
  if (limpios.some(item => !Number.isInteger(item.cantidad) || item.cantidad < 0 || item.cantidad > 100_000)) return 'Revisá las cantidades.'
  const supabase = await createClient()
  const { error } = await supabase.rpc('ajustar_stock', { p_producto_id: productoId, p_motivo: motivo, p_items: limpios })
  if (error?.code === 'P0001') return error.message
  if (error) return 'No se pudo guardar el ajuste. Probá de nuevo.'
  revalidatePath('/')
  return null
}
