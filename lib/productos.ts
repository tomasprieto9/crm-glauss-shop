export type Sabor = {
  id: string
  producto_id: string
  nombre: string
  codigo: string | null
  activo: boolean
  stock: number // ajustes + entradas - salidas - defectuosos
  entradas: number
  salidas: number
  defectuosos: number
  ajustes: number // stock inicial y correcciones por conteo
}

export type Producto = {
  id: string
  marca: string
  nombre: string
  precio_efectivo: number
  precio_transferencia: number
  precio_usd: number | null
  promo_x3: number | null // precio en pesos por 3 unidades del modelo
  foto_url: string | null
  costo_usd: number | null // costo por unidad; se actualiza con cada ingreso de mercadería
  puffs: number | null // aspiradas; ordena los productos (sin dato = no es por puffs, va al final)
  created_at: string
  sabores: Sabor[]
}

export type Compra = {
  id: string
  numero: number
  producto_id: string
  fecha: string
  costo_unitario_usd: number
  notas: string | null
  created_at: string
  productos: { marca: string; nombre: string } | null
  stock_movimientos: { cantidad: number }[]
}

export type NuevaCompra = {
  productoId: string
  fecha: string
  costoUnitarioUsd: number
  notas: string
  items: { sabor_id: string; cantidad: number }[]
}

export type Configuracion = { cotizacion_usd: number | null; stock_bajo: number; actualizada_en: string }

export type EstadoStock = 'ok' | 'bajo' | 'sin' | 'inactivo'
export const ESTADOS_STOCK: Record<EstadoStock, string> = { ok: 'OK', bajo: 'Bajo stock', sin: 'Sin stock', inactivo: 'Fuera de lista' }
export const estadoStock = (sabor: Sabor, stockBajo: number): EstadoStock => !sabor.activo ? 'inactivo' : sabor.stock <= 0 ? 'sin' : sabor.stock <= stockBajo ? 'bajo' : 'ok'

export const stockTotal = (producto: Producto) => producto.sabores.reduce((suma, sabor) => suma + sabor.stock, 0)
export const unidadesCompradas = (compra: Compra) => compra.stock_movimientos.reduce((suma, movimiento) => suma + movimiento.cantidad, 0)
