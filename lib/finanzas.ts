import type { Producto } from '@/lib/productos'
import type { ItemVendido, MetodoPago, Recibio, Venta } from '@/lib/ventas'

export const TIPOS_MOVIMIENTO = { egreso: 'Egreso', pase: 'Pase', retiro: 'Retiro de socio', aporte: 'Aporte', ajuste: 'Ajuste de arqueo' }
export type TipoMovimiento = keyof typeof TIPOS_MOVIMIENTO

export const CATEGORIAS_EGRESO = { mercaderia: 'Mercadería', alquiler: 'Alquiler', sueldos: 'Sueldos', servicios: 'Servicios', publicidad: 'Publicidad', envios: 'Envíos', impuestos: 'Impuestos', otros: 'Otros' }
export type CategoriaEgreso = keyof typeof CATEGORIAS_EGRESO

// Cajas: la de cada socio (lo que cobra cada uno) y la Caja Glauss, la del negocio (adonde se rinde al cerrar caja).
export const CAJAS = { lucas: 'Lucas', gonzalo: 'Gonzalo', glauss: 'Glauss' }
export type Caja = keyof typeof CAJAS
export const SOCIOS: Recibio[] = ['lucas', 'gonzalo']
export const MEDIOS: MetodoPago[] = ['efectivo', 'transferencia', 'dolares']

export type MovimientoCaja = {
  id: string
  numero: number
  fecha: string
  tipo: TipoMovimiento
  persona: Caja
  medio: MetodoPago
  monto: number
  destino_persona: Caja | null
  destino_medio: MetodoPago | null
  monto_destino: number | null
  categoria: CategoriaEgreso | null
  descripcion: string | null
  cierre_id: string | null
  created_at: string
}

export type SaldoCaja = { persona: Caja; medio: MetodoPago; saldo: number }

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

export const saldoDe = (saldos: SaldoCaja[], persona: Caja, medio: MetodoPago) =>
  saldos.filter(saldo => saldo.persona === persona && saldo.medio === medio).reduce((suma, saldo) => suma + Number(saldo.saldo), 0)

// Cada venta guarda el dólar de ese día y cada producto vendido su costo (desde el 19/11/2026): así la ganancia de lo
// que ya se vendió no cambia si después se cambia la cotización o el costo. Si falta, se usa el de hoy.
const dolarDeVenta = (venta: Venta, cotizacion: number | null) => venta.cotizacion_usd ?? cotizacion
const costoUsdDe = (item: ItemVendido, costoHoy: Map<string, number>) => item.costo_usd ?? (item.producto_id ? costoHoy.get(item.producto_id) : undefined)
const costosDeHoy = (productos: Producto[]) => new Map(productos.filter(producto => producto.costo_usd !== null).map(producto => [producto.id, producto.costo_usd!]))

