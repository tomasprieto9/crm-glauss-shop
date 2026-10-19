'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Plus, Search, ShoppingBag, Users, X, ArrowLeft, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cerrarSesion } from '@/app/login/actions'
import { actualizarCliente, crearCliente } from '@/app/clientes/actions'
import { guardarProducto } from '@/app/productos/actions'
import { registrarVenta } from '@/app/ventas/actions'
import { ESTADOS_CAMPANA, SEGMENTOS, ZONAS, formatearFecha, type Cliente } from '@/lib/clientes'
import { CATEGORIAS, type Categoria, type Producto } from '@/lib/productos'
import { METODOS_PAGO, RECIBIO, formatearImporte, hoyEnArgentina, precioSegunPago, type MetodoPago, type Venta } from '@/lib/ventas'

const UsuarioContext = createContext('')
const ClientesContext = createContext<Cliente[]>([])

type Vista = 'dashboard' | 'clientes' | 'ventas' | 'reactivacion' | 'productos' | 'finanzas' | 'reportes'

type Client = { id: number; first: string; last: string; phone: string; lastPurchase: string; purchases: number; spent: number; status: 'Activo' | 'A reactivar' }

const initialClients: Client[] = [
  { id: 1, first: 'Marina', last: 'Costa', phone: '+54 9 221 555-0182', lastPurchase: '14/05/2024', purchases: 8, spent: 286400, status: 'Activo' },
  { id: 2, first: 'Rafael', last: 'Mendes', phone: '+54 9 221 555-1430', lastPurchase: '11/05/2024', purchases: 5, spent: 142900, status: 'Activo' },
  { id: 3, first: 'Bianca', last: 'Nunes', phone: '+54 9 221 555-2291', lastPurchase: '08/05/2024', purchases: 6, spent: 198700, status: 'Activo' },
  { id: 4, first: 'Lucas', last: 'Almeida', phone: '+54 9 221 555-3902', lastPurchase: '30/04/2024', purchases: 3, spent: 89500, status: 'Activo' },
  { id: 5, first: 'Sofía', last: 'Romero', phone: '+54 9 221 555-4450', lastPurchase: '25/04/2024', purchases: 4, spent: 156200, status: 'Activo' },
  { id: 6, first: 'Tomás', last: 'Herrera', phone: '+54 9 221 555-5599', lastPurchase: '19/04/2024', purchases: 2, spent: 79600, status: 'A reactivar' },
  { id: 7, first: 'Carla', last: 'Benítez', phone: '+54 9 221 555-6133', lastPurchase: '12/04/2024', purchases: 7, spent: 231400, status: 'Activo' },
  { id: 8, first: 'Nicolás', last: 'Suárez', phone: '+54 9 221 555-7021', lastPurchase: '03/04/2024', purchases: 2, spent: 49800, status: 'A reactivar' },
  { id: 9, first: 'Valentina', last: 'Díaz', phone: '+54 9 221 555-8110', lastPurchase: '27/03/2024', purchases: 5, spent: 174600, status: 'A reactivar' },
  { id: 10, first: 'Martín', last: 'Acosta', phone: '+54 9 221 555-9345', lastPurchase: '18/03/2024', purchases: 3, spent: 83700, status: 'A reactivar' },
  { id: 11, first: 'Julia', last: 'Paz', phone: '+54 9 221 555-1044', lastPurchase: '09/03/2024', purchases: 4, spent: 119400, status: 'A reactivar' },
  { id: 12, first: 'Franco', last: 'Molina', phone: '+54 9 221 555-1188', lastPurchase: '26/02/2024', purchases: 1, spent: 47600, status: 'A reactivar' },
]

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const numero = (value: number) => value.toLocaleString('es-AR')
// Primera letra o número de las dos primeras palabras que tengan alguno (muchos nombres son usuarios de Instagram).
const iniciales = (nombre: string) => nombre.split(/\s+/).map(parte => parte.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const opciones = (etiquetas: Record<string, string>) => Object.entries(etiquetas).map(([clave, etiqueta]) => <option key={clave} value={clave}>{etiqueta}</option>)

const POR_PAGINA = 50
type Filtros = { texto: string; segmento: string; zona: string; pagina: number }
const FILTROS_INICIALES: Filtros = { texto: '', segmento: '', zona: '', pagina: 1 }

export default function CrmApp({ email, clientes, ventas, productos }: { email: string; clientes: Cliente[]; ventas: Venta[]; productos: Producto[] }) {
  return <UsuarioContext value={email}><ClientesContext value={clientes}><Vistas clientes={clientes} ventas={ventas} productos={productos} /></ClientesContext></UsuarioContext>
}

function Vistas({ clientes, ventas, productos }: { clientes: Cliente[]; ventas: Venta[]; productos: Producto[] }) {
  const [view, setView] = useState<Vista>('dashboard')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  // Los filtros viven acá para que no se pierdan al entrar y salir de una ficha.
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const seleccionado = clientes.find(cliente => cliente.id === seleccionadoId)
  const navegar = (vista: Vista) => { setSeleccionadoId(null); setView(vista) }
  // Cada pantalla nueva arranca desde arriba (si no, la ficha se abría scrolleada).
  useEffect(() => { window.scrollTo(0, 0) }, [view, seleccionadoId])

  if (seleccionado) return <FichaCliente key={seleccionado.id} cliente={seleccionado} onBack={() => setSeleccionadoId(null)} onNavigate={navegar} />
  if (view === 'dashboard') return <Dashboard ventas={ventas} clientes={clientes} onNavigate={navegar} />
  if (view === 'ventas') return <Sales ventas={ventas} clientes={clientes} productos={productos} onNavigate={navegar} />
  if (view === 'reactivacion') return <Reactivation clients={initialClients} onNavigate={navegar} />
  if (view === 'productos') return <Products productos={productos} onNavigate={navegar} />
  if (view === 'finanzas') return <Finance onNavigate={navegar} />
  if (view === 'reportes') return <Reports onNavigate={navegar} />
  return <Clientes clientes={clientes} filtros={filtros} onFiltros={setFiltros} onSelect={setSeleccionadoId} onNavigate={navegar} />
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COLORES_CATEGORIA: Record<Categoria, string> = { descartables: 'purple', liquidos: 'mint', resistencias: 'orange', pods: 'blue', baterias_mods: 'gray', accesorios: 'gray' }
const sumarTotales = (ventas: Venta[]) => ventas.reduce((suma, venta) => suma + venta.total, 0)

// Cola de reactivación: pendientes que no dijeron que no; primero quienes compraron y los de La Plata.
function colaReactivacion(clientes: Cliente[]) {
  const orden = (cliente: Cliente) => (cliente.segmento === 'cliente' ? 0 : 2) + (cliente.zona === 'la_plata' ? 0 : 1)
  return clientes
    .filter(cliente => cliente.estado_campana === 'pendiente' && cliente.consentimiento !== 'no' && (cliente.segmento === 'cliente' || cliente.segmento === 'no_compro'))
    .sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, 'es'))
}

