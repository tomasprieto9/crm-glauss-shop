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

type SaborEnviado = { id: string | null; codigo: string | null; nombre: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

// Sabores del modal: [{ id (si ya existía), codigo, nombre }]. Los renglones sin nombre se ignoran.
function leerSabores(texto: string): SaborEnviado[] | null {
  try {
    const lista: unknown = JSON.parse(texto)
    if (!Array.isArray(lista)) return null
    return lista
      .map(sabor => ({
        id: typeof sabor?.id === 'string' && sabor.id ? sabor.id : null,
        codigo: String(sabor?.codigo ?? '').trim().toUpperCase().slice(0, 40) || null,
        nombre: String(sabor?.nombre ?? '').trim().slice(0, 100),
      }))
      .filter(sabor => sabor.nombre)
  } catch {
    return null
  }
}

function validarSabores(sabores: SaborEnviado[] | null) {
  if (!sabores) return 'No se pudieron leer los sabores. Probá de nuevo.'
  if (sabores.length === 0) return 'Agregá al menos un sabor.'
  if (sabores.length > 200) return 'Hay demasiados sabores.'
  const nombres = sabores.map(sabor => sabor.nombre.toLowerCase())
  if (new Set(nombres).size !== nombres.length) return 'Hay sabores repetidos.'
  const codigos = sabores.map(sabor => sabor.codigo).filter(Boolean)
  if (new Set(codigos).size !== codigos.length) return 'Hay códigos de sabor repetidos.'
  return null
}

function leerPrecios(formData: FormData) {
  const efectivo = leerPrecio(formData, 'precio_efectivo')
  const transferencia = leerPrecio(formData, 'precio_transferencia')
  const usd = leerPrecio(formData, 'precio_usd')
  const promo = leerPrecio(formData, 'promo_x3')
  const costo = leerPrecio(formData, 'costo_usd')
  if (efectivo === null || transferencia === null) return { error: 'Faltan los precios en efectivo y transferencia.' }
  if (![efectivo, transferencia, usd, promo, costo].every(precioValido)) return { error: 'Revisá los precios y el costo.' }
  // La promo es el precio de las 3 unidades juntas: si es menor que una sola, casi seguro faltan ceros.
  if (promo !== null && promo <= efectivo) return { error: 'La promo x3 es el precio de las 3 unidades juntas: tiene que ser mayor que el precio de una. Revisá que no falten ceros.' }
  if (promo !== null && promo >= 3 * transferencia) return { error: 'La promo x3 tiene que ser más barata que comprar 3 sueltos.' }
  return { datos: { precio_efectivo: redondear(efectivo), precio_transferencia: redondear(transferencia), precio_usd: redondear(usd), promo_x3: redondear(promo), costo_usd: redondear(costo) } }
}

// Cada sabor que ya existía conserva su id (así se puede renombrar sin perder stock ni historial);
// los nuevos se agregan y los que se sacan quedan inactivos.
async function sincronizarSabores(supabase: Supabase, productoId: string, sabores: SaborEnviado[]) {
  const { data: existentes, error } = await supabase.from('sabores').select('id, nombre, codigo, activo').eq('producto_id', productoId)
  if (error) return 'Se guardó el producto, pero no los sabores. Probá de nuevo.'
  const porId = new Map(existentes.map(sabor => [sabor.id, sabor]))
  const porNombre = new Map(existentes.map(sabor => [sabor.nombre.toLowerCase(), sabor]))
  const usados = new Set<string>()
  const cambios: { id: string; datos: Record<string, unknown> }[] = []
  const nuevos: { producto_id: string; nombre: string; codigo: string | null }[] = []
  for (const sabor of sabores) {
    // Si el renglón trae id es ese sabor (aunque lo hayan renombrado); si no, se busca uno con el mismo nombre.
    const existente = (sabor.id ? porId.get(sabor.id) : undefined) ?? porNombre.get(sabor.nombre.toLowerCase())
    if (existente && !usados.has(existente.id)) {
      usados.add(existente.id)
      const cambio: Record<string, unknown> = {}
      if (existente.nombre !== sabor.nombre) cambio.nombre = sabor.nombre
      if ((existente.codigo ?? null) !== sabor.codigo) cambio.codigo = sabor.codigo
      if (!existente.activo) cambio.activo = true
      if (Object.keys(cambio).length) cambios.push({ id: existente.id, datos: cambio })
    } else nuevos.push({ producto_id: productoId, nombre: sabor.nombre, codigo: sabor.codigo })
  }
  const desactivar = existentes.filter(sabor => sabor.activo && !usados.has(sabor.id)).map(sabor => sabor.id)

  // Primero se sacan y renombran los existentes, después se agregan los nuevos (evita choques de nombre o código).
  const primeros = await Promise.all([
    desactivar.length ? supabase.from('sabores').update({ activo: false }).in('id', desactivar) : null,
    ...cambios.map(cambio => supabase.from('sabores').update(cambio.datos).eq('id', cambio.id)),
  ])
  const segundos = nuevos.length ? [await supabase.from('sabores').insert(nuevos)] : []
  const resultados = [...primeros, ...segundos]
  if (resultados.some(resultado => resultado?.error?.code === '23505')) return 'Se guardó el producto, pero algún nombre o código de sabor ya existe (puede ser uno sacado de la lista).'
  if (resultados.some(resultado => resultado?.error)) return 'Se guardó el producto, pero no todos los sabores. Probá de nuevo.'
  return null
}

// Producto nuevo: marca, nombre, precios, costo y sabores.
export async function crearProducto(formData: FormData) {
  const marca = String(formData.get('marca') ?? '').trim().slice(0, 100)
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200)
  if (!marca) return 'Falta la marca.'
  if (!nombre) return 'Falta el nombre del producto.'
  const precios = leerPrecios(formData)
  if ('error' in precios) return precios.error ?? 'Revisá los precios.'
  const sabores = leerSabores(String(formData.get('sabores') ?? '[]'))
  const problema = validarSabores(sabores)
  if (problema) return problema
  const supabase = await createClient()
  const { data, error } = await supabase.from('productos').insert({ marca, nombre, ...precios.datos }).select('id').single()
  if (error?.code === '23505') return 'Ya existe un producto con esa marca y ese nombre.'
  if (error) return 'No se pudo guardar el producto. Probá de nuevo.'
  const errorSabores = await sincronizarSabores(supabase, data.id, sabores!)
  revalidatePath('/')
  return errorSabores
}

