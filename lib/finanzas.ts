import type { Producto } from '@/lib/productos'
import type { MetodoPago, Recibio, Venta } from '@/lib/ventas'

export const TIPOS_MOVIMIENTO = { egreso: 'Egreso', pase: 'Pase', retiro: 'Retiro de socio', aporte: 'Aporte', ajuste: 'Ajuste de arqueo' }
export type TipoMovimiento = keyof typeof TIPOS_MOVIMIENTO

export const CATEGORIAS_EGRESO = { mercaderia: 'Mercadería', alquiler: 'Alquiler', sueldos: 'Sueldos', servicios: 'Servicios', publicidad: 'Publicidad', envios: 'Envíos', impuestos: 'Impuestos', otros: 'Otros' }
export type CategoriaEgreso = keyof typeof CATEGORIAS_EGRESO

export type MovimientoCaja = {
  id: string
  numero: number
  fecha: string
  tipo: TipoMovimiento
  persona: Recibio
  medio: MetodoPago
  monto: number
  destino_persona: Recibio | null
  destino_medio: MetodoPago | null
  monto_destino: number | null
  categoria: CategoriaEgreso | null
  descripcion: string | null
  created_at: string
}

export type SaldoCaja = { persona: Recibio; medio: MetodoPago; saldo: number }

export type NuevoMovimiento = {
  tipo: string
  fecha: string
  persona: string
  medio: string
  monto: number
  destinoPersona: string | null
  destinoMedio: string | null
  montoDestino: number | null
  categoria: string | null
  descripcion: string
}

export const saldoDe = (saldos: SaldoCaja[], persona: Recibio, medio: MetodoPago) =>
  saldos.filter(saldo => saldo.persona === persona && saldo.medio === medio).reduce((suma, saldo) => suma + Number(saldo.saldo), 0)

// Números del mes (aaaa-mm) para Finanzas. Todo en pesos: los dólares se pasan con la cotización.
// Ganancia real = lo vendido - el costo de lo vendido (costo en US$ de cada producto) - gastos.
// Los egresos de categoría "mercadería" no cuentan como gasto: ya están en el costo de lo vendido.
export function calcularMes(mes: string, ventas: Venta[], movimientos: MovimientoCaja[], productos: Producto[], cotizacion: number | null) {
  const aPesos = (monto: number, medio: MetodoPago) => medio === 'dolares' ? (cotizacion ? monto * cotizacion : null) : monto
  const ultimoCosto = new Map<string, number>()
  for (const producto of productos) if (producto.costo_usd !== null) ultimoCosto.set(producto.id, producto.costo_usd)

  const ventasMes = ventas.filter(venta => venta.fecha.startsWith(mes))
  const movimientosMes = movimientos.filter(movimiento => movimiento.fecha.startsWith(mes))
  let faltaCotizacion = false
  const sumarEnPesos = (montos: { monto: number; medio: MetodoPago }[]) => montos.reduce((suma, { monto, medio }) => {
    const pesos = aPesos(monto, medio)
    if (pesos === null) { faltaCotizacion = true; return suma }
    return suma + pesos
  }, 0)

  const vendidoPesos = ventasMes.filter(venta => venta.metodo_pago !== 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const vendidoUsd = ventasMes.filter(venta => venta.metodo_pago === 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const vendido = sumarEnPesos(ventasMes.map(venta => ({ monto: venta.total, medio: venta.metodo_pago })))

  let unidadesSinCosto = 0
  let costoUsd = 0
  for (const venta of ventasMes) for (const item of venta.venta_items) {
    const costo = item.producto_id ? ultimoCosto.get(item.producto_id) : undefined
    if (costo === undefined) unidadesSinCosto += item.cantidad
    else costoUsd += costo * item.cantidad
  }
  if (costoUsd > 0 && !cotizacion) faltaCotizacion = true
  const costoVendido = cotizacion ? costoUsd * cotizacion : 0

  const egresos = movimientosMes.filter(movimiento => movimiento.tipo === 'egreso')
  const gastos = sumarEnPesos(egresos.filter(egreso => egreso.categoria !== 'mercaderia').map(egreso => ({ monto: egreso.monto, medio: egreso.medio })))
  const egresosTotal = sumarEnPesos(egresos.map(egreso => ({ monto: egreso.monto, medio: egreso.medio })))
  const retiros = sumarEnPesos(movimientosMes.filter(movimiento => movimiento.tipo === 'retiro').map(retiro => ({ monto: retiro.monto, medio: retiro.medio })))
  const porCategoria = new Map<CategoriaEgreso, number>()
  for (const egreso of egresos) {
    const pesos = aPesos(egreso.monto, egreso.medio)
    if (pesos !== null && egreso.categoria) porCategoria.set(egreso.categoria, (porCategoria.get(egreso.categoria) ?? 0) + pesos)
  }

  return {
    vendido, vendidoPesos, vendidoUsd, costoVendido, gastos, egresosTotal, retiros, unidadesSinCosto, faltaCotizacion,
    ganancia: vendido - costoVendido - gastos,
    porCategoria: [...porCategoria.entries()].sort((a, b) => b[1] - a[1]),
  }
}