// Números de un período (desde/hasta aaaa-mm-dd, vacío = sin límite) para Finanzas. Todo en pesos.
// Ganancia real = lo vendido - el costo de lo vendido (costo en US$ de cada producto) - gastos.
// Los egresos de categoría "mercadería" no cuentan como gasto: ya están en el costo de lo vendido.
export function calcularPeriodo(desde: string, hasta: string, ventas: Venta[], movimientos: MovimientoCaja[], productos: Producto[], cotizacion: number | null) {
  const costoHoy = costosDeHoy(productos)
  const enPeriodo = (fecha: string) => (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
  const ventasMes = ventas.filter(venta => enPeriodo(venta.fecha))
  const movimientosMes = movimientos.filter(movimiento => enPeriodo(movimiento.fecha))
  let faltaCotizacion = false
  const aPesos = (monto: number, medio: MetodoPago, dolar: number | null = cotizacion) => {
    if (medio !== 'dolares') return monto
    if (!dolar) { faltaCotizacion = true; return 0 }
    return monto * dolar
  }

  const vendidoPesos = ventasMes.filter(venta => venta.metodo_pago !== 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const vendidoUsd = ventasMes.filter(venta => venta.metodo_pago === 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const vendido = ventasMes.reduce((suma, venta) => suma + aPesos(venta.total, venta.metodo_pago, dolarDeVenta(venta, cotizacion)), 0)

  let unidadesSinCosto = 0
  let costoVendido = 0
  for (const venta of ventasMes) for (const item of venta.venta_items) {
    const costo = costoUsdDe(item, costoHoy)
    if (costo === undefined) { unidadesSinCosto += item.cantidad; continue }
    costoVendido += aPesos(costo * item.cantidad, 'dolares', dolarDeVenta(venta, cotizacion))
  }

  const egresos = movimientosMes.filter(movimiento => movimiento.tipo === 'egreso')
  const gastos = egresos.filter(egreso => egreso.categoria !== 'mercaderia').reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0)
  const egresosTotal = egresos.reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0)
  const retiros = movimientosMes.filter(movimiento => movimiento.tipo === 'retiro').reduce((suma, retiro) => suma + aPesos(retiro.monto, retiro.medio), 0)
  const porCategoria = new Map<CategoriaEgreso, number>()
  for (const egreso of egresos) if (egreso.categoria) porCategoria.set(egreso.categoria, (porCategoria.get(egreso.categoria) ?? 0) + aPesos(egreso.monto, egreso.medio))

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
  pasesEnviados: number                // lo que pasó de su caja a otra caja (el otro socio o Glauss), en pesos
  pasesRecibidos: number               // lo que recibió en su caja desde otra caja, en pesos
  ganancia: number                     // su parte (50%)
  porRetirar: number                   // su parte menos lo que ya retiró
  rindeACaja: number                   // lo que cobró − lo que pagó − lo que pasó a otra caja + lo que recibió − su ganancia
}

// Reparto 50 / 50 entre Lucas y Gonzalo de las ventas y movimientos que se le pasan (ya filtrados por período).
// Ganancia = todo lo vendido (efectivo, transferencia y dólares en pesos) - costo de lo vendido - gastos (sin mercadería,
// de cualquier caja). Cada uno se lleva la mitad. Lo que cobró cada uno, menos lo que pagó de su caja, menos lo que pasó
// a otra caja, más lo que recibió y menos su ganancia, es lo que rinde a la caja del negocio.
export function repartoDe(ventas: Venta[], movimientos: MovimientoCaja[], productos: Producto[], cotizacion: number | null) {
  const costoHoy = costosDeHoy(productos)
  const aPesos = (monto: number, medio: MetodoPago, dolar: number | null = cotizacion) => medio === 'dolares' ? monto * (dolar ?? 0) : monto
  let unidadesSinCosto = 0
  const costoDe = (venta: Venta) => venta.venta_items.reduce((suma, item) => {
    const costo = costoUsdDe(item, costoHoy)
    if (costo === undefined) { unidadesSinCosto += item.cantidad; return suma }
    return suma + costo * item.cantidad * (dolarDeVenta(venta, cotizacion) ?? 0)
  }, 0)

  const pasesEntreCajas = movimientos.filter(movimiento => movimiento.tipo === 'pase' && movimiento.destino_persona !== null && movimiento.destino_persona !== movimiento.persona)
  const egresos = movimientos.filter(movimiento => movimiento.tipo === 'egreso')
  const base = SOCIOS.map(persona => {
    const propias = ventas.filter(venta => venta.recibio === persona)
    const vendido = { efectivo: 0, transferencia: 0, dolares: 0 } as Record<MetodoPago, number>
    for (const venta of propias) vendido[venta.metodo_pago] += venta.total
    return {
      persona, vendido,
      generado: propias.reduce((suma, venta) => suma + aPesos(venta.total, venta.metodo_pago, dolarDeVenta(venta, cotizacion)), 0),
      costo: propias.reduce((suma, venta) => suma + costoDe(venta), 0),
      egresos: egresos.filter(egreso => egreso.persona === persona).reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0),
      retiros: movimientos.filter(movimiento => movimiento.tipo === 'retiro' && movimiento.persona === persona).reduce((suma, retiro) => suma + aPesos(retiro.monto, retiro.medio), 0),
      pasesEnviados: pasesEntreCajas.filter(pase => pase.persona === persona).reduce((suma, pase) => suma + aPesos(pase.monto, pase.medio), 0),
      pasesRecibidos: pasesEntreCajas.filter(pase => pase.destino_persona === persona).reduce((suma, pase) => suma + aPesos(pase.monto_destino ?? pase.monto, pase.destino_medio ?? pase.medio), 0),
    }
  })
  const vendido = base.reduce((suma, persona) => suma + persona.generado, 0)
  const costo = base.reduce((suma, persona) => suma + persona.costo, 0)
  const gastos = egresos.filter(egreso => egreso.categoria !== 'mercaderia').reduce((suma, egreso) => suma + aPesos(egreso.monto, egreso.medio), 0)
  const ganancia = vendido - costo - gastos
  const personas: RepartoPersona[] = base.map(persona => ({
    ...persona,
    ganancia: ganancia / 2,
    porRetirar: ganancia / 2 - persona.retiros,
    rindeACaja: persona.generado - persona.egresos - persona.pasesEnviados + persona.pasesRecibidos - ganancia / 2,
  }))
  const usaDolares = ventas.some(venta => venta.metodo_pago === 'dolares') || movimientos.some(movimiento => movimiento.medio === 'dolares')
  return {
    vendido, costo, gastos, ganancia, personas, unidadesSinCosto,
    rindeTotal: personas.reduce((suma, persona) => suma + persona.rindeACaja, 0),
    faltaCotizacion: !cotizacion && (usaDolares || costo === 0 && ventas.length > 0),
  }
}

