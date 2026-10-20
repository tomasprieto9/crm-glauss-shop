import CrmApp from '@/components/crm-app'
import type { Cliente } from '@/lib/clientes'
import type { MovimientoCaja, SaldoCaja } from '@/lib/finanzas'
import type { Compra, Configuracion, Producto, Sabor } from '@/lib/productos'
import { createClient } from '@/lib/supabase/server'
import type { Venta } from '@/lib/ventas'

// Supabase devuelve como máximo 1.000 filas por consulta.
const FILAS_POR_CONSULTA = 1000

type Supabase = Awaited<ReturnType<typeof createClient>>

async function cargarClientes(supabase: Supabase) {
  const clientes: Cliente[] = []
  for (let desde = 0; ; desde += FILAS_POR_CONSULTA) {
    const { data: lote, error } = await supabase.from('clientes').select('*').order('id').range(desde, desde + FILAS_POR_CONSULTA - 1)
    if (error) throw new Error(`No se pudieron cargar los clientes: ${error.message}`)
    clientes.push(...lote)
    if (lote.length < FILAS_POR_CONSULTA) break
  }
  return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

async function cargarVentas(supabase: Supabase) {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, numero, cliente_id, fecha, metodo_pago, recibio, total, total_lista, created_at, cargada_por_email, editada_por_email, editada_en, clientes(nombre), venta_items(id, producto_id, sabor_id, descripcion, cantidad, precio_lista, precio_unitario, subtotal, productos(marca, nombre))')
    .order('numero', { ascending: false })
    .limit(FILAS_POR_CONSULTA)
  if (error) throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  return data as unknown as Venta[]
}

// Productos con sus sabores y el stock de cada uno (vista sabores_con_stock).
async function cargarProductos(supabase: Supabase) {
  const [productos, sabores] = await Promise.all([
    supabase.from('productos').select('*').limit(FILAS_POR_CONSULTA),
    supabase.from('sabores_con_stock').select('id, producto_id, nombre, activo, stock').limit(5000),
  ])
  if (productos.error) throw new Error(`No se pudieron cargar los productos: ${productos.error.message}`)
  if (sabores.error) throw new Error(`No se pudieron cargar los sabores: ${sabores.error.message}`)
  const porProducto = new Map<string, Sabor[]>()
  for (const sabor of sabores.data as Sabor[]) porProducto.set(sabor.producto_id, [...(porProducto.get(sabor.producto_id) ?? []), sabor])
  return (productos.data as Omit<Producto, 'sabores'>[])
    .map(producto => ({ ...producto, sabores: (porProducto.get(producto.id) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }))
    .sort((a, b) => a.marca.localeCompare(b.marca, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
}

async function cargarCompras(supabase: Supabase) {
  const { data, error } = await supabase
    .from('compras')
    .select('id, numero, producto_id, fecha, costo_unitario_usd, notas, created_at, productos(marca, nombre), stock_movimientos(cantidad)')
    .order('numero', { ascending: false })
    .limit(200)
  if (error) throw new Error(`No se pudieron cargar las compras: ${error.message}`)
  return data as unknown as Compra[]
}

async function cargarFinanzas(supabase: Supabase) {
  const [movimientos, saldos] = await Promise.all([
    supabase.from('movimientos_caja').select('*').order('numero', { ascending: false }).limit(FILAS_POR_CONSULTA),
    supabase.from('saldos_caja').select('persona, medio, saldo'),
  ])
  if (movimientos.error) throw new Error(`No se pudieron cargar los movimientos de caja: ${movimientos.error.message}`)
  if (saldos.error) throw new Error(`No se pudieron cargar los saldos de caja: ${saldos.error.message}`)
  return { movimientos: movimientos.data as MovimientoCaja[], saldos: saldos.data as SaldoCaja[] }
}

async function cargarConfiguracion(supabase: Supabase) {
  const { data, error } = await supabase.from('configuracion').select('cotizacion_usd, actualizada_en').eq('id', 1).single()
  if (error) throw new Error(`No se pudo cargar la configuración: ${error.message}`)
  return data as Configuracion
}

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const [clientes, ventas, productos, compras, configuracion, finanzas] = await Promise.all([cargarClientes(supabase), cargarVentas(supabase), cargarProductos(supabase), cargarCompras(supabase), cargarConfiguracion(supabase), cargarFinanzas(supabase)])
  return <CrmApp email={data?.claims.email ?? ''} clientes={clientes} ventas={ventas} productos={productos} compras={compras} configuracion={configuracion} movimientos={finanzas.movimientos} saldos={finanzas.saldos} />
}
