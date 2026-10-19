import type { Producto } from '@/lib/productos'

export const METODOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', dolares: 'Dólares' }
export type MetodoPago = keyof typeof METODOS_PAGO

export const RECIBIO = { lucas: 'Lucas', gonzalo: 'Gonzalo' }
export type Recibio = keyof typeof RECIBIO

export type ItemVendido = {
  id: string
  producto_id: string | null
  sabor_id: string | null
  descripcion: string
  cantidad: number
  precio_lista: number | null
  precio_unitario: number
  subtotal: number
  productos: { marca: string; nombre: string } | null
}

export type Venta = {
  id: string
  numero: number
  cliente_id: string
  fecha: string
  metodo_pago: MetodoPago
  recibio: Recibio
  total: number
  total_lista: number | null
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
  items: { sabor_id: string; cantidad: number }[]
}

export function precioSegunPago(producto: Producto, metodo: MetodoPago) {
  if (metodo === 'efectivo') return producto.precio_efectivo
  if (metodo === 'transferencia') return producto.precio_transferencia
  return producto.precio_usd
}

// Totales de una venta, igual que los calcula la base (registrar_venta): la promo x3 se aplica por
// modelo cada 3 unidades, solo en efectivo o transferencia. totalLista es null si falta algún precio.
export function calcularTotales(lineas: { producto: Producto; cantidad: number }[], metodo: MetodoPago) {
  const faltaPrecio = lineas.some(linea => precioSegunPago(linea.producto, metodo) === null)
  const sinPromo = lineas.reduce((suma, linea) => suma + (precioSegunPago(linea.producto, metodo) ?? 0) * linea.cantidad, 0)
  const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0)
  const porProducto = new Map<string, { producto: Producto; unidades: number }>()
  for (const linea of lineas) {
    const actual = porProducto.get(linea.producto.id) ?? { producto: linea.producto, unidades: 0 }
    actual.unidades += linea.cantidad
    porProducto.set(linea.producto.id, actual)
  }
  const totalLista = faltaPrecio ? null : [...porProducto.values()].reduce((suma, { producto, unidades: u }) => {
    const precio = precioSegunPago(producto, metodo) ?? 0
    const promo = metodo !== 'dolares' ? producto.promo_x3 : null
    return suma + (promo !== null ? Math.floor(u / 3) * promo + (u % 3) * precio : u * precio)
  }, 0)
  return { faltaPrecio, sinPromo, unidades, totalLista }
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