// Reparto entre dos fechas (aaaa-mm-dd, vacío = sin límite), para el período elegido en Finanzas.
export function calcularReparto(desde: string, hasta: string, ventas: Venta[], movimientos: MovimientoCaja[], productos: Producto[], cotizacion: number | null) {
  const enPeriodo = (fecha: string) => (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
  return repartoDe(ventas.filter(venta => enPeriodo(venta.fecha)), movimientos.filter(movimiento => enPeriodo(movimiento.fecha)), productos, cotizacion)
}

// Cierre de caja --------------------------------------------------------------------------------------------------

export type MontosPorMedio = Record<MetodoPago, number>
export const sinMontos = (): MontosPorMedio => ({ efectivo: 0, transferencia: 0, dolares: 0 })

export type PersonaCierre = {
  persona: Recibio
  cobro: number            // lo que cobró en el período, en pesos
  egresos: number
  pasesEnviados: number
  pasesRecibidos: number
  retirosPrevios: number   // lo que ya había retirado antes del cierre
  leCorresponde: number    // 50% de la ganancia
  porRetirar: number
  rindeCalculado: number   // lo que tendría que rendir según las cuentas del período
  saldoAntes: MontosPorMedio
  seLleva: MontosPorMedio  // su ganancia, por medio
  rinde: MontosPorMedio    // lo que pasa a la Caja Glauss (negativo: la Caja Glauss le pone esa plata)
  seLlevaPesos: number
  rindePesos: number
}

export type DatosCierre = {
  desde: string | null     // cuándo fue el cierre anterior (null: desde el principio)
  ventas: number
  vendido: number
  costo: number
  gastos: number
  ganancia: number
  unidadesSinCosto: number
  cotizacion: number | null
  personas: PersonaCierre[]
  glaussAntes: MontosPorMedio
  glaussDespues: MontosPorMedio
  glaussDespuesPesos: number
}

export type Cierre = {
  id: string
  numero: number
  cotizacion_usd: number | null
  datos: DatosCierre
  cerrado_por_email: string | null
  created_at: string
}

export type MovimientoDeCierre = { tipo: 'retiro' | 'pase'; persona: Caja; medio: MetodoPago; monto: number; destino_persona: Caja | null; destino_medio: MetodoPago | null; descripcion: string }

// Lo que entra en el próximo cierre: todo lo cargado después del último cierre.
export function abiertoDesde(cierres: Cierre[]) {
  return cierres.reduce<string | null>((ultimo, cierre) => !ultimo || cierre.created_at > ultimo ? cierre.created_at : ultimo, null)
}
export function delPeriodoAbierto(cierres: Cierre[], ventas: Venta[], movimientos: MovimientoCaja[]) {
  const desde = abiertoDesde(cierres)
  const despues = (creado: string) => !desde || new Date(creado).getTime() > new Date(desde).getTime()
  return { desde, ventas: ventas.filter(venta => despues(venta.created_at)), movimientos: movimientos.filter(movimiento => despues(movimiento.created_at)) }
}

const redondear = (monto: number) => Math.round(monto * 100) / 100
export const montosAPesos = (montos: MontosPorMedio, cotizacion: number | null) => montos.efectivo + montos.transferencia + montos.dolares * (cotizacion ?? 0)

// Propuesta de cuánto se lleva cada socio y de qué medio: primero del efectivo, después de la transferencia.
// Lo que queda en su caja pasa a la Caja Glauss.
export function propuestaSeLleva(saldos: SaldoCaja[], persona: Recibio, porRetirar: number): MontosPorMedio {
  let falta = Math.max(0, Math.round(porRetirar))
  const propuesta = sinMontos()
  for (const medio of ['efectivo', 'transferencia'] as const) {
    const toma = Math.min(falta, Math.max(0, Math.floor(saldoDe(saldos, persona, medio))))
    propuesta[medio] = toma
    falta -= toma
  }
  if (falta > 0) propuesta.efectivo += falta  // no le alcanza su caja: lo que falta sale de la Caja Glauss
  return propuesta
}

// Arma el cierre: lo que se guarda (tal como se ve) y los retiros y pases que deja hechos.
// Cada socio se lleva lo indicado y todo lo demás de su caja pasa a la Caja Glauss, así su caja queda en 0.
export function armarCierre(args: { desde: string | null; ventas: Venta[]; movimientos: MovimientoCaja[]; productos: Producto[]; saldos: SaldoCaja[]; cotizacion: number | null; seLleva: Record<Recibio, MontosPorMedio> }) {
  const { saldos, cotizacion } = args
  const reparto = repartoDe(args.ventas, args.movimientos, args.productos, cotizacion)
  const movimientos: MovimientoDeCierre[] = []
  const glaussAntes = sinMontos(), glaussDespues = sinMontos()
  for (const medio of MEDIOS) glaussAntes[medio] = glaussDespues[medio] = saldoDe(saldos, 'glauss', medio)
  const personas: PersonaCierre[] = reparto.personas.map(socio => {
    const saldoAntes = sinMontos(), rinde = sinMontos()
    const seLleva = { ...args.seLleva[socio.persona] }
    for (const medio of MEDIOS) {
      saldoAntes[medio] = saldoDe(saldos, socio.persona, medio)
      seLleva[medio] = redondear(Math.max(0, seLleva[medio] || 0))
      rinde[medio] = redondear(saldoAntes[medio] - seLleva[medio])
      glaussDespues[medio] = redondear(glaussDespues[medio] + rinde[medio])
      if (seLleva[medio] > 0) movimientos.push({ tipo: 'retiro', persona: socio.persona, medio, monto: seLleva[medio], destino_persona: null, destino_medio: null, descripcion: 'Su ganancia' })
      if (rinde[medio] > 0) movimientos.push({ tipo: 'pase', persona: socio.persona, medio, monto: rinde[medio], destino_persona: 'glauss', destino_medio: medio, descripcion: 'Rinde a la Caja Glauss' })
      if (rinde[medio] < 0) movimientos.push({ tipo: 'pase', persona: 'glauss', medio, monto: -rinde[medio], destino_persona: socio.persona, destino_medio: medio, descripcion: `La Caja Glauss le completa a ${CAJAS[socio.persona]}` })
    }
    return {
      persona: socio.persona, cobro: socio.generado, egresos: socio.egresos, pasesEnviados: socio.pasesEnviados, pasesRecibidos: socio.pasesRecibidos,
      retirosPrevios: socio.retiros, leCorresponde: socio.ganancia, porRetirar: socio.porRetirar, rindeCalculado: socio.rindeACaja,
      saldoAntes, seLleva, rinde, seLlevaPesos: montosAPesos(seLleva, cotizacion), rindePesos: montosAPesos(rinde, cotizacion),
    }
  })
  const datos: DatosCierre = {
    desde: args.desde, ventas: args.ventas.length, vendido: reparto.vendido, costo: reparto.costo, gastos: reparto.gastos, ganancia: reparto.ganancia,
    unidadesSinCosto: reparto.unidadesSinCosto, cotizacion, personas, glaussAntes, glaussDespues, glaussDespuesPesos: montosAPesos(glaussDespues, cotizacion),
  }
  return { datos, movimientos, reparto }
}

// Stock de un sabor en el momento de un cierre de caja (cierres_caja.stock).
export type FilaStockCierre = {
  marca: string
  producto: string
  puffs: number | null
  oculto: boolean
  costo_usd: number | null
  codigo: string | null
  sabor: string
  activo: boolean
  stock: number
}
