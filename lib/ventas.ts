import type { Categoria, Producto } from '@/lib/productos'

export const METODOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', dolares: 'Dólares' }
export type MetodoPago = keyof typeof METODOS_PAGO

export const RECIBIO = { lucas: 'Lucas', gonzalo: 'Gonzalo' }
export type Recibio = keyof typeof RECIBIO

export type ItemVendido = {
  id: string
  producto_id: string | null
  descripcion: string
  cantidad: number
  precio_lista: number
  precio_unitario: number
  subtotal: number
  productos: { marca: string; nombre: string; categoria: Categoria } | null
}

export type Venta = {
  id: string
  numero: number
  cliente_id: string
  fecha: string
  metodo_pago: MetodoPago
  recibio: Recibio
  total: number
  total_lista: number
  created_at: string
  clientes: { nombre: string } | null
  venta_items: ItemVendido[]
}

export type NuevaVenta = {
  clienteId: string | null
  nuevoNombre: string
  nuevoTelefono: string
  fecha: string
  metodoPago: string
  recibio: string
  total: number | null
  items: { producto_id: string; cantidad: number }[]
}

export function precioSegunPago(producto: Producto, metodo: MetodoPago) {
  if (metodo === 'efectivo') return producto.precio_efectivo
  if (metodo === 'transferencia') return producto.precio_transferencia
  return producto.precio_usd
}

// Importe con su moneda: las ventas en dólares se guardan en dólares, el resto en pesos.
export function formatearImporte(valor: number, metodo: MetodoPago) {
  const numero = valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return metodo === 'dolares' ? `US$ ${numero}` : `$ ${numero}`
}

// Fecha de hoy (aaaa-mm-dd) en hora de Argentina.
export function hoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}
