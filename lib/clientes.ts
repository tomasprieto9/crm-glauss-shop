export const SEGMENTOS = { cliente: 'Cliente', no_compro: 'No compró', publicidad: 'Publicidad', comercio: 'Comercio', comercio_prospecto: 'Comercio (prospecto)', sin_etiqueta: 'Sin etiqueta' }
export const ZONAS = { la_plata: 'La Plata', amba: 'AMBA', interior: 'Interior', exterior: 'Exterior' }
export const CONSENTIMIENTOS = { sin_definir: 'Sin definir', si: 'Sí', no: 'No' }
export const ESTADOS_CAMPANA = { pendiente: 'Pendiente', escrito: 'Escrito', respondio: 'Respondió', compro: 'Compró', no_interesa: 'No le interesa' }

export type Segmento = keyof typeof SEGMENTOS
export type Zona = keyof typeof ZONAS
export type Consentimiento = keyof typeof CONSENTIMIENTOS
export type EstadoCampana = keyof typeof ESTADOS_CAMPANA

export type Cliente = {
  id: string
  nombre: string
  telefono: string | null  // algunos contactos están agendados sin teléfono
  segmento: Segmento
  zona: Zona | null
  notas: string | null
  nombre_original: string | null
  consentimiento: Consentimiento
  edad_verificada: boolean
  estado_campana: EstadoCampana
  fecha_ultimo_contacto: string | null
  fecha_ultima_compra: string | null
  created_at: string
}

export type CambiosCliente = Partial<Pick<Cliente, 'notas' | 'consentimiento' | 'edad_verificada' | 'estado_campana'>>

// Fecha en formato dd/mm/aaaa, hora de Argentina. Acepta fechas solas (aaaa-mm-dd) y timestamps.
export function formatearFecha(valor: string | null) {
  if (!valor) return '—'
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`
  return new Date(valor).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Lleva un teléfono a E.164. Sin "+", asume celular argentino escrito con código de área y sin 0 ni 15.
export function normalizarTelefono(texto: string) {
  const digitos = texto.replace(/\D/g, '')
  if (texto.trim().startsWith('+')) return /^\d{8,15}$/.test(digitos) ? `+${digitos}` : null
  if (digitos.length === 10) return `+549${digitos}`
  if (digitos.length === 13 && digitos.startsWith('549')) return `+${digitos}`
  return null
}