// Catálogo: marca, nombre y sabores (los precios y costos se editan en "Precios y costos").
export async function guardarDatosProducto(id: string, formData: FormData) {
  if (typeof id !== 'string' || !id) return 'No se encontró el producto.'
  const marca = String(formData.get('marca') ?? '').trim().slice(0, 100)
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200)
  if (!marca) return 'Falta la marca.'
  if (!nombre) return 'Falta el nombre del producto.'
  const sabores = leerSabores(String(formData.get('sabores') ?? '[]'))
  const problema = validarSabores(sabores)
  if (problema) return problema
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ marca, nombre }).eq('id', id).select('id').single()
  if (error?.code === '23505') return 'Ya existe un producto con esa marca y ese nombre.'
  if (error) return 'No se pudo guardar el producto. Probá de nuevo.'
  const errorSabores = await sincronizarSabores(supabase, id, sabores!)
  revalidatePath('/')
  return errorSabores
}

// Precios y costos: efectivo, transferencia, promo x3, dólares y costo por unidad.
export async function guardarPreciosProducto(id: string, formData: FormData) {
  if (typeof id !== 'string' || !id) return 'No se encontró el producto.'
  const precios = leerPrecios(formData)
  if ('error' in precios) return precios.error ?? 'Revisá los precios.'
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update(precios.datos).eq('id', id).select('id').single()
  if (error) return 'No se pudieron guardar los precios. Probá de nuevo.'
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
