// Registro de actividad (sección "Movimientos"): quién hizo qué y cuándo. Lo escribe la base con triggers.
export const TIPOS_ACTIVIDAD = {
  venta: 'Ventas',
  mercaderia: 'Ingreso de mercadería',
  stock: 'Stock',
  producto: 'Productos',
  caja: 'Caja',
  cliente: 'Clientes',
  configuracion: 'Configuración',
} as const
export type TipoActividad = keyof typeof TIPOS_ACTIVIDAD

export type Actividad = {
  id: number
  fecha: string
  usuario_email: string | null  // null = lo hizo el sistema (scripts o la base)
  tipo: TipoActividad
  accion: string
  detalle: string | null
}

const ZONA = 'America/Argentina/Buenos_Aires'
// Día (AAAA-MM-DD) y hora (14:05) en Argentina.
export const diaArgentina = (fecha: string | Date) => new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA })
export const horaArgentina = (fecha: string) => new Date(fecha).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
