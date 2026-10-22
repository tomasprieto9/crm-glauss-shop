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

export type RepartoPersona = {
  persona: Recibio
  vendido: Record<MetodoPago, number>  // lo que cobró, en su moneda
  generado: number                     // todo lo que cobró, en pesos
  costo: number                        // costo de lo que vendió
  egresos: number                      // egresos que pagó de su caja (gastos y mercadería), en pesos
  retiros: number                      // lo que ya retiró como socio, en pesos
  ganancia: number                     // su parte (50%)
  porRetirar: number                   // su parte menos lo que ya retiró
  rindeACaja: number                   // lo que cobró menos lo que pagó y menos su ganancia: vuelve a la caja del negocio
}

// Reparto de la ganancia 50 / 50 entre Lucas y Gonzalo, entre dos fechas (aaaa-mm-dd), como en la planilla de cierre.
// Ganancia = todo lo vendido (efectivo, transferencia y dólares en pesos) - costo de lo vendido - gastos (sin mercadería).
// Cada uno se lleva la mitad. Lo que cobró cada uno, menos lo que pagó de su caja y menos su ganancia, vuelve a la caja.
export function calcularReparto(desde: string, hasta: string, ventas: Venta[], movimientos: MovimientoCaja[], productos: Producto[], cotizacion: number | null) {
  const enPeriodo = (fecha: string) => (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
  const aPesos = (monto: number, medio: MetodoPago) => medio === 'dolares' ? monto * (cotizacion ?? 0) : monto
  const costoUsd = new Map(productos.filter(producto => producto.costo_usd !== null).map(producto => [producto.id, producto.costo_usd!]))
  const ventasPeriodo = ventas.filter(venta => enPeriodo(venta.fecha))
  const movimientosPeriodo = movimientos.filter(movimiento => enPeriodo(movimiento.fecha))
  let unidadesSinCosto = 0
  const costoDe = (venta: Venta) => venta.venta_items.reduce((suma, item) => {
    const costo = item.producto_id ? costoUsd.get(item.producto_id) : undefined
    if (costo === undefined) { unidadesSinCosto += item.cantidad; return suma }
    return suma + costo * item.cantidad * (cotizacion ?? 0)
  }, 0)

  const base = (Object.keys({ lucas: 0, gonzalo: 0 }) as Recibio[]).map(persona => {
    const propias = ventasPeriodo.filter(venta => venta.recibio === persona)
    const vendido = { efectivo: 0, transferencia: 0, dolares: 0 } as Record<MetodoPago, number>
    for (const venta of propias) vendido[venta.metodo_pago] += venta.total
    const egresos = movimientosPeriodo.filter(movimiento => movimiento.tipo === 'egreso' && movimiento.persona === persona)
    return {
      persona, vendido,
      generado: propias.reduce((suma, venta) => suma + aPesos(venta.total, venta.metodo_pago), 0),
      costo: propias.reduce((suma, venta) => suma + costoDe(venta), 0),
      gastos: egresos.filter(egreso => egreso.categoria !== 'mercaderia').reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0),
      egresos: egresos.reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0),
      retiros: movimientosPeriodo.filter(movimiento => movimiento.tipo === 'retiro' && movimiento.persona === persona).reduce((suma, retiro) => suma + aPesos(retiro.monto, retiro.medio), 0),
    }
  })
  const vendido = base.reduce((suma, persona) => suma + persona.generado, 0)
  const costo = base.reduce((suma, persona) => suma + persona.costo, 0)
  const gastos = base.reduce((suma, persona) => suma + persona.gastos, 0)
  const ganancia = vendido - costo - gastos
  const personas: RepartoPersona[] = base.map(({ gastos: _, ...persona }) => ({
    ...persona,
    ganancia: ganancia / 2,
    porRetirar: ganancia / 2 - persona.retiros,
    rindeACaja: persona.generado - persona.egresos - ganancia / 2,
  }))
  const usaDolares = ventasPeriodo.some(venta => venta.metodo_pago === 'dolares') || movimientosPeriodo.some(movimiento => movimiento.medio === 'dolares')
  return {
    vendido, costo, gastos, ganancia, personas, unidadesSinCosto,
    rindeTotal: personas.reduce((suma, persona) => suma + persona.rindeACaja, 0),
    faltaCotizacion: !cotizacion && (usaDolares || costo === 0 && ventasPeriodo.length > 0),
  }
}