// Métricas del mes en curso (hora de Argentina). Las ventas en dólares se suman aparte de los pesos.
function calcularResumen(ventas: Venta[]) {
  const mesActual = hoyEnArgentina().slice(0, 7)
  const delMes = ventas.filter(venta => venta.fecha.startsWith(mesActual))
  const enPesos = delMes.filter(venta => venta.metodo_pago !== 'dolares')
  const ingresos = sumarTotales(enPesos)
  const ingresosUsd = sumarTotales(delMes.filter(venta => venta.metodo_pago === 'dolares'))

  const primeraCompra = new Map<string, string>()
  for (const venta of ventas) {
    const anterior = primeraCompra.get(venta.cliente_id)
    if (!anterior || venta.fecha < anterior) primeraCompra.set(venta.cliente_id, venta.fecha)
  }

  const porProducto = new Map<string, { marca: string; nombre: string; unidades: number; facturado: number }>()
  const porCategoria = new Map<string, number>()
  for (const venta of delMes) {
    for (const item of venta.venta_items) {
      const clave = item.producto_id ?? item.descripcion
      const actual = porProducto.get(clave) ?? { marca: item.productos?.marca ?? '—', nombre: item.productos?.nombre ?? item.descripcion, unidades: 0, facturado: 0 }
      actual.unidades += item.cantidad
      if (venta.metodo_pago !== 'dolares') actual.facturado += item.subtotal
      porProducto.set(clave, actual)
      if (item.productos) porCategoria.set(item.productos.categoria, (porCategoria.get(item.productos.categoria) ?? 0) + item.cantidad)
    }
  }

  const [anio, mes] = mesActual.split('-').map(Number)
  const meses = Array.from({ length: 6 }, (_, i) => {
    const fecha = new Date(anio, mes - 6 + i, 1)
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    return { clave, etiqueta: MESES[fecha.getMonth()], ingresos: sumarTotales(ventas.filter(venta => venta.metodo_pago !== 'dolares' && venta.fecha.startsWith(clave))), egresos: 0 }
  })

  return {
    cantidad: delMes.length,
    ingresos,
    ingresosUsd,
    egresos: 0, // todavía no hay egresos cargados (Finanzas)
    ticket: enPesos.length ? Math.round(ingresos / enPesos.length) : 0,
    clientesNuevos: [...primeraCompra.values()].filter(fecha => fecha.startsWith(mesActual)).length,
    top: [...porProducto.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5),
    porCategoria,
    meses,
  }
}

