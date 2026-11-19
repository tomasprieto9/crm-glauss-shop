'use server'

import { revalidatePath } from 'next/cache'
import { CAJAS, CATEGORIAS_EGRESO, MEDIOS, SOCIOS, TIPOS_MOVIMIENTO, armarCierre, sinMontos, type MontosPorMedio, type MovimientoCaja, type NuevoMovimiento, type SaldoCaja } from '@/lib/finanzas'
import type { Producto } from '@/lib/productos'
import { createClient } from '@/lib/supabase/server'
import { METODOS_PAGO, RECIBIO, hoyEnArgentina, type Recibio, type Venta } from '@/lib/ventas'

const montoValido = (monto: unknown) => typeof monto === 'number' && Number.isFinite(monto) && monto > 0 && monto <= 1_000_000_000
const redondear = (monto: number) => Math.round(monto * 100) / 100

export async function registrarMovimiento(movimiento: NuevoMovimiento) {
  const { tipo } = movimiento
  if (!Object.hasOwn(TIPOS_MOVIMIENTO, tipo) || tipo === 'ajuste') return 'Tipo de movimiento inválido.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movimiento.fecha) || movimiento.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  if (!Object.hasOwn(tipo === 'retiro' ? RECIBIO : CAJAS, movimiento.persona) || !Object.hasOwn(METODOS_PAGO, movimiento.medio)) return 'Elegí de qué caja sale (persona y medio).'
  if (!montoValido(movimiento.monto)) return 'Revisá el monto.'
  if (tipo === 'egreso' && !Object.hasOwn(CATEGORIAS_EGRESO, movimiento.categoria ?? '')) return 'Elegí la categoría del egreso.'

  const datos: Record<string, unknown> = {
    tipo,
    fecha: movimiento.fecha,
    persona: movimiento.persona,
    medio: movimiento.medio,
    monto: redondear(movimiento.monto),
    categoria: tipo === 'egreso' ? movimiento.categoria : null,
    descripcion: String(movimiento.descripcion ?? '').trim().slice(0, 300) || null,
  }
  if (tipo === 'pase') {
    if (!Object.hasOwn(CAJAS, movimiento.destinoPersona ?? '') || !Object.hasOwn(METODOS_PAGO, movimiento.destinoMedio ?? '')) return 'Elegí a qué caja va la plata.'
    if (movimiento.destinoPersona === movimiento.persona && movimiento.destinoMedio === movimiento.medio) return 'La caja de origen y la de destino son la misma.'
    if (movimiento.destinoPersona !== movimiento.persona && movimiento.destinoMedio !== movimiento.medio) return 'Entre dos cajas distintas la plata sale y llega por el mismo medio.'
    // Si no cambia de moneda llega lo mismo que sale; si pasa de pesos a dólares (o al revés), se indica lo que llega.
    const cambiaMoneda = (movimiento.medio === 'dolares') !== (movimiento.destinoMedio === 'dolares')
    const llega = cambiaMoneda ? movimiento.montoDestino : movimiento.monto
    if (!montoValido(llega)) return 'Indicá cuánto llega en la otra moneda.'
    Object.assign(datos, { destino_persona: movimiento.destinoPersona, destino_medio: movimiento.destinoMedio, monto_destino: redondear(llega as number) })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('movimientos_caja').insert(datos)
  if (error) return 'No se pudo registrar. Probá de nuevo.'
  revalidatePath('/')
  return null
}

// Pase de un socio al otro: sale y llega por el mismo medio. Si fue en varios medios (ej. una parte en efectivo y otra
// por transferencia), se guarda un pase por cada medio, todos juntos.
export async function registrarPaseEntreSocios(pase: { fecha: string; persona: string; destinoPersona: string; montos: Partial<Record<string, number>>; descripcion: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pase.fecha) || pase.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  if (!Object.hasOwn(CAJAS, pase.persona) || !Object.hasOwn(CAJAS, pase.destinoPersona)) return 'Elegí de qué caja sale y a cuál va.'
  if (pase.persona === pase.destinoPersona) return 'Elegí dos cajas distintas.'
  const montos = Object.entries(pase.montos ?? {})
  if (montos.length === 0) return 'Cargá cuánto le pasa.'
  if (montos.some(([medio, monto]) => !Object.hasOwn(METODOS_PAGO, medio) || !montoValido(monto))) return 'Revisá los montos.'
  const descripcion = String(pase.descripcion ?? '').trim().slice(0, 300) || null
  const filas = montos.map(([medio, monto]) => ({
    tipo: 'pase', fecha: pase.fecha, persona: pase.persona, medio, monto: redondear(monto as number),
    destino_persona: pase.destinoPersona, destino_medio: medio, monto_destino: redondear(monto as number), descripcion,
  }))
  const supabase = await createClient()
  const { error } = await supabase.from('movimientos_caja').insert(filas)
  if (error) return 'No se pudo registrar el pase. Probá de nuevo.'
  revalidatePath('/')
  return null
}

// Compra de dólares con pesos dentro de una misma caja, sin separar efectivo y transferencia: los pesos salen
// primero del efectivo y lo que falta de la transferencia. Si salen de los dos, se guardan dos pases (los dólares se
// reparten en proporción) y quedan juntos en la lista.
export async function registrarPesosADolares(cambio: { fecha: string; caja: string; pesos: number; dolares: number; descripcion: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cambio.fecha) || cambio.fecha > hoyEnArgentina()) return 'Revisá la fecha: no puede ser posterior a hoy.'
  if (!Object.hasOwn(CAJAS, cambio.caja)) return 'Elegí la caja.'
  if (!montoValido(cambio.pesos)) return 'Revisá cuántos pesos salen.'
  if (!montoValido(cambio.dolares)) return 'Revisá cuántos dólares entran.'
  const supabase = await createClient()
  const { data: saldos, error: errorSaldos } = await supabase.from('saldos_caja').select('medio, saldo').eq('persona', cambio.caja)
  if (errorSaldos) return 'No se pudo registrar. Probá de nuevo.'
  const saldo = (medio: string) => Math.max(0, Number(saldos.find(fila => fila.medio === medio)?.saldo ?? 0))
  const pesos = redondear(cambio.pesos)
  const delEfectivo = redondear(Math.min(pesos, saldo('efectivo')))
  const deTransferencia = redondear(pesos - delEfectivo)
  if (deTransferencia > saldo('transferencia') + 0.005) return `En la caja hay ${(saldo('efectivo') + saldo('transferencia')).toLocaleString('es-AR')} pesos: no alcanza.`
  const dolares = redondear(cambio.dolares)
  const dolaresDelEfectivo = deTransferencia > 0 ? redondear(dolares * delEfectivo / pesos) : dolares
  const descripcion = String(cambio.descripcion ?? '').trim().slice(0, 300) || 'Compra de dólares'
  const filas = [
    { medio: 'efectivo', monto: delEfectivo, llegan: dolaresDelEfectivo },
    { medio: 'transferencia', monto: deTransferencia, llegan: redondear(dolares - dolaresDelEfectivo) },
  ].filter(fila => fila.monto > 0).map(fila => ({
    tipo: 'pase', fecha: cambio.fecha, persona: cambio.caja, medio: fila.medio, monto: fila.monto,
    destino_persona: cambio.caja, destino_medio: 'dolares', monto_destino: fila.llegan, descripcion,
  }))
  const { error } = await supabase.from('movimientos_caja').insert(filas)
  if (error) return 'No se pudo registrar. Probá de nuevo.'
  revalidatePath('/')
  return null
}

