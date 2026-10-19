export const CATEGORIAS = { descartables: 'Descartables', pods: 'Pods', liquidos: 'Líquidos', resistencias: 'Resistencias', baterias_mods: 'Baterías y mods', accesorios: 'Accesorios' }
export type Categoria = keyof typeof CATEGORIAS

export type Producto = {
  id: string
  marca: string
  nombre: string
  categoria: Categoria
  precio_efectivo: number
  precio_transferencia: number
  precio_usd: number
  created_at: string
}