function Dashboard({ ventas, clientes, onNavigate }: { ventas: Venta[]; clientes: Cliente[]; onNavigate: (view: Vista) => void }) {
  const resumen = useMemo(() => calcularResumen(ventas), [ventas])
  const cola = useMemo(() => colaReactivacion(clientes), [clientes])
  const categorias = Object.entries(CATEGORIAS).map(([clave, etiqueta]) => ({ clave, etiqueta, valor: resumen.porCategoria.get(clave) ?? 0, color: COLORES_CATEGORIA[clave as Categoria] }))
  const unidadesCategorias = categorias.reduce((suma, categoria) => suma + categoria.valor, 0)
  let acumulado = 0
  const dona = unidadesCategorias === 0 ? '#efedf5' : `conic-gradient(${categorias.filter(categoria => categoria.valor > 0).map(categoria => { const desde = acumulado / unidadesCategorias * 100; acumulado += categoria.valor; return `var(--report-${categoria.color}) ${desde}% ${acumulado / unidadesCategorias * 100}%` }).join(', ')})`
  const maxBarra = Math.max(1, ...resumen.meses.map(mes => Math.max(mes.ingresos, mes.egresos)))
  const ingresosTexto = money(resumen.ingresos) + (resumen.ingresosUsd ? ` + US$ ${numero(resumen.ingresosUsd)}` : '')
  const top = resumen.top[0]
  return <main className="app-shell"><Sidebar active="Resumen" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Dashboard</strong></div></header><div className="content-wrap dashboard-page"><div className="page-heading"><div><p className="eyebrow">RESUMEN DEL NEGOCIO</p><h1>Dashboard</h1><p className="heading-subtitle">Una mirada rápida a lo que está pasando en tu tienda este mes.</p></div></div><div className="metrics-grid dashboard-metrics"><Metric icon={<span className="metric-dot green" />} label="Ingresos del mes" value={ingresosTexto} tone="mint" /><Metric icon={<span className="metric-dot red" />} label="Egresos del mes" value={money(resumen.egresos)} tone="peach" /><Metric icon={<span className="metric-dot purple" />} label="Ganancia neta" value={money(resumen.ingresos - resumen.egresos)} tone="purple" /><Metric icon={<ShoppingBag />} label="Cantidad de ventas" value={numero(resumen.cantidad)} tone="blue" /></div><div className="metrics-grid dashboard-metrics secondary"><Metric icon={<span className="metric-dot purple" />} label="Ticket promedio" value={money(resumen.ticket)} tone="purple" /><Metric icon={<Users />} label="Clientes nuevos del mes" value={numero(resumen.clientesNuevos)} tone="blue" /><Metric icon={<span className="metric-dot orange" />} label="Clientes a reactivar" value={numero(cola.length)} tone="peach" /><Metric icon={<ShoppingBag />} label="Producto top del mes" value={top ? `${top.marca} ${top.nombre}` : '—'} tone="mint" /></div><div className="dashboard-grid dashboard-chart-row"><div className="card dashboard-chart-card"><div className="card-head"><div><h2>Ingresos vs Egresos</h2><p>Últimos 6 meses · en pesos</p></div><div className="finance-legend"><span><i className="legend-income" />Ingresos</span><span><i className="legend-expense" />Egresos</span></div></div><div className="dashboard-line-chart">{resumen.meses.map(mes => <div className="dashboard-month" key={mes.clave}><div className="dashboard-bars"><i className="dashboard-income" title={`Ingresos ${money(mes.ingresos)}`} style={{ height: `${(mes.ingresos / maxBarra) * 140}px` }} /><i className="dashboard-expense" title={`Egresos ${money(mes.egresos)}`} style={{ height: `${(mes.egresos / maxBarra) * 140}px` }} /></div><small>{mes.etiqueta}</small></div>)}</div></div><div className="card dashboard-chart-card category-card"><div className="card-head"><div><h2>Ventas por categoría</h2><p>Unidades vendidas este mes</p></div></div><div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{ background: dona }}><div><strong>{numero(resumen.cantidad)}</strong><span>{resumen.cantidad === 1 ? 'venta' : 'ventas'}</span></div></div><div className="donut-legend">{categorias.map(categoria => <span key={categoria.clave}><i className={categoria.color} />{categoria.etiqueta}<b>{unidadesCategorias ? Math.round(categoria.valor / unidadesCategorias * 100) : 0}%</b></span>)}</div></div></div></div><div className="dashboard-grid dashboard-bottom-row"><div className="card dashboard-table-card"><div className="card-head"><div><h2>Top 5 productos más vendidos</h2><p>Por unidades vendidas este mes</p></div></div><div className="sales-table-wrap"><table className="dashboard-table"><thead><tr><th>Producto</th><th>Marca</th><th>Unidades</th><th>Facturado</th></tr></thead><tbody>{resumen.top.length === 0 ? <tr><td colSpan={4} className="dashboard-vacio">Todavía no hay ventas este mes.</td></tr> : resumen.top.map(producto => <tr key={`${producto.marca}-${producto.nombre}`}><td><strong>{producto.nombre}</strong></td><td>{producto.marca}</td><td>{numero(producto.unidades)}</td><td><strong>{money(producto.facturado)}</strong></td></tr>)}</tbody></table></div></div><div className="card reactivation-card"><div className="card-head"><div><h2>Clientes a reactivar</h2><p>Los próximos de la cola</p></div><button className="text-link" onClick={() => onNavigate('reactivacion')}>Ver todos</button></div><div className="reactivation-list">{cola.length === 0 ? <p className="dashboard-vacio">No hay clientes pendientes.</p> : cola.slice(0, 5).map(cliente => <div className="reactivation-item" key={cliente.id}><div className="mini-avatar">{iniciales(cliente.nombre)}</div><div><strong>{cliente.nombre}</strong><span>{SEGMENTOS[cliente.segmento]}{cliente.zona && ` · ${ZONAS[cliente.zona]}`}</span></div></div>)}</div></div></div></div></section></main>
}

