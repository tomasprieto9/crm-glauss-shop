'use server'

import { revalidatePath } from 'next/cache'
import { CATEGORIAS } from '@/lib/productos'
import { createClient } from '@/lib/supabase/server'

// Crea un producto o, si viene id, lo actualiza. Devuelve un mensaje de error o null.
export async function guardarProducto(id: string | null, formData: FormData) {
  const marca = String(formData.get('marca') ?? '').trim().slice(0, 100)
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200)
  const categoria = String(formData.get('categoria') ?? '')
  const precios = ['precio_efectivo', 'precio_transferencia', 'precio_usd'].map(campo => Number(String(formData.get(campo) ?? '').replace(',', '.')))
  if (!marca) return 'Falta la marca.'
  if (!nombre) return 'Falta el nombre del producto.'
  if (!Object.hasOwn(CATEGORIAS, categoria)) return 'Elegí una categoría.'
  if (precios.some(precio => !Number.isFinite(precio) || precio < 0 || precio > 100_000_000)) return 'Revisá los tres precios (efectivo, transferencia y dólares).'

  const [precio_efectivo, precio_transferencia, precio_usd] = precios.map(precio => Math.round(precio * 100) / 100)
  const datos = { marca, nombre, categoria, precio_efectivo, precio_transferencia, precio_usd }
  const supabase = await createClient()
  const { error } = id ? await supabase.from('productos').update(datos).eq('id', id) : await supabase.from('productos').insert(datos)
  if (error?.code === '23505') return 'Ya existe un producto con esa marca y ese nombre.'
  if (error) return 'No se pudo guardar el producto. Probá de nuevo.'
  revalidatePath('/')
  return null
}
