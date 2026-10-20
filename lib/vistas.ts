// Secciones del CRM. Se usan en la interfaz y en la página del servidor (para abrir la sección de la dirección).
export type Vista = 'dashboard' | 'clientes' | 'ventas' | 'reactivacion' | 'productos' | 'finanzas' | 'reportes' | 'configuracion'
const VISTAS: Vista[] = ['dashboard', 'clientes', 'ventas', 'reactivacion', 'productos', 'finanzas', 'reportes', 'configuracion']
export const vistaValida = (valor: string | null | undefined): Vista => VISTAS.find(vista => vista === valor) ?? 'dashboard'