function SeccionVacia({ active, breadcrumb, eyebrow, title, subtitle, mensaje, onNavigate }: { active: string; breadcrumb: string; eyebrow: string; title: string; subtitle: string; mensaje: string; onNavigate: (view: Vista) => void }) { return <main className="app-shell"><Sidebar active={active} onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>{breadcrumb}</strong></div></header><div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-subtitle">{subtitle}</p></div></div><div className="card empty-state">{mensaje}</div></div></section></main> }

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <Card className="metric-card"><CardContent className="p-0"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-title">{label}</span><div className="metric-value">{value}</div></CardContent></Card> }

function Sidebar({ active, onNavigate }: { active: string; onNavigate?: (view: Vista) => void }) { const email = useContext(UsuarioContext); const totalClientes = useContext(ClientesContext).length; const [abierto, setAbierto] = useState(false); const ir = (vista: Vista) => { setAbierto(false); onNavigate?.(vista) }; const marca = <div className="brand"><span className="brand-mark">g</span><span>glauss</span><span className="brand-dot">.</span></div>; return <><div className="mobile-bar"><button className="menu-button" aria-label="Abrir menú" onClick={() => setAbierto(true)}><Menu /></button>{marca}</div>{abierto && <div className="sidebar-fondo" onClick={() => setAbierto(false)} />}<aside className={`sidebar ${abierto ? 'abierto' : ''}`}><div className="sidebar-top">{marca}<button className="menu-cerrar" aria-label="Cerrar menú" onClick={() => setAbierto(false)}><X /></button></div><nav className="nav-list"><span className="nav-label">MENU PRINCIPAL</span>{[['Resumen', '◈'], ['Ventas', '▣'], ['Clientes', '♙'], ['Reactivación', '↻'], ['Productos y stock', '□'], ['Finanzas', '$'], ['Reportes', '▤']].map(([label, icon]) => <button key={label} onClick={() => label === 'Resumen' ? ir('dashboard') : label === 'Clientes' ? ir('clientes') : label === 'Ventas' ? ir('ventas') : label === 'Reactivación' ? ir('reactivacion') : label === 'Productos y stock' ? ir('productos') : label === 'Finanzas' ? ir('finanzas') : label === 'Reportes' ? ir('reportes') : undefined} className={`nav-item ${label === active ? 'active' : ''}`}><span className="nav-glyph">{icon}</span>{label}{label === 'Clientes' && <span className="nav-count">{numero(totalClientes)}</span>}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item">? <span>Central de ayuda</span></button><button className="nav-item">⚙ <span>Configuración</span></button><div className="profile"><div className="profile-avatar">{email.charAt(0).toUpperCase()}</div><div><strong title={email}>{email}</strong><form action={cerrarSesion}><button className="logout-button">Cerrar sesión</button></form></div></div></div></aside></> }

function Products({ productos, onNavigate }: { productos: Producto[]; onNavigate: (view: Vista) => void }) {
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [marca, setMarca] = useState('')
  const marcas = useMemo(() => marcasDe(productos), [productos])
  const buscado = normalizar(busqueda.trim())
  const visibles = productos.filter(producto => (!marca || producto.marca === marca) && (!buscado || normalizar(`${producto.marca} ${producto.nombre}`).includes(buscado)))
  return <main className="app-shell"><Sidebar active="Productos y stock" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Productos y Stock</strong></div></header><div className="content-wrap products-page"><div className="page-heading"><div><p className="eyebrow">CATÁLOGO E INVENTARIO</p><h1>Productos y Stock</h1><p className="heading-subtitle">Tu catálogo con el precio de cada producto según el medio de pago.</p></div><button className="quick-button" onClick={() => setEditando('nuevo')}><Plus /> Nuevo producto</button></div>{productos.length === 0 ? <div className="card empty-state">Todavía no hay productos cargados. Tocá “Nuevo producto” para cargar el primero.</div> : <><div className="clients-toolbar"><label className="search-control"><Search /><input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar producto o marca..." /></label><Filtro valor={marca} etiquetas={Object.fromEntries(marcas.map(nombre => [nombre, nombre]))} todos="Todas las marcas" onChange={setMarca} /><span className="result-count">{numero(visibles.length)} productos</span></div><div className="card clients-table-card"><div className="clients-table-head"><div><h2>Catálogo</h2><p>Tocá un producto para editarlo o cambiarle los precios</p></div></div><div className="sales-table-wrap"><table className="clients-table"><thead><tr><th>Marca</th><th>Producto</th><th>Categoría</th><th>Efectivo</th><th>Transferencia</th><th>Dólares</th></tr></thead><tbody>{visibles.map(producto => <tr key={producto.id} tabIndex={0} onClick={() => setEditando(producto)} onKeyDown={event => event.key === 'Enter' && setEditando(producto)}><td>{producto.marca}</td><td><strong>{producto.nombre}</strong></td><td><span className="category-pill">{CATEGORIAS[producto.categoria]}</span></td><td>{formatearImporte(producto.precio_efectivo, 'efectivo')}</td><td>{formatearImporte(producto.precio_transferencia, 'transferencia')}</td><td>{formatearImporte(producto.precio_usd, 'dolares')}</td></tr>)}</tbody></table>{visibles.length === 0 && <div className="empty-state">Ningún producto coincide con la búsqueda.</div>}</div></div></>}</div></section>{editando && <ProductoModal producto={editando === 'nuevo' ? null : editando} marcas={marcas} onClose={() => setEditando(null)} />}</main>
}

const marcasDe = (productos: Producto[]) => [...new Set(productos.map(producto => producto.marca))].sort((a, b) => a.localeCompare(b, 'es'))

function ProductoModal({ producto, marcas, onClose }: { producto: Producto | null; marcas: string[]; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const problema = await guardarProducto(producto?.id ?? null, formData)
      if (problema) setError(problema)
      else terminar()
    })
  }
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal producto-modal" role="dialog" aria-modal="true" aria-labelledby="producto-title"><header><div><p className="eyebrow">CATÁLOGO</p><h2 id="producto-title">{producto ? 'Editar producto' : 'Nuevo producto'}</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><form onSubmit={enviar}><div className="modal-body"><div className="modal-fields"><label className="field"><span>Marca</span><input name="marca" required list="marcas-existentes" defaultValue={producto?.marca} placeholder="Ej. Elfbar" /><datalist id="marcas-existentes">{marcas.map(nombre => <option key={nombre} value={nombre} />)}</datalist></label><label className="field"><span>Categoría</span><select name="categoria" defaultValue={producto?.categoria ?? 'descartables'}>{opciones(CATEGORIAS)}</select></label></div><label className="field"><span>Producto</span><input name="nombre" required defaultValue={producto?.nombre} placeholder="Ej. BC5000 Blue Razz" /></label><div className="precios-producto"><label className="field"><span>Efectivo ($)</span><input name="precio_efectivo" type="number" min="0" step="0.01" required defaultValue={producto?.precio_efectivo} /></label><label className="field"><span>Transferencia ($)</span><input name="precio_transferencia" type="number" min="0" step="0.01" required defaultValue={producto?.precio_transferencia} /></label><label className="field"><span>Dólares (US$)</span><input name="precio_usd" type="number" min="0" step="0.01" required defaultValue={producto?.precio_usd} /></label></div>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar producto'}</button></footer></form></section></div>
}

function Sales({ ventas, clientes, productos, onNavigate }: { ventas: Venta[]; clientes: Cliente[]; productos: Producto[]; onNavigate: (view: Vista) => void }) {
  const [mostrarNueva, setMostrarNueva] = useState(false)
  return <main className="app-shell"><Sidebar active="Ventas" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ventas</strong></div></header><div className="content-wrap sales-page"><div className="page-heading"><div><p className="eyebrow">HISTORIAL COMERCIAL</p><h1>Ventas</h1><p className="heading-subtitle">Registrá y consultá las ventas de tu tienda.</p></div><button className="quick-button" onClick={() => setMostrarNueva(true)}><Plus /> Nueva venta</button></div>{ventas.length === 0 ? <div className="card empty-state">Todavía no hay ventas cargadas.</div> : <div className="card clients-table-card"><div className="sales-table-top"><div><h2>Historial de ventas</h2><p>{numero(ventas.length)} {ventas.length === 1 ? 'venta registrada' : 'ventas registradas'}</p></div></div><div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Productos y precio de venta</th><th>Pago</th><th>Recibió</th><th>Total</th></tr></thead><tbody>{ventas.map(venta => <tr key={venta.id}><td><strong>#{venta.numero}</strong></td><td>{formatearFecha(venta.fecha)}</td><td><strong>{venta.clientes?.nombre ?? '—'}</strong></td><td><div className="venta-items-celda">{venta.venta_items.map(item => <span key={item.id}>{item.cantidad} × {item.descripcion} · <b>{formatearImporte(item.precio_unitario, venta.metodo_pago)} c/u</b>{item.precio_unitario !== item.precio_lista && <s title="Precio de lista">{formatearImporte(item.precio_lista, venta.metodo_pago)}</s>}</span>)}</div></td><td><span className={`payment-pill ${venta.metodo_pago}`}>{METODOS_PAGO[venta.metodo_pago]}</span></td><td>{RECIBIO[venta.recibio]}</td><td><strong>{formatearImporte(venta.total, venta.metodo_pago)}</strong>{venta.total !== venta.total_lista && <small className="venta-lista">lista {formatearImporte(venta.total_lista, venta.metodo_pago)}</small>}</td></tr>)}</tbody></table></div></div>}</div></section>{mostrarNueva && <NuevaVentaModal clientes={clientes} productos={productos} onClose={() => setMostrarNueva(false)} onIrAProductos={() => { setMostrarNueva(false); onNavigate('productos') }} />}</main>
}

function Finance({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Finanzas" breadcrumb="Finanzas" eyebrow="CONTROL FINANCIERO" title="Finanzas" subtitle="Seguí tus ingresos, egresos y balance mes a mes." mensaje="Todavía no hay movimientos cargados." onNavigate={onNavigate} /> }

function Reports({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Reportes" breadcrumb="Reportes" eyebrow="ANÁLISIS DEL NEGOCIO" title="Reportes" subtitle="Entendé qué se vende y cómo evoluciona tu tienda." mensaje="Los reportes se arman en la próxima etapa, con las ventas que se vayan cargando." onNavigate={onNavigate} /> }

function Reactivation({ clients, onNavigate }: { clients: Client[]; onNavigate: (view: Vista) => void }) {
  const [threshold, setThreshold] = useState(30)
  const reference = new Date('2024-06-20T12:00:00')
  const rows = clients.map((client, index) => {
    const [day, month, year] = client.lastPurchase.split('/').map(Number)
    const date = new Date(year, month - 1, day)
    const days = Math.max(31, Math.floor((reference.getTime() - date.getTime()) / 86400000) + index * 2)
    return { client, days, product: ['Pod menta + líquido 30ml', 'Líquido frutilla x2', 'Resistencia 0.8Ω + pod', 'Líquido sandía 60ml'][index % 4] }
  }).filter(row => row.days >= threshold).sort((a, b) => b.days - a.days)
  const potential = rows.reduce((sum, row) => sum + row.client.spent / Math.max(row.client.purchases, 1), 0)
  const whatsapp = (row: typeof rows[number]) => `https://wa.me/${row.client.phone.replace(/\\D/g, '')}?text=${encodeURIComponent(`Hola ${row.client.first}! Tenemos novedades en Glauss 🌬️`)}`
  return <main className="app-shell"><Sidebar active="Reactivación" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Reactivación</strong></div></header><div className="content-wrap reactivation-page"><div className="page-heading"><div><p className="eyebrow">RECUPERÁ CLIENTES</p><h1>Reactivación</h1><p className="heading-subtitle">Clientes que no compran hace más de 30 días</p></div></div><div className="metrics-grid reactivation-metrics"><Metric icon={<span className="metric-dot orange" />} label="Total a reactivar" value={rows.length.toString()} tone="peach" /><Metric icon={<span className="metric-dot purple" />} label="Facturación potencial recuperable" value={money(Math.round(potential))} tone="purple" /></div><div className="reactivation-toolbar"><div className="filter-pills" role="group" aria-label="Filtrar por antigüedad">{[30, 45, 60, 90].map(days => <button key={days} className={threshold === days ? 'filter-pill selected' : 'filter-pill'} onClick={() => setThreshold(days)}>{days}+</button>)}</div><span className="result-count">{rows.length} clientes</span></div><div className="card clients-table-card reactivation-table-card"><div className="clients-table-head"><div><h2>Clientes para contactar</h2><p>Ordenados por tiempo desde la última compra</p></div></div><div className="sales-table-wrap"><table className="clients-table reactivation-table"><thead><tr><th>Nombre y apellido</th><th>Teléfono</th><th>Última compra</th><th>Días sin comprar</th><th>Qué compró la última vez</th><th>Total histórico gastado</th><th></th></tr></thead><tbody>{rows.map(row => <tr key={row.client.id}><td><strong>{row.client.first} {row.client.last}</strong></td><td>{row.client.phone}</td><td>{row.client.lastPurchase}</td><td><span className={`days-pill ${row.days >= 90 ? 'danger' : 'warning'}`}>{row.days} días</span></td><td>{row.product}</td><td><strong>{money(row.client.spent)}</strong></td><td><a className="contact-whatsapp" href={whatsapp(row)} target="_blank" rel="noreferrer"><Phone /> Contactar por WhatsApp</a></td></tr>)}</tbody></table></div></div></div></section></main>
}

function filtrarClientes(clientes: Cliente[], { texto, segmento, zona }: Filtros) {
  const buscado = normalizar(texto.trim())
  const digitos = texto.replace(/\D/g, '')
  return clientes.filter(cliente =>
    (!segmento || cliente.segmento === segmento) &&
    (!zona || cliente.zona === zona) &&
    (!buscado || normalizar(`${cliente.nombre} ${cliente.nombre_original ?? ''}`).includes(buscado) || (digitos.length >= 3 && cliente.telefono.includes(digitos))))
}

function Clientes({ clientes, filtros, onFiltros, onSelect, onNavigate }: { clientes: Cliente[]; filtros: Filtros; onFiltros: (filtros: Filtros) => void; onSelect: (id: string) => void; onNavigate: (view: Vista) => void }) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const filtrados = useMemo(() => filtrarClientes(clientes, filtros), [clientes, filtros])
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const pagina = Math.min(filtros.pagina, paginas)
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const desde = (pagina - 1) * POR_PAGINA + 1
  const filtrar = (cambios: Partial<Filtros>) => onFiltros({ ...filtros, ...cambios, pagina: 1 })
  const irAPagina = (nueva: number) => onFiltros({ ...filtros, pagina: nueva })
  const compraron = clientes.filter(cliente => cliente.segmento === 'cliente').length
  const sinContactar = clientes.filter(cliente => cliente.estado_campana === 'pendiente').length
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Clientes</strong></div></header><div className="content-wrap clients-page"><div className="page-heading clients-heading"><div><p className="eyebrow">RELACIÓN CON CLIENTES</p><h1>Clientes</h1><p className="heading-subtitle">Conocé y gestioná a las personas que eligen tu tienda.</p></div><button className="quick-button" onClick={() => setMostrarNuevo(true)}><Plus /> Nuevo cliente</button></div><div className="metrics-grid clients-metrics"><Metric icon={<Users />} label="Total de clientes" value={numero(clientes.length)} tone="purple" /><Metric icon={<span className="metric-dot green" />} label="Compraron alguna vez" value={numero(compraron)} tone="mint" /><Metric icon={<span className="metric-dot orange" />} label="Sin contactar todavía" value={numero(sinContactar)} tone="peach" /></div><div className="clients-toolbar"><label className="search-control"><Search /><input value={filtros.texto} onChange={event => filtrar({ texto: event.target.value })} placeholder="Buscar por nombre o teléfono..." /></label><Filtro valor={filtros.segmento} etiquetas={SEGMENTOS} todos="Todos los segmentos" onChange={segmento => filtrar({ segmento })} /><Filtro valor={filtros.zona} etiquetas={ZONAS} todos="Todas las zonas" onChange={zona => filtrar({ zona })} /><span className="result-count">{numero(filtrados.length)} clientes</span></div><div className="card clients-table-card"><div className="clients-table-head"><div><h2>Base de clientes</h2><p>Tocá un cliente para ver su ficha</p></div></div><div className="sales-table-wrap"><table className="clients-table"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Segmento</th><th>Zona</th><th>Campaña</th><th>Último contacto</th></tr></thead><tbody>{visibles.map(cliente => <tr key={cliente.id} tabIndex={0} onClick={() => onSelect(cliente.id)} onKeyDown={event => event.key === 'Enter' && onSelect(cliente.id)}><td><div className="client-table"><span>{iniciales(cliente.nombre)}</span><strong>{cliente.nombre}</strong></div></td><td>{cliente.telefono}</td><td>{SEGMENTOS[cliente.segmento]}</td><td>{cliente.zona ? ZONAS[cliente.zona] : '—'}</td><td><span className={`status-pill campana-${cliente.estado_campana}`}>{ESTADOS_CAMPANA[cliente.estado_campana]}</span></td><td>{formatearFecha(cliente.fecha_ultimo_contacto)}</td></tr>)}</tbody></table>{visibles.length === 0 && <div className="empty-state">Ningún cliente coincide con la búsqueda.</div>}</div><div className="clients-footer"><span>{filtrados.length === 0 ? 'Sin resultados' : `Mostrando ${numero(desde)}–${numero(desde + visibles.length - 1)} de ${numero(filtrados.length)}`}</span><div><button className="pagination-button" disabled={pagina === 1} onClick={() => irAPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft /></button><span className="pagination-current" aria-label={`Página ${pagina} de ${paginas}`}>{pagina}</span><button className="pagination-button" disabled={pagina === paginas} onClick={() => irAPagina(pagina + 1)} aria-label="Página siguiente"><ChevronRight /></button></div></div></div></div></section>{mostrarNuevo && <NuevoCliente onClose={() => setMostrarNuevo(false)} />}</main>
}

function Filtro({ valor, etiquetas, todos, onChange }: { valor: string; etiquetas: Record<string, string>; todos: string; onChange: (valor: string) => void }) { return <label className="filter-control"><select value={valor} onChange={event => onChange(event.target.value)} aria-label={todos}><option value="">{todos}</option>{opciones(etiquetas)}</select><ChevronDown /></label> }

function FichaCliente({ cliente, onBack, onNavigate }: { cliente: Cliente; onBack: () => void; onNavigate: (view: Vista) => void }) {
  const [notas, setNotas] = useState(cliente.notas ?? '')
  const [guardando, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardarNotas = () => startTransition(async () => {
    const error = await actualizarCliente(cliente.id, { notas })
    setResultado(error ? { ok: false, texto: error } : { ok: true, texto: 'Notas guardadas.' })
  })
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ficha de cliente</strong></div></header><div className="content-wrap client-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft /> Volver a clientes</button><div className="detail-heading"><div><p className="eyebrow">FICHA DE CLIENTE</p><h1>{cliente.nombre}</h1><p className="heading-subtitle">{SEGMENTOS[cliente.segmento]}{cliente.zona && ` · ${ZONAS[cliente.zona]}`}</p></div>{guardando ? <span className="ficha-estado">Guardando…</span> : resultado && <span className={`ficha-estado ${resultado.ok ? 'ok' : 'error'}`} role="status">{resultado.texto}</span>}</div><div className="detail-columns"><div className="card profile-card"><div className="section-title"><div><h2>Datos</h2><p>Cómo está cargado en la base</p></div></div><dl className="ficha-datos"><dt>Teléfono</dt><dd>{cliente.telefono}</dd><dt>Agendado como</dt><dd>{cliente.nombre_original ?? '—'}</dd><dt>Segmento</dt><dd>{SEGMENTOS[cliente.segmento]}</dd><dt>Zona</dt><dd>{cliente.zona ? ZONAS[cliente.zona] : '—'}</dd><dt>Último contacto</dt><dd>{formatearFecha(cliente.fecha_ultimo_contacto)}</dd><dt>Última compra</dt><dd>{formatearFecha(cliente.fecha_ultima_compra)}</dd><dt>Cargado el</dt><dd>{formatearFecha(cliente.created_at)}</dd></dl></div><div className="card notes-card"><div className="section-title"><div><h2>Notas</h2><p>Información útil sobre este cliente</p></div></div><label className="field ficha-notas"><textarea value={notas} onChange={event => setNotas(event.target.value)} rows={4} placeholder="Ej. prefiere pods de menta" aria-label="Notas" /></label><button className="quick-button" disabled={guardando || notas.trim() === (cliente.notas ?? '')} onClick={guardarNotas}>Guardar notas</button></div></div></div></section></main>
}

// Cierra el modal recién cuando terminó de guardar y la pantalla ya muestra los datos nuevos.
function useCerrarAlTerminar(guardando: boolean, onClose: () => void) {
  const [listo, setListo] = useState(false)
  useEffect(() => { if (listo && !guardando) onClose() }, [listo, guardando, onClose])
  return () => setListo(true)
}

function NuevoCliente({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const problema = await crearCliente(formData)
      if (problema) setError(problema)
      else terminar()
    })
  }
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title"><header><div><p className="eyebrow">NUEVO REGISTRO</p><h2 id="new-client-title">Nuevo cliente</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><form onSubmit={enviar}><div className="modal-body"><label className="field"><span>Nombre</span><input name="nombre" required placeholder="Ej. Martina González" /></label><label className="field"><span>Teléfono</span><input name="telefono" required inputMode="tel" placeholder="Ej. 221 438 3399" /></label><div className="modal-fields"><label className="field"><span>Segmento</span><select name="segmento" defaultValue="cliente">{opciones(SEGMENTOS)}</select></label><label className="field"><span>Zona</span><select name="zona" defaultValue="la_plata">{opciones(ZONAS)}</select></label></div><label className="field"><span>Notas <em>(opcional)</em></span><textarea name="notas" rows={3} placeholder="Ej. prefiere pods de menta" /></label><label className="ficha-check"><input type="checkbox" name="mayor_de_18" value="si" required />Es mayor de 18 años</label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cliente'}</button></footer></form></section></div>
}

type LineaVenta = { clave: number; marca: string; productoId: string; cantidad: string }
const lineaVacia = (clave: number): LineaVenta => ({ clave, marca: '', productoId: '', cantidad: '1' })

function NuevaVentaModal({ clientes, productos, onClose, onIrAProductos }: { clientes: Cliente[]; productos: Producto[]; onClose: () => void; onIrAProductos: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNuevo, setClienteNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [lineas, setLineas] = useState([lineaVacia(1)])
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [recibio, setRecibio] = useState('')
  const [fecha, setFecha] = useState(hoyEnArgentina)
  const [totalManual, setTotalManual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  const sugeridos = useMemo(() => busqueda.trim() ? filtrarClientes(clientes, { ...FILTROS_INICIALES, texto: busqueda }).slice(0, 5) : [], [clientes, busqueda])
  const marcas = useMemo(() => marcasDe(productos), [productos])
  const porId = useMemo(() => new Map(productos.map(producto => [producto.id, producto])), [productos])

  // Precios de lista según el medio de pago elegido; si se carga un total cobrado distinto,
  // cada producto se ajusta en la misma proporción (igual que lo guarda la base).
  const importe = (valor: number) => formatearImporte(valor, metodoPago)
  const precioLista = (linea: LineaVenta) => { const producto = porId.get(linea.productoId); return producto ? precioSegunPago(producto, metodoPago) : 0 }
  const unidades = (linea: LineaVenta) => Number(linea.cantidad) || 0
  const totalLista = lineas.reduce((suma, linea) => suma + precioLista(linea) * unidades(linea), 0)
  const totalUnidades = lineas.reduce((suma, linea) => suma + unidades(linea), 0)
  const hayTotalManual = totalManual.trim() !== ''
  const totalCobrado = hayTotalManual ? Number(totalManual) : totalLista
  const totalValido = Number.isFinite(totalCobrado) && totalCobrado >= 0
  const ajustado = hayTotalManual && totalValido && totalCobrado !== totalLista
  const precioVenta = (linea: LineaVenta) => totalLista > 0 ? Math.round(precioLista(linea) * totalCobrado / totalLista * 100) / 100 : totalUnidades ? Math.round(totalCobrado / totalUnidades * 100) / 100 : 0

  const cambiarLinea = (clave: number, cambios: Partial<LineaVenta>) => setLineas(actuales => actuales.map(linea => linea.clave === clave ? { ...linea, ...cambios } : linea))
  const hayCliente = cliente !== null || (clienteNuevo && nuevoNombre.trim() !== '' && nuevoTelefono.trim() !== '')
  const lineasCompletas = lineas.every(linea => linea.productoId !== '' && Number.isInteger(Number(linea.cantidad)) && Number(linea.cantidad) >= 1)
  const elegirClienteNuevo = () => { setClienteNuevo(true); if (!/\d/.test(busqueda)) setNuevoNombre(busqueda.trim()); else setNuevoTelefono(busqueda.trim()) }
  const guardar = () => startTransition(async () => {
    const problema = await registrarVenta({ clienteId: cliente?.id ?? null, nuevoNombre, nuevoTelefono, fecha, metodoPago, recibio, total: hayTotalManual ? Number(totalManual) : null, items: lineas.map(linea => ({ producto_id: linea.productoId, cantidad: Number(linea.cantidad) })) })
    if (problema) setError(problema)
    else terminar()
  })
  const campoCliente = cliente
    ? <div className="venta-cliente"><div><strong>{cliente.nombre}</strong><small>{cliente.telefono}</small></div><button type="button" className="text-button" onClick={() => setCliente(null)}>Cambiar</button></div>
    : clienteNuevo
      ? <><div className="modal-fields"><input value={nuevoNombre} onChange={event => setNuevoNombre(event.target.value)} placeholder="Nombre" aria-label="Nombre del cliente nuevo" /><input value={nuevoTelefono} onChange={event => setNuevoTelefono(event.target.value)} inputMode="tel" placeholder="Teléfono (ej. 221 438 3399)" aria-label="Teléfono del cliente nuevo" /></div><button type="button" className="text-button" onClick={() => setClienteNuevo(false)}>Buscar un cliente existente</button></>
      : <><input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar cliente por nombre o teléfono..." aria-label="Buscar cliente" />{busqueda.trim() && <div className="autocomplete-list">{sugeridos.map(sugerido => <button type="button" key={sugerido.id} onClick={() => { setCliente(sugerido); setBusqueda('') }}>{sugerido.nombre}<small>{sugerido.telefono}</small></button>)}<button type="button" className="create-client-option" onClick={elegirClienteNuevo}>+ Cliente nuevo</button></div>}</>
  const campoProductos = productos.length === 0
    ? <p className="empty-items">Todavía no hay productos cargados. <button type="button" className="text-link" onClick={onIrAProductos}>Cargalos en Productos y stock</button></p>
    : <><div className="venta-lineas">{lineas.map(linea => <div className="venta-linea" key={linea.clave}><select className="venta-marca" value={linea.marca} onChange={event => cambiarLinea(linea.clave, { marca: event.target.value, productoId: '' })} aria-label="Marca"><option value="">Marca</option>{marcas.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}</select><select className="venta-producto" value={linea.productoId} disabled={!linea.marca} onChange={event => cambiarLinea(linea.clave, { productoId: event.target.value })} aria-label="Producto"><option value="">{linea.marca ? 'Producto' : 'Elegí la marca primero'}</option>{productos.filter(producto => producto.marca === linea.marca).map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select><input type="number" min="1" step="1" value={linea.cantidad} onChange={event => cambiarLinea(linea.clave, { cantidad: event.target.value })} aria-label="Cantidad" /><div className="venta-precio">{linea.productoId ? <><strong>{importe((ajustado ? precioVenta(linea) : precioLista(linea)) * unidades(linea))}</strong><small>{ajustado ? <>{importe(precioVenta(linea))} c/u <s>{importe(precioLista(linea))}</s></> : `${importe(precioLista(linea))} c/u`}</small></> : <small>—</small>}</div><button type="button" className="close-button" disabled={lineas.length === 1} onClick={() => setLineas(actuales => actuales.filter(otra => otra.clave !== linea.clave))} aria-label="Quitar producto"><X /></button></div>)}</div><button type="button" className="text-button" onClick={() => setLineas(actuales => [...actuales, lineaVacia((actuales.at(-1)?.clave ?? 0) + 1)])}><Plus /> Agregar otro producto</button></>
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="new-sale-title"><header><div><p className="eyebrow">REGISTRAR OPERACIÓN</p><h2 id="new-sale-title">Nueva venta</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><div className="field"><span>Cliente</span>{campoCliente}</div><div className="modal-fields"><label className="field"><span>Medio de pago</span><select value={metodoPago} onChange={event => setMetodoPago(event.target.value as MetodoPago)}>{opciones(METODOS_PAGO)}</select></label><label className="field"><span>Quién recibió el pago</span><select value={recibio} onChange={event => setRecibio(event.target.value)}><option value="">Elegí</option>{opciones(RECIBIO)}</select></label></div><div className="field"><span>Productos</span>{campoProductos}</div><div className="modal-fields"><label className="field"><span>Fecha</span><input type="date" value={fecha} max={hoyEnArgentina()} onChange={event => setFecha(event.target.value)} /></label><label className="field"><span>Total cobrado <em>(si hubo descuento)</em></span><input type="number" min="0" step="0.01" value={totalManual} onChange={event => setTotalManual(event.target.value)} placeholder={`Lista: ${importe(totalLista)}`} aria-label="Total cobrado" /></label></div>{ajustado && <p className="venta-ajuste">{totalCobrado < totalLista ? 'Descuento' : 'Recargo'} de {importe(Math.abs(totalLista - totalCobrado))}{totalLista > 0 && ` (${Math.abs(Math.round((totalCobrado / totalLista - 1) * 100))}%)`} sobre el total de lista ({importe(totalLista)}). El precio de venta de cada producto se ajusta en la misma proporción.</p>}<div className="sale-total"><span>Total</span><strong>{importe(totalValido ? totalCobrado : 0)}</strong></div>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!hayCliente || !lineasCompletas || !recibio || !totalValido || guardando} onClick={guardar}>{guardando ? 'Registrando…' : 'Registrar venta'}</button></footer></section></div>
}
