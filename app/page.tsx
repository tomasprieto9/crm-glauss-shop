import CrmApp from '@/components/crm-app'
import type { Cliente } from '@/lib/clientes'
import { createClient } from '@/lib/supabase/server'

// Supabase devuelve como máximo 1.000 filas por consulta.
const FILAS_POR_CONSULTA = 1000

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  const clientes: Cliente[] = []
  for (let desde = 0; ; desde += FILAS_POR_CONSULTA) {
    const { data: lote, error } = await supabase.from('clientes').select('*').order('id').range(desde, desde + FILAS_POR_CONSULTA - 1)
    if (error) throw new Error(`No se pudieron cargar los clientes: ${error.message}`)
    clientes.push(...lote)
    if (lote.length < FILAS_POR_CONSULTA) break
  }
  clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return <CrmApp email={data?.claims.email ?? ''} clientes={clientes} />
}
