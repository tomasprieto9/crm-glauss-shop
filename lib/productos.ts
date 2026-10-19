export type Sabor = {
  id: string
  producto_id: string
  nombre: string
  activo: boolean
  stock: number
}

export type Producto = {
  id: string
  marca: string
  nombre: string
  precio_efectivo: number
  precio_transferencia: number
  precio_usd: number | null
  promo_x3: number | null // precio en pesos por 3 unidades del modelo
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

export type Configuracion = { cotizacion_usd: number | null; actualizada_en: string }

export const stockTotal = (producto: Producto) => producto.sabores.reduce((suma, sabor) => suma + sabor.stock, 0)
export const unidadesCompradas = (compra: Compra) => compra.stock_movimientos.reduce((suma, movimiento) => suma + movimiento.cantidad, 0)
