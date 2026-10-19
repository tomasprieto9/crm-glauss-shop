export const METODOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }
export type MetodoPago = keyof typeof METODOS_PAGO

export type ItemVenta = { descripcion: string; cantidad: number; precio_unitario: number }

export type Venta = {
  id: string
  numero: number
  cliente_id: string
  fecha: string
  metodo_pago: MetodoPago
  total: number
  created_at: string
  clientes: { nombre: string } | null
  venta_items: (ItemVenta & { id: string; subtotal: number })[]
}

export type NuevaVenta = {
  clienteId: string | null
  nuevoNombre: string
  nuevoTelefono: string
  fecha: string
  metodoPago: string
  dniVerificado: boolean
  items: ItemVenta[]
}

// Fecha de hoy (aaaa-mm-dd) en hora de Argentina.
export function hoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}