export async function borrarMovimiento(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('movimientos_caja').delete().eq('id', id).select('id')
  if (error?.code === 'P0001') return error.message
  if (error || data.length === 0) return 'No se pudo borrar.'
  revalidatePath('/')
  return null
}

// Devuelve la diferencia registrada (contado - calculado) o un mensaje de error.
export async function registrarArqueo(persona: string, medio: string, contado: number, nota: string) {
  if (!Object.hasOwn(CAJAS, persona) || !Object.hasOwn(METODOS_PAGO, medio)) return { error: 'Elegí la caja.' }
  if (typeof contado !== 'number' || !Number.isFinite(contado) || contado < 0 || contado > 1_000_000_000) return { error: 'Revisá cuánto contaste.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_arqueo', { p_persona: persona, p_medio: medio, p_contado: redondear(contado), p_nota: String(nota ?? '').slice(0, 300) })
  if (error) return { error: 'No se pudo registrar el arqueo. Probá de nuevo.' }
  revalidatePath('/')
  return { diferencia: Number(data) }
}

// Cierra la caja: cada socio se lleva lo que indica (su ganancia) y todo lo demás de su caja pasa a la Caja Glauss.
// Los números se calculan acá, con lo que hay en la base: todo lo cargado después del cierre anterior.
export async function cerrarCaja(ultimoCierreId: string | null, seLlevaPedido: Record<string, Partial<Record<string, number>>>) {
  const seLleva = {} as Record<Recibio, MontosPorMedio>
  for (const socio of SOCIOS) {
    seLleva[socio] = sinMontos()
    for (const medio of MEDIOS) {
      const monto = Number(seLlevaPedido?.[socio]?.[medio] ?? 0)
      if (!Number.isFinite(monto) || monto < 0 || monto > 1_000_000_000) return 'Revisá cuánto se lleva cada uno.'
      seLleva[socio][medio] = monto
    }
  }
  const supabase = await createClient()
  const ultimo = await supabase.from('cierres_caja').select('id, created_at').order('created_at', { ascending: false }).limit(1)
  if (ultimo.error) return 'No se pudo cerrar la caja. Probá de nuevo.'
  const anterior = ultimo.data[0] ?? null
  if ((anterior?.id ?? null) !== ultimoCierreId) return 'Alguien cerró la caja recién. Recargá la página y fijate antes de cerrar de nuevo.'
  const desde = anterior?.created_at ?? null
  let consultaVentas = supabase.from('ventas').select('id, numero, fecha, metodo_pago, recibio, total, cotizacion_usd, created_at, venta_items(id, producto_id, cantidad, costo_usd)')
  let consultaMovimientos = supabase.from('movimientos_caja').select('*')
  if (desde) { consultaVentas = consultaVentas.gt('created_at', desde); consultaMovimientos = consultaMovimientos.gt('created_at', desde) }
  const [ventas, movimientos, productos, saldos, configuracion] = await Promise.all([
    consultaVentas.limit(5000),
    consultaMovimientos.limit(5000),
    supabase.from('productos').select('id, costo_usd'),
    supabase.from('saldos_caja').select('persona, medio, saldo'),
    supabase.from('configuracion').select('cotizacion_usd').eq('id', 1).single(),
  ])
  if (ventas.error || movimientos.error || productos.error || saldos.error || configuracion.error) return 'No se pudo cerrar la caja. Probá de nuevo.'
  const cotizacion = configuracion.data.cotizacion_usd === null ? null : Number(configuracion.data.cotizacion_usd)
  const { datos, movimientos: hechos } = armarCierre({
    desde, ventas: ventas.data as unknown as Venta[], movimientos: movimientos.data as MovimientoCaja[], productos: productos.data as unknown as Producto[],
    saldos: (saldos.data as SaldoCaja[]).map(saldo => ({ ...saldo, saldo: Number(saldo.saldo) })), cotizacion, seLleva,
  })
  const { data: numero, error } = await supabase.rpc('registrar_cierre', { p_ultimo_cierre: ultimoCierreId, p_datos: datos, p_movimientos: hechos })
  if (error?.code === 'P0001') return error.message
  if (error) return 'No se pudo cerrar la caja. Probá de nuevo.'
  revalidatePath('/')
  return { numero: Number(numero) }
}

// Deshace el último cierre: se borran el cierre y sus retiros y pases (las cajas vuelven a como estaban).
export async function deshacerCierre(cierreId: string) {
  if (typeof cierreId !== 'string' || !cierreId) return 'No se encontró el cierre.'
  const supabase = await createClient()
  const { error } = await supabase.rpc('deshacer_cierre', { p_cierre_id: cierreId })
  if (error?.code === 'P0001') return error.message
  if (error) return 'No se pudo deshacer el cierre. Probá de nuevo.'
  revalidatePath('/')
  return null
}
