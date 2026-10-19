import CrmApp from '@/components/crm-app'
import type { Cliente } from '@/lib/clientes'
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
    .select('id, numero, cliente_id, fecha, metodo_pago, total, created_at, clientes(nombre), venta_items(id, descripcion, cantidad, precio_unitario, subtotal)')
    .order('numero', { ascending: false })
    .limit(FILAS_POR_CONSULTA)
  if (error) throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  return data as unknown as Venta[]
}

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const [clientes, ventas] = await Promise.all([cargarClientes(supabase), cargarVentas(supabase)])
  return <CrmApp email={data?.claims.email ?? ''} clientes={clientes} ventas={ventas} />
}
