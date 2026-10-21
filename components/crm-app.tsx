'use client'

import { Fragment, createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Plus, Search, ShoppingBag, Users, X, ArrowLeft, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cerrarSesion } from '@/app/login/actions'
import { vistaValida, type Vista } from '@/lib/vistas'
import { TIPOS_ACTIVIDAD, diaArgentina, horaArgentina, type Actividad } from '@/lib/actividad'
import { actualizarCliente, crearCliente } from '@/app/clientes/actions'
import { guardarCotizacion, guardarStockBajo } from '@/app/configuracion/actions'
import { borrarMovimiento, registrarArqueo, registrarMovimiento } from '@/app/finanzas/actions'
import { ajustarStock, crearProducto, guardarDatosProducto, guardarPreciosProducto, registrarCompra } from '@/app/productos/actions'
import { editarVenta, registrarVenta } from '@/app/ventas/actions'
import { ESTADOS_CAMPANA, SEGMENTOS, ZONAS, formatearFecha, type Cliente } from '@/lib/clientes'
import { CATEGORIAS_EGRESO, TIPOS_MOVIMIENTO, calcularMes, saldoDe, type MovimientoCaja, type SaldoCaja } from '@/lib/finanzas'
import { ESTADOS_STOCK, estadoStock, stockTotal, unidadesCompradas, type Compra, type Configuracion, type EstadoStock, type Producto, type Sabor } from '@/lib/productos'
import { METODOS_PAGO, RECIBIO, calcularTotales, formatearImporte, hoyEnArgentina, precioSegunPago, type MetodoPago, type Recibio, type Venta } from '@/lib/ventas'

const UsuarioContext = createContext('')
const ClientesContext = createContext<Cliente[]>([])



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

const money = (value: number) => `${value < 0 ? '−' : ''}$ ${Math.abs(value).toLocaleString('es-AR')}`
const numero = (value: number) => value.toLocaleString('es-AR')
// Primera letra o número de las dos primeras palabras que tengan alguno (muchos nombres son usuarios de Instagram).
const iniciales = (nombre: string) => nombre.split(/\s+/).map(parte => parte.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const opciones = (etiquetas: Record<string, string>) => Object.entries(etiquetas).map(([clave, etiqueta]) => <option key={clave} value={clave}>{etiqueta}</option>)

const POR_PAGINA = 50
type Filtros = { texto: string; segmento: string; zona: string; pagina: number }
const FILTROS_INICIALES: Filtros = { texto: '', segmento: '', zona: '', pagina: 1 }

export default function CrmApp({ email, clientes, ventas, productos, compras, configuracion, movimientos, saldos, actividad, seccionInicial, clienteInicial }: { seccionInicial: Vista; clienteInicial: string | null; email: string; clientes: Cliente[]; ventas: Venta[]; productos: Producto[]; compras: Compra[]; configuracion: Configuracion; movimientos: MovimientoCaja[]; saldos: SaldoCaja[]; actividad: Actividad[] }) {
  return <UsuarioContext value={email}><ClientesContext value={clientes}><Vistas seccionInicial={seccionInicial} clienteInicial={clienteInicial} clientes={clientes} ventas={ventas} productos={productos} compras={compras} configuracion={configuracion} movimientos={movimientos} saldos={saldos} actividad={actividad} /></ClientesContext></UsuarioContext>
}

function Vistas({ seccionInicial, clienteInicial, clientes, ventas, productos, compras, configuracion, movimientos, saldos, actividad }: { seccionInicial: Vista; clienteInicial: string | null; clientes: Cliente[]; ventas: Venta[]; productos: Producto[]; compras: Compra[]; configuracion: Configuracion; movimientos: MovimientoCaja[]; saldos: SaldoCaja[]; actividad: Actividad[] }) {
  const [view, setView] = useState<Vista>(seccionInicial)
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(clienteInicial)
  // La sección y la ficha abierta quedan en la dirección (?seccion=...&cliente=...): al recargar se
  // vuelve al mismo lugar, y el botón "atrás" del navegador vuelve a la pantalla anterior.
  useEffect(() => {
    const parametros = new URLSearchParams()
    if (view !== 'dashboard') parametros.set('seccion', view)
    if (seleccionadoId) parametros.set('cliente', seleccionadoId)
    const destino = parametros.size ? `/?${parametros}` : '/'
    if (destino !== window.location.pathname + window.location.search) window.history.pushState(null, '', destino)
  }, [view, seleccionadoId])
  useEffect(() => {
    const alVolver = () => {
      const parametros = new URLSearchParams(window.location.search)
      setView(vistaValida(parametros.get('seccion')))
      setSeleccionadoId(parametros.get('cliente'))
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])
  // Los filtros viven acá para que no se pierdan al entrar y salir de una ficha.
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const seleccionado = clientes.find(cliente => cliente.id === seleccionadoId)
  const navegar = (vista: Vista) => { setSeleccionadoId(null); setView(vista) }
  // Cada pantalla nueva arranca desde arriba (si no, la ficha se abría scrolleada).
  useEffect(() => { window.scrollTo(0, 0) }, [view, seleccionadoId])

  if (seleccionado) return <FichaCliente key={seleccionado.id} cliente={seleccionado} ventas={ventas} onBack={() => setSeleccionadoId(null)} onNavigate={navegar} />
  if (view === 'dashboard') return <Dashboard ventas={ventas} movimientos={movimientos} clientes={clientes} onNavigate={navegar} />
  if (view === 'ventas') return <Sales ventas={ventas} clientes={clientes} productos={productos} onNavigate={navegar} />
  if (view === 'reactivacion') return <Reactivation clients={initialClients} onNavigate={navegar} />
  if (view === 'productos') return <Products productos={productos} compras={compras} configuracion={configuracion} onNavigate={navegar} />
  if (view === 'finanzas') return <Finance ventas={ventas} movimientos={movimientos} saldos={saldos} productos={productos} cotizacion={configuracion.cotizacion_usd} onNavigate={navegar} />
  if (view === 'movimientos') return <Movimientos actividad={actividad} onNavigate={navegar} />
  if (view === 'reportes') return <Reports onNavigate={navegar} />
  if (view === 'configuracion') return <Ajustes configuracion={configuracion} onNavigate={navegar} />
  return <Clientes clientes={clientes} filtros={filtros} onFiltros={setFiltros} onSelect={setSeleccionadoId} onNavigate={navegar} />
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COLORES_MARCA = ['purple', 'mint', 'orange', 'blue']
const sumarTotales = (ventas: Venta[]) => ventas.reduce((suma, venta) => suma + venta.total, 0)

// Cola de reactivación: pendientes que no dijeron que no; primero quienes compraron y los de La Plata.
function colaReactivacion(clientes: Cliente[]) {
  const orden = (cliente: Cliente) => (cliente.segmento === 'cliente' ? 0 : 2) + (cliente.zona === 'la_plata' ? 0 : 1)
  return clientes
    .filter(cliente => cliente.estado_campana === 'pendiente' && cliente.consentimiento !== 'no' && (cliente.segmento === 'cliente' || cliente.segmento === 'no_compro'))
    .sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, 'es'))
}

// Métricas del mes en curso (hora de Argentina). Las ventas en dólares se suman aparte de los pesos.
function calcularResumen(ventas: Venta[], movimientos: MovimientoCaja[]) {
  const mesActual = hoyEnArgentina().slice(0, 7)
  const egresosDe = (mes: string) => movimientos.filter(movimiento => movimiento.tipo === 'egreso' && movimiento.medio !== 'dolares' && movimiento.fecha.startsWith(mes)).reduce((suma, movimiento) => suma + movimiento.monto, 0)
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
  const porMarca = new Map<string, number>()
  for (const venta of delMes) {
    for (const item of venta.venta_items) {
      const clave = item.producto_id ?? item.descripcion
      const actual = porProducto.get(clave) ?? { marca: item.productos?.marca ?? '—', nombre: item.productos?.nombre ?? item.descripcion, unidades: 0, facturado: 0 }
      actual.unidades += item.cantidad
      if (venta.metodo_pago !== 'dolares') actual.facturado += item.subtotal
      porProducto.set(clave, actual)
      if (item.productos) porMarca.set(item.productos.marca, (porMarca.get(item.productos.marca) ?? 0) + item.cantidad)
    }
  }

  const [anio, mes] = mesActual.split('-').map(Number)
  const meses = Array.from({ length: 6 }, (_, i) => {
    const fecha = new Date(anio, mes - 6 + i, 1)
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    return { clave, etiqueta: MESES[fecha.getMonth()], ingresos: sumarTotales(ventas.filter(venta => venta.metodo_pago !== 'dolares' && venta.fecha.startsWith(clave))), egresos: egresosDe(clave) }
  })

  return {
    cantidad: delMes.length,
    ingresos,
    ingresosUsd,
    egresos: egresosDe(mesActual),
    ticket: enPesos.length ? Math.round(ingresos / enPesos.length) : 0,
    clientesNuevos: [...primeraCompra.values()].filter(fecha => fecha.startsWith(mesActual)).length,
    top: [...porProducto.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5),
    porMarca,
    meses,
  }
}

function Dashboard({ ventas, movimientos, clientes, onNavigate }: { ventas: Venta[]; movimientos: MovimientoCaja[]; clientes: Cliente[]; onNavigate: (view: Vista) => void }) {
  const resumen = useMemo(() => calcularResumen(ventas, movimientos), [ventas, movimientos])
  const cola = useMemo(() => colaReactivacion(clientes), [clientes])
  // Torta: las 4 marcas más vendidas del mes y el resto en "Otras".
  const ranking = [...resumen.porMarca.entries()].sort((a, b) => b[1] - a[1])
  const otras = ranking.slice(4).reduce((suma, [, valor]) => suma + valor, 0)
  const marcas = [...ranking.slice(0, 4).map(([nombre, valor], i) => ({ nombre, valor, color: COLORES_MARCA[i] })), ...(otras ? [{ nombre: 'Otras', valor: otras, color: 'gray' }] : [])]
  const unidades = marcas.reduce((suma, marca) => suma + marca.valor, 0)
  let acumulado = 0
  const dona = unidades === 0 ? '#f0f0f0' : `conic-gradient(${marcas.map(marca => { const desde = acumulado / unidades * 100; acumulado += marca.valor; return `var(--report-${marca.color}) ${desde}% ${acumulado / unidades * 100}%` }).join(', ')})`
  const maxBarra = Math.max(1, ...resumen.meses.map(mes => Math.max(mes.ingresos, mes.egresos)))
  const ingresosTexto = money(resumen.ingresos) + (resumen.ingresosUsd ? ` + US$ ${numero(resumen.ingresosUsd)}` : '')
  const top = resumen.top[0]
  return <main className="app-shell"><Sidebar active="Resumen" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Dashboard</strong></div></header><div className="content-wrap dashboard-page"><div className="page-heading"><div><p className="eyebrow">RESUMEN DEL NEGOCIO</p><h1>Dashboard</h1><p className="heading-subtitle">Una mirada rápida a lo que está pasando en tu tienda este mes.</p></div></div><div className="metrics-grid dashboard-metrics"><Metric icon={<span className="metric-dot green" />} label="Ingresos del mes" value={ingresosTexto} tone="mint" /><Metric icon={<span className="metric-dot red" />} label="Egresos del mes" value={money(resumen.egresos)} tone="peach" /><Metric icon={<span className="metric-dot purple" />} label="Ganancia neta" value={money(resumen.ingresos - resumen.egresos)} tone="purple" /><Metric icon={<ShoppingBag />} label="Cantidad de ventas" value={numero(resumen.cantidad)} tone="blue" /></div><div className="metrics-grid dashboard-metrics secondary"><Metric icon={<span className="metric-dot purple" />} label="Ticket promedio" value={money(resumen.ticket)} tone="purple" /><Metric icon={<Users />} label="Clientes nuevos del mes" value={numero(resumen.clientesNuevos)} tone="blue" /><Metric icon={<span className="metric-dot orange" />} label="Clientes a reactivar" value={numero(cola.length)} tone="peach" /><Metric icon={<ShoppingBag />} label="Producto top del mes" value={top ? `${top.marca} ${top.nombre}` : '—'} tone="mint" /></div><div className="dashboard-grid dashboard-chart-row"><div className="card dashboard-chart-card"><div className="card-head"><div><h2>Ingresos vs Egresos</h2><p>Últimos 6 meses · en pesos</p></div><div className="finance-legend"><span><i className="legend-income" />Ingresos</span><span><i className="legend-expense" />Egresos</span></div></div><div className="dashboard-line-chart">{resumen.meses.map(mes => <div className="dashboard-month" key={mes.clave}><div className="dashboard-bars"><i className="dashboard-income" title={`Ingresos ${money(mes.ingresos)}`} style={{ height: `${(mes.ingresos / maxBarra) * 140}px` }} /><i className="dashboard-expense" title={`Egresos ${money(mes.egresos)}`} style={{ height: `${(mes.egresos / maxBarra) * 140}px` }} /></div><small>{mes.etiqueta}</small></div>)}</div></div><div className="card dashboard-chart-card category-card"><div className="card-head"><div><h2>Ventas por marca</h2><p>Unidades vendidas este mes</p></div></div><div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{ background: dona }}><div><strong>{numero(resumen.cantidad)}</strong><span>{resumen.cantidad === 1 ? 'venta' : 'ventas'}</span></div></div><div className="donut-legend">{marcas.length === 0 ? <p className="dashboard-vacio">Sin ventas este mes.</p> : marcas.map(marca => <span key={marca.nombre}><i className={marca.color} />{marca.nombre}<b>{Math.round(marca.valor / unidades * 100)}%</b></span>)}</div></div></div></div><div className="dashboard-grid dashboard-bottom-row"><div className="card dashboard-table-card"><div className="card-head"><div><h2>Top 5 productos más vendidos</h2><p>Por unidades vendidas este mes</p></div></div><div className="sales-table-wrap"><table className="dashboard-table"><thead><tr><th>Producto</th><th>Marca</th><th>Unidades</th><th>Facturado</th></tr></thead><tbody>{resumen.top.length === 0 ? <tr><td colSpan={4} className="dashboard-vacio">Todavía no hay ventas este mes.</td></tr> : resumen.top.map(producto => <tr key={`${producto.marca}-${producto.nombre}`}><td className="celda-principal"><strong>{producto.nombre}</strong></td><td data-label="Marca">{producto.marca}</td><td data-label="Unidades">{numero(producto.unidades)}</td><td data-label="Facturado"><strong>{money(producto.facturado)}</strong></td></tr>)}</tbody></table></div></div><div className="card reactivation-card"><div className="card-head"><div><h2>Clientes a reactivar</h2><p>Los próximos de la cola</p></div><button className="text-link" onClick={() => onNavigate('reactivacion')}>Ver todos</button></div><div className="reactivation-list">{cola.length === 0 ? <p className="dashboard-vacio">No hay clientes pendientes.</p> : cola.slice(0, 5).map(cliente => <div className="reactivation-item" key={cliente.id}><div className="mini-avatar">{iniciales(cliente.nombre)}</div><div><strong>{cliente.nombre}</strong><span>{SEGMENTOS[cliente.segmento]}{cliente.zona && ` · ${ZONAS[cliente.zona]}`}</span></div></div>)}</div></div></div></div></section></main>
}

function SeccionVacia({ active, breadcrumb, eyebrow, title, subtitle, mensaje, onNavigate }: { active: string; breadcrumb: string; eyebrow: string; title: string; subtitle: string; mensaje: string; onNavigate: (view: Vista) => void }) { return <main className="app-shell"><Sidebar active={active} onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>{breadcrumb}</strong></div></header><div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-subtitle">{subtitle}</p></div></div><div className="card empty-state">{mensaje}</div></div></section></main> }

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <Card className="metric-card"><CardContent className="p-0"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-title">{label}</span><div className="metric-value">{value}</div></CardContent></Card> }

function Sidebar({ active, onNavigate }: { active: string; onNavigate?: (view: Vista) => void }) { const email = useContext(UsuarioContext); const totalClientes = useContext(ClientesContext).length; const [abierto, setAbierto] = useState(false); useBloquearScroll(abierto); const ir = (vista: Vista) => { setAbierto(false); onNavigate?.(vista) }; const marca = <img className="brand-logo" src="/logo-glauss.png" alt="Glauss Shop" />; return <><div className="mobile-bar"><button className="menu-button" aria-label="Abrir menú" onClick={() => setAbierto(true)}><Menu /></button>{marca}</div>{abierto && <div className="sidebar-fondo" onClick={() => setAbierto(false)} />}<aside className={`sidebar ${abierto ? 'abierto' : ''}`}><div className="sidebar-top">{marca}<button className="menu-cerrar" aria-label="Cerrar menú" onClick={() => setAbierto(false)}><X /></button></div><nav className="nav-list"><span className="nav-label">MENU PRINCIPAL</span>{([['Resumen', '◈', 'dashboard'], ['Ventas', '▣', 'ventas'], ['Clientes', '♙', 'clientes'], ['Reactivación', '↻', 'reactivacion'], ['Productos y stock', '□', 'productos'], ['Finanzas', '$', 'finanzas'], ['Movimientos', '◷', 'movimientos'], ['Reportes', '▤', 'reportes']] as const).map(([label, icon, vista]) => <button key={label} onClick={() => ir(vista)} className={`nav-item ${label === active ? 'active' : ''}`}><span className="nav-glyph">{icon}</span>{label}{label === 'Clientes' && <span className="nav-count">{numero(totalClientes)}</span>}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item">? <span>Central de ayuda</span></button><button className={`nav-item ${active === 'Configuración' ? 'active' : ''}`} onClick={() => ir('configuracion')}>⚙ <span>Configuración</span></button><div className="profile"><div className="profile-avatar">{email.charAt(0).toUpperCase()}</div><div><strong title={email}>{email}</strong><form action={cerrarSesion}><button className="logout-button">Cerrar sesión</button></form></div></div></div></aside></> }


type PestanaProductos = 'catalogo' | 'stock' | 'precios'
type OrdenTabla = { columna: string; asc: boolean }
type FilaStock = { producto: Producto; sabor: Sabor; estado: EstadoStock }
type ModoProducto = 'nuevo' | 'catalogo' | 'precios'
type ResumenStock = { unidades: number; sin: number; bajo: number; costoUsd: number | null; efectivo: number; transferencia: number }
const PESTANAS_PRODUCTOS: Record<PestanaProductos, string> = { catalogo: 'Catálogo', stock: 'Stock', precios: 'Precios y costos' }
const FILTRO_ESTADOS = { ok: 'OK', bajo: 'Bajo stock', sin: 'Sin stock' }
const saboresEnLista = (producto: Producto) => producto.sabores.filter(sabor => sabor.activo || sabor.stock !== 0)

// Totales de un vaporizador (como en la planilla): los valores solo cuentan las unidades que hay.
function resumirStock(producto: Producto, stockBajo: number): ResumenStock {
  const sabores = saboresEnLista(producto)
  const unidades = sabores.reduce((suma, sabor) => suma + Math.max(sabor.stock, 0), 0)
  const estados = sabores.map(sabor => estadoStock(sabor, stockBajo))
  return { unidades, sin: estados.filter(estado => estado === 'sin').length, bajo: estados.filter(estado => estado === 'bajo').length, costoUsd: producto.costo_usd === null ? null : unidades * producto.costo_usd, efectivo: unidades * producto.precio_efectivo, transferencia: unidades * producto.precio_transferencia }
}

// Ordena filas por la columna elegida (texto o número); los vacíos van al final.
function ordenarPor<T>(filas: T[], orden: OrdenTabla, valores: Record<string, (fila: T) => string | number | null>) {
  const valor = valores[orden.columna]
  if (!valor) return filas
  return [...filas].sort((a, b) => {
    const x = valor(a), y = valor(b)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    const comparacion = typeof x === 'string' ? x.localeCompare(String(y), 'es') : x - Number(y)
    return orden.asc ? comparacion : -comparacion
  })
}

function Products({ productos, compras, configuracion, onNavigate }: { productos: Producto[]; compras: Compra[]; configuracion: Configuracion; onNavigate: (view: Vista) => void }) {
  const cotizacion = configuracion.cotizacion_usd
  const stockBajo = configuracion.stock_bajo
  const [pestana, setPestana] = useState<PestanaProductos>('catalogo')
  const [editando, setEditando] = useState<{ producto: Producto | null; modo: ModoProducto } | null>(null)
  const [modal, setModal] = useState<'ingreso' | 'ajuste' | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [marca, setMarca] = useState('')
  const [estado, setEstado] = useState('')
  // Vaporizadores abiertos o cerrados a mano en Stock; al buscar o filtrar vuelve a lo automático.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const [ordenStock, setOrdenStock] = useState<OrdenTabla>({ columna: 'producto', asc: true })
  const [ordenPrecios, setOrdenPrecios] = useState<OrdenTabla>({ columna: 'producto', asc: true })
  const marcas = useMemo(() => marcasDe(productos), [productos])
  const aPesos = (usd: number | null) => usd !== null && cotizacion ? usd * cotizacion : null
  const costoPesos = (producto: Producto) => aPesos(producto.costo_usd)
  const margen = (producto: Producto, precio: number) => { const costo = costoPesos(producto); return costo === null ? null : precio - costo }
  const buscado = normalizar(busqueda.trim())
  const textoSabor = (sabor: Sabor) => `${sabor.nombre} ${sabor.codigo ?? ''}`
  const productosVisibles = productos.filter(producto => (!marca || producto.marca === marca) && (!buscado || normalizar(`${producto.marca} ${producto.nombre} ${producto.sabores.map(textoSabor).join(' ')}`).includes(buscado)) && (!estado || producto.sabores.some(sabor => estadoStock(sabor, stockBajo) === estado)))
  const filasStock: FilaStock[] = productos.flatMap(producto => saboresEnLista(producto).map(sabor => ({ producto, sabor, estado: estadoStock(sabor, stockBajo) })))
    .filter(fila => (!marca || fila.producto.marca === marca) && (!buscado || normalizar(`${fila.producto.marca} ${fila.producto.nombre} ${textoSabor(fila.sabor)}`).includes(buscado)) && (!estado || fila.estado === estado))
  const enStock = (fila: FilaStock) => Math.max(fila.sabor.stock, 0)
  const totales = filasStock.reduce((suma, fila) => ({ unidades: suma.unidades + enStock(fila), costoUsd: suma.costoUsd + (fila.producto.costo_usd === null ? 0 : enStock(fila) * fila.producto.costo_usd), efectivo: suma.efectivo + enStock(fila) * fila.producto.precio_efectivo, transferencia: suma.transferencia + enStock(fila) * fila.producto.precio_transferencia, defectuosos: suma.defectuosos + fila.sabor.defectuosos, sin: suma.sin + (fila.estado === 'sin' ? 1 : 0), bajo: suma.bajo + (fila.estado === 'bajo' ? 1 : 0) }), { unidades: 0, costoUsd: 0, efectivo: 0, transferencia: 0, defectuosos: 0, sin: 0, bajo: 0 })
  const resumenes = new Map(productos.map(producto => [producto.id, resumirStock(producto, stockBajo)]))
  const resumen = (producto: Producto) => resumenes.get(producto.id)!
  // En Stock, si se busca un sabor o se filtra por estado, cada vaporizador muestra solo los sabores que coinciden.
  const saboresVisibles = (producto: Producto) => saboresEnLista(producto).filter(sabor => (!estado || estadoStock(sabor, stockBajo) === estado) && (!buscado || normalizar(`${producto.marca} ${producto.nombre}`).includes(buscado) || normalizar(textoSabor(sabor)).includes(buscado)))
  const productosStock = ordenarPor(productosVisibles, ordenStock, { producto: producto => `${producto.marca} ${producto.nombre}`, unidades: producto => resumen(producto).unidades, alertas: producto => resumen(producto).sin * 1000 + resumen(producto).bajo, costo: producto => resumen(producto).costoUsd, venta: producto => resumen(producto).efectivo })
  const productosOrdenados = ordenarPor(productosVisibles, ordenPrecios, { producto: producto => `${producto.marca} ${producto.nombre}`, costo: producto => producto.costo_usd, efectivo: producto => producto.precio_efectivo, transferencia: producto => producto.precio_transferencia, margenEfectivo: producto => margen(producto, producto.precio_efectivo), margenTransferencia: producto => margen(producto, producto.precio_transferencia), promo: producto => producto.promo_x3, dolares: producto => producto.precio_usd, stock: producto => stockTotal(producto) })
  const encabezado = (orden: OrdenTabla, setOrden: (orden: OrdenTabla) => void, columna: string, etiqueta: string) => <th><button className={`orden-columna ${orden.columna === columna ? 'activa' : ''}`} onClick={() => setOrden({ columna, asc: orden.columna === columna ? !orden.asc : columna === 'producto' || columna === 'codigo' })}>{etiqueta}{orden.columna === columna ? (orden.asc ? ' ↑' : ' ↓') : ''}</button></th>
  const pesosOGuion = (valor: number | null) => valor === null ? '—' : money(Math.round(valor))
  const costoTexto = (producto: Producto) => producto.costo_usd === null ? <span className="dato-faltante">sin cargar</span> : <>{formatearImporte(producto.costo_usd, 'dolares')}{costoPesos(producto) !== null && <small> · {money(Math.round(costoPesos(producto)!))}</small>}</>
  const editar = (producto: Producto | null, modo: ModoProducto) => setEditando({ producto, modo })

  const tarjeta = (producto: Producto) => {
    const stock = stockTotal(producto)
    const sabores = saboresEnLista(producto)
    const { sin: sinStock, bajo: bajos } = resumen(producto)
    const margenEfectivo = margen(producto, producto.precio_efectivo)
    const margenTransferencia = margen(producto, producto.precio_transferencia)
    return <article key={producto.id} className="card producto-card"><div className="producto-top"><div className="producto-foto">{producto.foto_url ? <img src={producto.foto_url} alt={`${producto.marca} ${producto.nombre}`} loading="lazy" /> : <span>Sin foto</span>}</div><div className="producto-info"><p className="producto-marca">{producto.marca}</p><h3>{producto.nombre}</h3><div className="precios-chips"><span className="chip-precio efectivo">Efvo <b>{money(producto.precio_efectivo)}</b></span><span className="chip-precio">Transf <b>{money(producto.precio_transferencia)}</b></span>{producto.promo_x3 !== null && <span className="chip-precio promo">x3 <b>{money(producto.promo_x3)}</b></span>}{producto.precio_usd !== null && <span className="chip-precio">US$ <b>{numero(producto.precio_usd)}</b></span>}</div><div className="costo-box"><span className="costo-titulo">Costo de mercadería x unidad</span>{producto.costo_usd === null ? <span className="dato-faltante">Sin cargar</span> : <div className="costo-valores"><strong>{formatearImporte(producto.costo_usd, 'dolares')}</strong>{costoPesos(producto) !== null && <strong>{money(Math.round(costoPesos(producto)!))}</strong>}</div>}{producto.costo_usd !== null && cotizacion && <small>Dólar a {money(cotizacion)}</small>}</div>{margenEfectivo !== null && <div className="margen-chips"><span>Margen efvo <b>{pesosOGuion(margenEfectivo)}</b></span><span>Margen transf <b>{pesosOGuion(margenTransferencia)}</b></span></div>}</div></div><div className="producto-stock"><div className="producto-stock-head"><strong className={stock <= 0 ? 'monto-negativo' : ''}>{numero(stock)} {stock === 1 ? 'unidad' : 'unidades'}</strong><span>{sabores.length} sabores{sinStock ? ` · ${sinStock} sin stock` : ''}{bajos ? ` · ${bajos} bajo` : ''}</span></div><div className="sabores-stock">{sabores.map(sabor => <span key={sabor.id} className={`estado-${estadoStock(sabor, stockBajo)}`} title={sabor.codigo ?? undefined}>{sabor.nombre}<b>{numero(sabor.stock)}</b></span>)}</div></div><button className="outline-button producto-editar" onClick={() => editar(producto, 'catalogo')}>Editar marca, nombre y sabores</button></article>
  }

  const vistaStock = <><div className="metrics-grid stock-metricas"><Metric icon={<ShoppingBag />} label="Unidades en stock" value={numero(totales.unidades)} tone="purple" /><Metric icon={<span className="metric-dot orange" />} label="Valor a costo" value={`${formatearImporte(totales.costoUsd, 'dolares')}${cotizacion ? `\n${money(Math.round(totales.costoUsd * cotizacion))}` : ''}`} tone="peach" /><Metric icon={<span className="metric-dot green" />} label="Valor a venta efectivo" value={money(totales.efectivo)} tone="mint" /><Metric icon={<span className="metric-dot purple" />} label="Valor a venta transferencia" value={money(totales.transferencia)} tone="blue" /></div><p className="stock-resumen">{numero(totales.sin)} {totales.sin === 1 ? 'sabor' : 'sabores'} sin stock · {numero(totales.bajo)} con bajo stock ({stockBajo} o menos) · {numero(totales.defectuosos)} defectuosos. Tocá un vaporizador para ver y corregir el stock de cada sabor.</p><div className="card clients-table-card stock-card"><table className="clients-table stock-productos"><thead><tr><th></th>{encabezado(ordenStock, setOrdenStock, 'producto', 'Producto')}{encabezado(ordenStock, setOrdenStock, 'unidades', 'Stock')}{encabezado(ordenStock, setOrdenStock, 'alertas', 'Sin stock / bajo')}{encabezado(ordenStock, setOrdenStock, 'costo', 'Valor a costo')}{encabezado(ordenStock, setOrdenStock, 'venta', 'Valor a venta')}<th></th></tr></thead>{productosStock.map(producto => { const visibles = saboresVisibles(producto); const filtrado = visibles.length < saboresEnLista(producto).length; return <StockProducto key={producto.id} producto={producto} sabores={visibles} ocultos={saboresEnLista(producto).length - visibles.length} resumen={resumen(producto)} abierto={abiertos[producto.id] ?? filtrado} stockBajo={stockBajo} cotizacion={cotizacion} onAlternar={() => setAbiertos(actuales => ({ ...actuales, [producto.id]: !(actuales[producto.id] ?? filtrado) }))} onEditarSabores={() => editar(producto, 'catalogo')} /> })}</table>{productosVisibles.length === 0 && <div className="empty-state">Ningún producto coincide con los filtros.</div>}</div>{compras.length > 0 && <div className="card clients-table-card compras-card"><div className="clients-table-head"><div><h2>Últimos ingresos de mercadería</h2><p>Qué se compró, cuánto y a qué costo</p></div></div><div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>N°</th><th>Fecha</th><th>Producto</th><th>Unidades</th><th>Costo c/u</th><th>Total</th></tr></thead><tbody>{compras.slice(0, 20).map(compra => { const unidades = unidadesCompradas(compra); return <tr key={compra.id}><td data-label="N°"><strong>#{compra.numero}</strong></td><td data-label="Fecha">{formatearFecha(compra.fecha)}</td><td data-label="Producto"><strong>{compra.productos ? `${compra.productos.marca} ${compra.productos.nombre}` : '—'}</strong>{compra.notas && <small className="venta-lista">{compra.notas}</small>}</td><td data-label="Unidades">{numero(unidades)}</td><td data-label="Costo c/u">{formatearImporte(compra.costo_unitario_usd, 'dolares')}</td><td data-label="Total"><strong>{formatearImporte(compra.costo_unitario_usd * unidades, 'dolares')}</strong>{cotizacion && <small className="venta-lista">≈ {money(Math.round(compra.costo_unitario_usd * unidades * cotizacion))}</small>}</td></tr> })}</tbody></table></div></div>}</>

  const vistaPrecios = <div className="card clients-table-card"><div className="sales-table-wrap"><table className="clients-table precios-tabla"><thead><tr><th></th>{encabezado(ordenPrecios, setOrdenPrecios, 'producto', 'Producto')}{encabezado(ordenPrecios, setOrdenPrecios, 'costo', 'Costo x unidad')}{encabezado(ordenPrecios, setOrdenPrecios, 'efectivo', 'Efectivo')}{encabezado(ordenPrecios, setOrdenPrecios, 'transferencia', 'Transferencia')}{encabezado(ordenPrecios, setOrdenPrecios, 'margenEfectivo', 'Margen efvo')}{encabezado(ordenPrecios, setOrdenPrecios, 'margenTransferencia', 'Margen transf')}{encabezado(ordenPrecios, setOrdenPrecios, 'promo', 'Promo x3')}{encabezado(ordenPrecios, setOrdenPrecios, 'dolares', 'Dólares')}{encabezado(ordenPrecios, setOrdenPrecios, 'stock', 'Stock')}</tr></thead><tbody>{productosOrdenados.map(producto => <tr key={producto.id} tabIndex={0} onClick={() => editar(producto, 'precios')} onKeyDown={event => event.key === 'Enter' && editar(producto, 'precios')}><td className="celda-foto">{producto.foto_url && <img src={producto.foto_url} alt="" loading="lazy" />}</td><td className="celda-principal"><strong>{producto.marca} {producto.nombre}</strong><small className="venta-lista">{cantidadSabores(producto.sabores.filter(sabor => sabor.activo).length)}</small></td><td data-label="Costo x unidad">{costoTexto(producto)}</td><td data-label="Efectivo">{money(producto.precio_efectivo)}</td><td data-label="Transferencia">{money(producto.precio_transferencia)}</td><td data-label="Margen efvo" className="monto-positivo">{pesosOGuion(margen(producto, producto.precio_efectivo))}</td><td data-label="Margen transf" className="monto-positivo">{pesosOGuion(margen(producto, producto.precio_transferencia))}</td><td data-label="Promo x3">{producto.promo_x3 === null ? '—' : money(producto.promo_x3)}</td><td data-label="Dólares">{producto.precio_usd === null ? <span className="dato-faltante">sin cargar</span> : formatearImporte(producto.precio_usd, 'dolares')}</td><td data-label="Stock"><span className={`stock-numero ${stockTotal(producto) <= 0 ? 'agotado' : ''}`}>{numero(stockTotal(producto))}</span></td></tr>)}</tbody></table>{productosVisibles.length === 0 && <div className="empty-state">Ningún producto coincide con los filtros.</div>}</div></div>

  return <main className="app-shell"><Sidebar active="Productos y stock" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Productos y Stock</strong></div></header><div className="content-wrap products-page"><div className="page-heading"><div><p className="eyebrow">CATÁLOGO E INVENTARIO</p><h1>Productos y Stock</h1><p className="heading-subtitle">{cotizacion ? `Cotización: 1 US$ = ${money(cotizacion)} · ` : 'Sin cotización del dólar: los costos no se pasan a pesos · '}<button className="text-link" onClick={() => onNavigate('configuracion')}>{cotizacion ? 'cambiarla' : 'cargarla en Configuración'}</button></p></div><div className="heading-actions"><button className="outline-button" disabled={productos.length === 0} onClick={() => setModal('ingreso')}>Ingreso de mercadería</button><button className="outline-button" disabled={productos.length === 0} onClick={() => setModal('ajuste')}>Defectuosos o conteo</button><button className="quick-button" onClick={() => editar(null, 'nuevo')}><Plus /> Nuevo producto</button></div></div>{productos.length === 0 ? <div className="card empty-state">Todavía no hay productos cargados. Tocá “Nuevo producto” para cargar el primero.</div> : <><div className="filter-pills pestanas" role="tablist" aria-label="Vista">{(Object.keys(PESTANAS_PRODUCTOS) as PestanaProductos[]).map(opcion => <button key={opcion} role="tab" aria-selected={pestana === opcion} className={pestana === opcion ? 'filter-pill selected' : 'filter-pill'} onClick={() => setPestana(opcion)}>{PESTANAS_PRODUCTOS[opcion]}</button>)}</div><div className="clients-toolbar"><label className="search-control"><Search /><input value={busqueda} onChange={event => { setBusqueda(event.target.value); setAbiertos({}) }} placeholder="Buscar producto, sabor o código..." /></label><Filtro valor={marca} etiquetas={Object.fromEntries(marcas.map(nombre => [nombre, nombre]))} todos="Todas las marcas" onChange={setMarca} /><Filtro valor={estado} etiquetas={FILTRO_ESTADOS} todos="Todo el stock" onChange={valor => { setEstado(valor); setAbiertos({}) }} /><span className="result-count">{numero(productosVisibles.length)} {productosVisibles.length === 1 ? 'producto' : 'productos'}</span></div>{pestana === 'catalogo' && (productosVisibles.length === 0 ? <div className="card empty-state">Ningún producto coincide con los filtros.</div> : <div className="catalogo-grid">{productosVisibles.map(tarjeta)}</div>)}{pestana === 'stock' && vistaStock}{pestana === 'precios' && vistaPrecios}</>}</div></section>{editando && <ProductoModal producto={editando.producto} modo={editando.modo} marcas={marcas} cotizacion={cotizacion} onClose={() => setEditando(null)} />}{modal === 'ingreso' && <IngresoModal productos={productos} cotizacion={cotizacion} onClose={() => setModal(null)} />}{modal === 'ajuste' && <AjusteStockModal productos={productos} onClose={() => setModal(null)} />}</main>
}

// Un vaporizador en la pestaña Stock: fila con los totales que se despliega con sus sabores.
// El stock de cada sabor se corrige con − / + o escribiendo lo que se contó, y se guarda todo junto como conteo.
function StockProducto({ producto, sabores, ocultos, resumen, abierto, stockBajo, cotizacion, onAlternar, onEditarSabores }: { producto: Producto; sabores: Sabor[]; ocultos: number; resumen: ResumenStock; abierto: boolean; stockBajo: number; cotizacion: number | null; onAlternar: () => void; onEditarSabores: () => void }) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const [listo, setListo] = useState(false)
  // Los cambios se limpian recién cuando llega el stock actualizado (así no se ve el número viejo un instante).
  useEffect(() => { if (listo && !guardando) { setValores({}); setListo(false) } }, [listo, guardando])
  const todos = saboresEnLista(producto)
  const cambiados = todos.filter(sabor => sabor.id in valores)
  const validos = cambiados.every(sabor => valores[sabor.id].trim() !== '' && Number.isInteger(Number(valores[sabor.id])) && Number(valores[sabor.id]) >= 0)
  const fijar = (sabor: Sabor, texto: string) => {
    setError(null)
    setValores(actuales => { const { [sabor.id]: _, ...resto } = actuales; return texto === String(sabor.stock) ? resto : { ...resto, [sabor.id]: texto } })
  }
  const sumar = (sabor: Sabor, cantidad: number) => {
    const texto = valores[sabor.id]
    const actual = texto !== undefined && Number.isInteger(Number(texto)) && texto.trim() !== '' ? Number(texto) : sabor.stock
    fijar(sabor, String(Math.max(actual + cantidad, 0)))
  }
  const guardar = () => startTransition(async () => {
    const problema = await ajustarStock(producto.id, 'conteo', cambiados.map(sabor => ({ sabor_id: sabor.id, cantidad: Number(valores[sabor.id]) })))
    if (problema) setError(problema)
    else setListo(true)
  })
  const alertas = resumen.sin || resumen.bajo ? <>{resumen.sin > 0 && <span className="status-pill estado-pill-sin">{resumen.sin} sin stock</span>}{resumen.bajo > 0 && <span className="status-pill estado-pill-bajo">{resumen.bajo} bajo</span>}</> : <span className="status-pill estado-pill-ok">Todo OK</span>
  return <tbody className={abierto ? 'stock-abierto' : undefined}><tr className="stock-producto" tabIndex={0} aria-expanded={abierto} onClick={onAlternar} onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) onAlternar() }}><td className="celda-foto">{producto.foto_url && <img src={producto.foto_url} alt="" loading="lazy" />}</td><td className="celda-principal"><strong>{producto.marca} {producto.nombre}</strong><small className="venta-lista">{todos.length} {todos.length === 1 ? 'sabor' : 'sabores'}{cambiados.length > 0 && <b className="cambios-pendientes"> · {cambiados.length} {cambiados.length === 1 ? 'cambio' : 'cambios'} sin guardar</b>}</small></td><td data-label="Stock"><strong className={`stock-numero ${resumen.unidades <= 0 ? 'agotado' : ''}`}>{numero(resumen.unidades)}</strong></td><td data-label="Sin stock / bajo" className="celda-alertas">{alertas}</td><td data-label="Valor a costo">{resumen.costoUsd === null ? '—' : <>{formatearImporte(resumen.costoUsd, 'dolares')}{cotizacion && <small className="venta-lista">{money(Math.round(resumen.costoUsd * cotizacion))}</small>}</>}</td><td data-label="Valor a venta">{money(resumen.efectivo)}<small className="venta-lista">transf {money(resumen.transferencia)}</small></td><td className="celda-desplegar"><span className="desplegar">{abierto ? 'Ocultar' : 'Ver sabores'}<ChevronDown /></span></td></tr>{abierto && <tr className="stock-detalle"><td colSpan={7}><div className="stock-lista-sabores"><div className="stock-sabor encabezado" aria-hidden="true"><span>Sabor</span><div className="stock-sabor-datos"><span>Inicial</span><span>Entradas</span><span>Salidas</span><span>Defect.</span><span>Estado</span></div><span className="stock-actual">Stock actual</span></div>{sabores.map(sabor => { const texto = valores[sabor.id]; const cambiado = texto !== undefined; const diferencia = cambiado && texto.trim() !== '' && Number.isInteger(Number(texto)) ? Number(texto) - sabor.stock : null; const estadoSabor = estadoStock(sabor, stockBajo); return <div key={sabor.id} className={`stock-sabor ${cambiado ? 'cambiado' : ''}`}><div className="stock-sabor-nombre">{sabor.codigo && <small>{sabor.codigo}</small>}<strong>{sabor.nombre}</strong></div><div className="stock-sabor-datos"><span data-label="Inicial">{numero(sabor.ajustes)}</span><span data-label="Entradas">{numero(sabor.entradas)}</span><span data-label="Salidas">{numero(sabor.salidas)}</span><span data-label="Defect.">{numero(sabor.defectuosos)}</span><span className={`status-pill estado-pill-${estadoSabor}`}>{ESTADOS_STOCK[estadoSabor]}</span></div><div className="stock-actual"><div className="stepper"><button type="button" onClick={() => sumar(sabor, -1)} disabled={guardando} aria-label={`Restar 1 a ${sabor.nombre}`}>−</button><input type="number" inputMode="numeric" min="0" step="1" value={texto ?? String(sabor.stock)} disabled={guardando} onChange={event => fijar(sabor, event.target.value)} onFocus={event => event.target.select()} aria-label={`Stock de ${sabor.nombre}`} /><button type="button" onClick={() => sumar(sabor, 1)} disabled={guardando} aria-label={`Sumar 1 a ${sabor.nombre}`}>+</button></div>{cambiado && <small className="stock-diferencia">antes {numero(sabor.stock)}{diferencia ? ` · ${diferencia > 0 ? '+' : '−'}${numero(Math.abs(diferencia))}` : ''}</small>}</div></div> })}</div>{ocultos > 0 && <p className="venta-lista stock-ocultos">Se muestran {numero(sabores.length)} de {numero(todos.length)} sabores por la búsqueda o el filtro.</p>}<div className={`stock-acciones ${cambiados.length ? 'con-cambios' : ''}`}><p>{cambiados.length ? `${cambiados.length} ${cambiados.length === 1 ? 'sabor cambiado' : 'sabores cambiados'}. Al guardar, la diferencia queda registrada como conteo.` : 'Tocá − / + o escribí lo que contaste de cada sabor.'} <button type="button" className="text-link" onClick={onEditarSabores}>Agregar o quitar sabores</button></p>{error && <p className="login-error" role="alert">{error}</p>}{cambiados.length > 0 && <div className="stock-botones"><button type="button" className="cancel-button" disabled={guardando} onClick={() => { setValores({}); setError(null) }}>Deshacer</button><button type="button" className="quick-button" disabled={guardando || !validos} onClick={guardar}>{guardando ? 'Guardando…' : `Guardar stock (${cambiados.length})`}</button></div>}</div></td></tr>}</tbody>
}

const cantidadSabores = (cantidad: number) => `${numero(cantidad)} ${cantidad === 1 ? 'sabor' : 'sabores'}`
const marcasDe = (productos: Producto[]) => [...new Set(productos.map(producto => producto.marca))].sort((a, b) => a.localeCompare(b, 'es'))

type FilaSabor = { clave: number; id: string | null; codigo: string; nombre: string; stock: number | null }

// Nuevo producto: todo. Catálogo: marca, nombre y sabores. Precios y costos: precios, promo y costo.
function ProductoModal({ producto, modo, marcas, cotizacion, onClose }: { producto: Producto | null; modo: ModoProducto; marcas: string[]; cotizacion: number | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [costo, setCosto] = useState(producto?.costo_usd !== null && producto?.costo_usd !== undefined ? String(producto.costo_usd) : '')
  const [filas, setFilas] = useState<FilaSabor[]>(() => {
    const activos = producto?.sabores.filter(sabor => sabor.activo) ?? []
    return activos.length ? activos.map((sabor, i) => ({ clave: i + 1, id: sabor.id, codigo: sabor.codigo ?? '', nombre: sabor.nombre, stock: sabor.stock })) : [{ clave: 1, id: null, codigo: '', nombre: '', stock: null }]
  })
  const [enfocar, setEnfocar] = useState<number | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const conDatos = modo !== 'precios'
  const conPrecios = modo !== 'catalogo'
  // Sabores que estaban y se sacaron de la lista (conservan su historial): se pueden volver a agregar.
  const fueraDeLista = (producto?.sabores ?? []).filter(sabor => !filas.some(fila => fila.id === sabor.id))
  const siguiente = () => (filas.at(-1)?.clave ?? 0) + 1
  const agregar = () => { const clave = siguiente(); setFilas(actuales => [...actuales, { clave, id: null, codigo: '', nombre: '', stock: null }]); setEnfocar(clave) }
  const cambiar = (clave: number, cambios: Partial<FilaSabor>) => setFilas(actuales => actuales.map(fila => fila.clave === clave ? { ...fila, ...cambios } : fila))
  const quitar = (clave: number) => setFilas(actuales => actuales.length === 1 ? [{ ...actuales[0], id: null, codigo: '', nombre: '', stock: null }] : actuales.filter(fila => fila.clave !== clave))
  const recuperar = (sabor: Sabor) => setFilas(actuales => [...actuales.filter(fila => fila.nombre.trim() || fila.codigo.trim()), { clave: siguiente(), id: sabor.id, codigo: sabor.codigo ?? '', nombre: sabor.nombre, stock: sabor.stock }])
  const saboresJson = JSON.stringify(filas.filter(fila => fila.nombre.trim()).map(fila => ({ id: fila.id, codigo: fila.codigo.trim(), nombre: fila.nombre.trim() })))
  const cantidad = filas.filter(fila => fila.nombre.trim()).length
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const problema = !producto ? await crearProducto(formData) : modo === 'precios' ? await guardarPreciosProducto(producto.id, formData) : await guardarDatosProducto(producto.id, formData)
      if (problema) setError(problema)
      else terminar()
    })
  }
  const costoNumero = Number(costo.replace(',', '.'))
  const titulo = !producto ? 'Nuevo producto' : modo === 'precios' ? `${producto.marca} ${producto.nombre}` : 'Editar producto'
  const camposDatos = <><div className="modal-fields"><label className="field"><span>Marca</span><input name="marca" required list="marcas-existentes" defaultValue={producto?.marca} placeholder="Ej. Elfbar" /><datalist id="marcas-existentes">{marcas.map(nombre => <option key={nombre} value={nombre} />)}</datalist></label><label className="field"><span>Producto</span><input name="nombre" required defaultValue={producto?.nombre} placeholder="Ej. 15K" /></label></div></>
  const camposPrecios = <><div className="precios-producto"><label className="field"><span>Efectivo ($)</span><input name="precio_efectivo" type="number" min="0" step="0.01" required defaultValue={producto?.precio_efectivo} /></label><label className="field"><span>Transferencia ($)</span><input name="precio_transferencia" type="number" min="0" step="0.01" required defaultValue={producto?.precio_transferencia} /></label><label className="field"><span>Promo x3 ($) <em>opcional</em></span><input name="promo_x3" type="number" min="0" step="0.01" defaultValue={producto?.promo_x3 ?? undefined} placeholder="Precio por 3" /></label><label className="field"><span>Dólares (US$) <em>opcional</em></span><input name="precio_usd" type="number" min="0" step="0.01" defaultValue={producto?.precio_usd ?? undefined} /></label></div><label className="field"><span>Costo por unidad (US$) <em>{costo.trim() !== '' && Number.isFinite(costoNumero) && cotizacion ? `≈ ${money(Math.round(costoNumero * cotizacion))}` : 'se actualiza con cada ingreso de mercadería'}</em></span><input name="costo_usd" type="number" min="0" step="0.01" value={costo} onChange={event => setCosto(event.target.value)} placeholder="Ej. 9.50" /></label></>
  const camposSabores = <div className="field"><span>Sabores <em>({cantidad})</em></span><input type="hidden" name="sabores" value={saboresJson} /><div className="sabores-editor"><div className="sabor-fila sabor-encabezado"><small>Código <em>(opcional)</em></small><small>Sabor</small><small>Stock</small><span /></div>{filas.map(fila => <div key={fila.clave} className="sabor-fila"><input value={fila.codigo} onChange={event => cambiar(fila.clave, { codigo: event.target.value.toUpperCase() })} placeholder="Código" aria-label="Código del sabor" /><input value={fila.nombre} autoFocus={enfocar === fila.clave} onChange={event => cambiar(fila.clave, { nombre: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); agregar() } }} placeholder="Ej. Watermelon Ice" aria-label="Nombre del sabor" /><b className={fila.stock === null ? 'sin-dato' : fila.stock <= 0 ? 'agotado' : ''} title="Stock actual">{fila.stock === null ? 'nuevo' : numero(fila.stock)}</b><button type="button" className="close-button" onClick={() => quitar(fila.clave)} aria-label={`Quitar ${fila.nombre || 'sabor'}`}><X /></button></div>)}</div><button type="button" className="outline-button agregar-sabor" onClick={agregar}><Plus /> Agregar sabor</button>{fueraDeLista.length > 0 && <div className="sabores-fuera"><small>Fuera de la lista (conservan su historial):</small>{fueraDeLista.map(sabor => <button type="button" key={sabor.id} className="filter-pill" onClick={() => recuperar(sabor)}>+ {sabor.nombre}{sabor.stock !== 0 && ` (${numero(sabor.stock)})`}</button>)}</div>}</div>
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal producto-modal" role="dialog" aria-modal="true" aria-labelledby="producto-title"><header><div><p className="eyebrow">{modo === 'precios' ? 'PRECIOS Y COSTOS' : 'CATÁLOGO'}</p><h2 id="producto-title">{titulo}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><form onSubmit={enviar}><div className="modal-body">{conDatos && camposDatos}{conPrecios && camposPrecios}{conDatos && camposSabores}{producto && <p className="venta-lista modal-nota">{modo === 'precios' ? 'La marca, el nombre y los sabores se cambian desde Catálogo.' : 'Los precios y el costo se cambian desde “Precios y costos”.'}</p>}{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={guardando}>{guardando ? 'Guardando…' : modo === 'precios' ? 'Guardar precios' : 'Guardar producto'}</button></footer></form></section></div>
}

const usuarioCorto = (email: string | null) => email ? email.split('@')[0] : '—'
type FiltrosVentas = { desde: string; hasta: string; cliente: string; productoId: string; pago: string; recibio: string; cargo: string }
const FILTROS_VENTAS: FiltrosVentas = { desde: '', hasta: '', cliente: '', productoId: '', pago: '', recibio: '', cargo: '' }

function Sales({ ventas, clientes, productos, onNavigate }: { ventas: Venta[]; clientes: Cliente[]; productos: Producto[]; onNavigate: (view: Vista) => void }) {
  const [modal, setModal] = useState<Venta | 'nueva' | null>(null)
  const [filtros, setFiltros] = useState(FILTROS_VENTAS)
  const filtrar = (cambios: Partial<FiltrosVentas>) => setFiltros(actuales => ({ ...actuales, ...cambios }))
  const cargadores = useMemo(() => [...new Set(ventas.map(venta => venta.cargada_por_email).filter((email): email is string => Boolean(email)))].sort(), [ventas])
  const buscado = normalizar(filtros.cliente.trim())
  const visibles = ventas.filter(venta =>
    (!filtros.desde || venta.fecha >= filtros.desde) &&
    (!filtros.hasta || venta.fecha <= filtros.hasta) &&
    (!buscado || normalizar(venta.clientes?.nombre ?? '').includes(buscado)) &&
    (!filtros.productoId || venta.venta_items.some(item => item.producto_id === filtros.productoId)) &&
    (!filtros.pago || venta.metodo_pago === filtros.pago) &&
    (!filtros.recibio || venta.recibio === filtros.recibio) &&
    (!filtros.cargo || venta.cargada_por_email === filtros.cargo))
  const hayFiltros = Object.values(filtros).some(Boolean)
  const totalPesos = visibles.filter(venta => venta.metodo_pago !== 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const totalUsd = visibles.filter(venta => venta.metodo_pago === 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const unidades = visibles.reduce((suma, venta) => suma + venta.venta_items.reduce((s, item) => s + item.cantidad, 0), 0)
  return <main className="app-shell"><Sidebar active="Ventas" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ventas</strong></div></header><div className="content-wrap sales-page"><div className="page-heading"><div><p className="eyebrow">HISTORIAL COMERCIAL</p><h1>Ventas</h1><p className="heading-subtitle">Registrá, corregí y consultá las ventas de tu tienda.</p></div><button className="quick-button" onClick={() => setModal('nueva')}><Plus /> Nueva venta</button></div>{ventas.length === 0 ? <div className="card empty-state">Todavía no hay ventas cargadas.</div> : <><div className="card filtros-card"><div className="filtros-grid"><label className="field"><span>Desde</span><input type="date" value={filtros.desde} onChange={event => filtrar({ desde: event.target.value })} aria-label="Desde" /></label><label className="field"><span>Hasta</span><input type="date" value={filtros.hasta} onChange={event => filtrar({ hasta: event.target.value })} aria-label="Hasta" /></label><label className="field"><span>Cliente</span><input value={filtros.cliente} onChange={event => filtrar({ cliente: event.target.value })} placeholder="Nombre" aria-label="Filtrar por cliente" /></label><label className="field"><span>Producto</span><select value={filtros.productoId} onChange={event => filtrar({ productoId: event.target.value })} aria-label="Filtrar por producto"><option value="">Todos</option>{productos.map(producto => <option key={producto.id} value={producto.id}>{producto.marca} {producto.nombre}</option>)}</select></label><label className="field"><span>Pago</span><select value={filtros.pago} onChange={event => filtrar({ pago: event.target.value })} aria-label="Filtrar por pago"><option value="">Todos</option>{opciones(METODOS_PAGO)}</select></label><label className="field"><span>Recibió</span><select value={filtros.recibio} onChange={event => filtrar({ recibio: event.target.value })} aria-label="Filtrar por quién recibió"><option value="">Todos</option>{opciones(RECIBIO)}</select></label><label className="field"><span>Cargó</span><select value={filtros.cargo} onChange={event => filtrar({ cargo: event.target.value })} aria-label="Filtrar por quién cargó"><option value="">Todos</option>{cargadores.map(email => <option key={email} value={email}>{usuarioCorto(email)}</option>)}</select></label></div>{hayFiltros && <button className="text-link" onClick={() => setFiltros(FILTROS_VENTAS)}>Limpiar filtros</button>}</div><div className="card clients-table-card"><div className="sales-table-top"><div><h2>Historial de ventas</h2><p>{numero(visibles.length)} {visibles.length === 1 ? 'venta' : 'ventas'} · {numero(unidades)} unidades</p></div><div className="table-total"><span>Total</span><strong>{money(totalPesos)}{totalUsd ? ` + US$ ${numero(totalUsd)}` : ''}</strong></div></div>{visibles.length === 0 ? <div className="empty-state">Ninguna venta coincide con los filtros.</div> : <div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Productos y precio de venta</th><th>Pago</th><th>Recibió</th><th>Cargó</th><th>Total</th><th></th></tr></thead><tbody>{visibles.map(venta => <tr key={venta.id}><td data-label="N°"><strong>#{venta.numero}</strong></td><td data-label="Fecha">{formatearFecha(venta.fecha)}</td><td data-label="Cliente"><strong>{venta.clientes?.nombre ?? '—'}</strong></td><td data-label="Productos y precio de venta"><div className="venta-items-celda">{venta.venta_items.map(item => <span key={item.id}>{item.cantidad} × {item.descripcion} · <b>{formatearImporte(item.precio_unitario, venta.metodo_pago)} c/u</b>{item.precio_lista !== null && item.precio_unitario !== item.precio_lista && <s title="Precio de lista">{formatearImporte(item.precio_lista, venta.metodo_pago)}</s>}</span>)}</div></td><td data-label="Pago"><span className={`payment-pill ${venta.metodo_pago}`}>{METODOS_PAGO[venta.metodo_pago]}</span></td><td data-label="Recibió">{RECIBIO[venta.recibio]}</td><td data-label="Cargó">{usuarioCorto(venta.cargada_por_email)}{venta.editada_en && <small className="venta-lista">editada por {usuarioCorto(venta.editada_por_email)}</small>}</td><td data-label="Total"><strong>{formatearImporte(venta.total, venta.metodo_pago)}</strong>{venta.total_lista !== null && venta.total !== venta.total_lista && <small className="venta-lista">lista {formatearImporte(venta.total_lista, venta.metodo_pago)}</small>}</td><td data-label=""><button className="text-link" onClick={() => setModal(venta)}>Editar</button></td></tr>)}</tbody></table></div>}</div></>}</div></section>{modal && <NuevaVentaModal key={modal === 'nueva' ? 'nueva' : modal.id} venta={modal === 'nueva' ? null : modal} clientes={clientes} productos={productos} onClose={() => setModal(null)} onIrAProductos={() => { setModal(null); onNavigate('productos') }} />}</main>
}

const MEDIOS_CAJA: MetodoPago[] = ['efectivo', 'transferencia', 'dolares']
const conSigno = (valor: number, medio: MetodoPago) => `${valor < 0 ? '−' : '+'}${formatearImporte(Math.abs(valor), medio)}`
type FilaMovimiento = { clave: string; fecha: string; orden: string; grupo: 'ventas' | 'egresos' | 'otros'; tipo: string; detalle: string; quien: string; medio: MetodoPago; monto: number | null; texto?: string; movimientoId?: string }

function filasDeMovimientos(ventas: Venta[], movimientos: MovimientoCaja[]): FilaMovimiento[] {
  const filas: FilaMovimiento[] = ventas.map(venta => ({ clave: `v-${venta.id}`, fecha: venta.fecha, orden: venta.created_at, grupo: 'ventas', tipo: 'Venta', detalle: `Venta #${venta.numero}${venta.clientes ? ` · ${venta.clientes.nombre}` : ''}`, quien: RECIBIO[venta.recibio], medio: venta.metodo_pago, monto: venta.total }))
  for (const movimiento of movimientos) {
    const base = { clave: `m-${movimiento.id}`, fecha: movimiento.fecha, orden: movimiento.created_at, tipo: TIPOS_MOVIMIENTO[movimiento.tipo], quien: RECIBIO[movimiento.persona], medio: movimiento.medio, movimientoId: movimiento.id }
    const nota = movimiento.descripcion ? ` · ${movimiento.descripcion}` : ''
    if (movimiento.tipo === 'egreso') filas.push({ ...base, grupo: 'egresos', detalle: `${movimiento.categoria ? CATEGORIAS_EGRESO[movimiento.categoria] : 'Egreso'}${nota}`, monto: -movimiento.monto })
    else if (movimiento.tipo === 'pase') {
      const destino = movimiento.destino_medio ?? 'efectivo'
      const llega = movimiento.monto_destino !== null && movimiento.monto_destino !== movimiento.monto ? ` (llegan ${formatearImporte(movimiento.monto_destino, destino)})` : ''
      filas.push({ ...base, grupo: 'otros', detalle: `${RECIBIO[movimiento.persona]} ${METODOS_PAGO[movimiento.medio].toLowerCase()} → ${movimiento.destino_persona ? RECIBIO[movimiento.destino_persona] : ''} ${METODOS_PAGO[destino].toLowerCase()}${llega}${nota}`, monto: null, texto: formatearImporte(movimiento.monto, movimiento.medio) })
    } else filas.push({ ...base, grupo: 'otros', detalle: `${TIPOS_MOVIMIENTO[movimiento.tipo]}${nota}`, monto: movimiento.tipo === 'retiro' ? -movimiento.monto : movimiento.monto })
  }
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.orden.localeCompare(a.orden))
}

function Finance({ ventas, movimientos, saldos, productos, cotizacion, onNavigate }: { ventas: Venta[]; movimientos: MovimientoCaja[]; saldos: SaldoCaja[]; productos: Producto[]; cotizacion: number | null; onNavigate: (view: Vista) => void }) {
  const [modal, setModal] = useState<'egreso' | 'pase' | 'arqueo' | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'ventas' | 'egresos' | 'otros'>('todos')
  const [borrando, startTransition] = useTransition()
  const mes = hoyEnArgentina().slice(0, 7)
  const nombreMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long' })
  const datos = useMemo(() => calcularMes(mes, ventas, movimientos, productos, cotizacion), [mes, ventas, movimientos, productos, cotizacion])
  const filas = useMemo(() => filasDeMovimientos(ventas, movimientos), [ventas, movimientos])
  const visibles = filas.filter(fila => filtro === 'todos' || fila.grupo === filtro).slice(0, 100)
  const cajas = [...Object.entries(RECIBIO).map(([clave, nombre]) => ({ clave, titulo: `Caja ${nombre}`, saldo: (medio: MetodoPago) => saldoDe(saldos, clave as Recibio, medio) })), { clave: 'total', titulo: 'Caja total', saldo: (medio: MetodoPago) => saldos.filter(saldo => saldo.medio === medio).reduce((suma, saldo) => suma + Number(saldo.saldo), 0) }]
  const borrar = (fila: FilaMovimiento) => {
    if (!fila.movimientoId || !window.confirm(`¿Borrar este movimiento?\n${fila.detalle}`)) return
    startTransition(async () => { const error = await borrarMovimiento(fila.movimientoId!); if (error) window.alert(error) })
  }
  return <main className="app-shell"><Sidebar active="Finanzas" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Finanzas</strong></div></header><div className="content-wrap finance-page"><div className="page-heading"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>Finanzas</h1><p className="heading-subtitle">Cuánta plata tiene cada uno, qué entró, qué salió y cuánto se ganó.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => setModal('arqueo')}>Arqueo de caja</button><button className="outline-button" onClick={() => setModal('pase')}>Pase, retiro o aporte</button><button className="quick-button" onClick={() => setModal('egreso')}><Plus /> Registrar egreso</button></div></div>
    <div className="cajas-grid">{cajas.map(caja => { const pesos = caja.saldo('efectivo') + caja.saldo('transferencia'); return <div key={caja.clave} className={`card caja-card ${caja.clave === 'total' ? 'caja-total' : ''}`}><div className="caja-head"><h2>{caja.titulo}</h2><strong className={pesos < 0 ? 'monto-negativo' : ''}>{money(pesos)}</strong>{caja.saldo('dolares') !== 0 && <span className={caja.saldo('dolares') < 0 ? 'monto-negativo' : ''}>+ {formatearImporte(caja.saldo('dolares'), 'dolares')}</span>}</div><dl className="caja-medios">{MEDIOS_CAJA.map(medio => <Fragment key={medio}><dt>{METODOS_PAGO[medio]}</dt><dd className={caja.saldo(medio) < 0 ? 'monto-negativo' : ''}>{formatearImporte(caja.saldo(medio), medio)}</dd></Fragment>)}</dl></div> })}</div>
    <div className="finanzas-mes-titulo"><h2>Este mes · {nombreMes}</h2>{(datos.faltaCotizacion || datos.unidadesSinCosto > 0) && <p className="venta-ajuste">{datos.faltaCotizacion && <>Para pasar dólares y costos a pesos falta la cotización del dólar: <button className="text-link" onClick={() => onNavigate('configuracion')}>cargala en Configuración</button>. </>}{datos.unidadesSinCosto > 0 && `${numero(datos.unidadesSinCosto)} unidades vendidas son de productos sin costo cargado (se carga en el producto o con un ingreso de mercadería), así que la ganancia real puede ser menor.`}</p>}</div>
    <div className="metrics-grid finance-metrics"><Metric icon={<span className="metric-dot green" />} label="Vendido" value={money(datos.vendidoPesos) + (datos.vendidoUsd ? ` + US$ ${numero(datos.vendidoUsd)}` : '')} tone="mint" /><Metric icon={<ShoppingBag />} label="Costo de lo vendido" value={money(Math.round(datos.costoVendido))} tone="peach" /><Metric icon={<span className="metric-dot red" />} label="Gastos (sin mercadería)" value={money(Math.round(datos.gastos))} tone="peach" /><Metric icon={<span className="metric-dot purple" />} label="Ganancia real" value={money(Math.round(datos.ganancia))} tone="purple" /></div>
    <div className="dashboard-grid finanzas-detalle"><div className="card"><div className="card-head"><div><h2>Egresos por categoría</h2><p>Todo lo que salió este mes, en pesos</p></div><strong>{money(Math.round(datos.egresosTotal))}</strong></div><div className="categorias-egreso">{datos.porCategoria.length === 0 ? <p className="dashboard-vacio">Todavía no hay egresos este mes.</p> : datos.porCategoria.map(([categoria, monto]) => <div key={categoria} className="horizontal-row"><span>{CATEGORIAS_EGRESO[categoria]}</span><div className="horizontal-track"><i className="purple" style={{ width: `${monto / datos.porCategoria[0][1] * 100}%` }} /></div><strong>{money(Math.round(monto))}</strong></div>)}</div></div><div className="card"><div className="card-head"><div><h2>Cómo se calcula la ganancia</h2><p>{nombreMes}, en pesos</p></div></div><dl className="ficha-datos"><dt>Vendido</dt><dd>{money(Math.round(datos.vendido))}</dd><dt>− Costo de lo vendido</dt><dd>{money(Math.round(datos.costoVendido))}</dd><dt>− Gastos</dt><dd>{money(Math.round(datos.gastos))}</dd><dt>= Ganancia real</dt><dd>{money(Math.round(datos.ganancia))}</dd><dt>Retiros de socios</dt><dd>{money(Math.round(datos.retiros))}</dd></dl><p className="venta-lista">El costo es el de cada producto (se actualiza con cada ingreso de mercadería). Los egresos de “Mercadería” no se restan como gasto porque ya están en el costo.</p></div></div>
    <div className="finance-toolbar"><div className="filter-pills" role="group" aria-label="Filtrar movimientos">{([['todos', 'Todos'], ['ventas', 'Ventas'], ['egresos', 'Egresos'], ['otros', 'Pases, retiros y ajustes']] as const).map(([clave, etiqueta]) => <button key={clave} className={filtro === clave ? 'filter-pill selected' : 'filter-pill'} onClick={() => setFiltro(clave)}>{etiqueta}</button>)}</div></div>
    <div className="card clients-table-card"><div className="clients-table-head"><div><h2>Movimientos</h2><p>Las ventas entran solas a la caja de quien cobró</p></div></div>{visibles.length === 0 ? <div className="empty-state">Todavía no hay movimientos.</div> : <div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Caja</th><th>Monto</th><th></th></tr></thead><tbody>{visibles.map(fila => <tr key={fila.clave}><td data-label="Fecha">{formatearFecha(fila.fecha)}</td><td data-label="Tipo"><span className={`status-pill movimiento-${fila.grupo}`}>{fila.tipo}</span></td><td className="celda-principal"><strong>{fila.detalle}</strong></td><td data-label="Caja">{fila.quien} · {METODOS_PAGO[fila.medio].toLowerCase()}</td><td data-label="Monto"><strong className={fila.monto === null ? '' : fila.monto < 0 ? 'monto-negativo' : 'monto-positivo'}>{fila.monto === null ? fila.texto : conSigno(fila.monto, fila.medio)}</strong></td><td data-label="">{fila.movimientoId && <button className="text-link" disabled={borrando} onClick={() => borrar(fila)}>Borrar</button>}</td></tr>)}</tbody></table></div>}</div>
  </div></section>{modal === 'arqueo' && <ArqueoModal saldos={saldos} onClose={() => setModal(null)} />}{(modal === 'egreso' || modal === 'pase') && <MovimientoModal inicial={modal} onClose={() => setModal(null)} />}</main>
}

function MovimientoModal({ inicial, onClose }: { inicial: 'egreso' | 'pase'; onClose: () => void }) {
  const [tipo, setTipo] = useState<'egreso' | 'pase' | 'retiro' | 'aporte'>(inicial)
  const [fecha, setFecha] = useState(hoyEnArgentina)
  const [persona, setPersona] = useState('')
  const [medio, setMedio] = useState<MetodoPago>('efectivo')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [destinoPersona, setDestinoPersona] = useState('')
  const [destinoMedio, setDestinoMedio] = useState<MetodoPago>('efectivo')
  const [montoDestino, setMontoDestino] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const cambiaMoneda = tipo === 'pase' && (medio === 'dolares') !== (destinoMedio === 'dolares')
  const valido = persona !== '' && Number(monto) > 0 && (tipo !== 'egreso' || categoria !== '') && (tipo !== 'pase' || (destinoPersona !== '' && (!cambiaMoneda || Number(montoDestino) > 0)))
  const etiquetaPersona = { egreso: 'Quién pagó', pase: 'Sale de', retiro: 'Quién retira', aporte: 'Quién pone la plata' }[tipo]
  const guardar = () => startTransition(async () => {
    const problema = await registrarMovimiento({ tipo, fecha, persona, medio, monto: Number(monto), destinoPersona: tipo === 'pase' ? destinoPersona : null, destinoMedio: tipo === 'pase' ? destinoMedio : null, montoDestino: cambiaMoneda ? Number(montoDestino) : null, categoria: tipo === 'egreso' ? categoria : null, descripcion })
    if (problema) setError(problema)
    else terminar()
  })
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal movimiento-modal" role="dialog" aria-modal="true" aria-labelledby="movimiento-title"><header><div><p className="eyebrow">CAJA</p><h2 id="movimiento-title">{tipo === 'egreso' ? 'Registrar egreso' : TIPOS_MOVIMIENTO[tipo]}</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><div className="filter-pills" role="group" aria-label="Tipo de movimiento">{(['egreso', 'pase', 'retiro', 'aporte'] as const).map(opcion => <button key={opcion} type="button" className={tipo === opcion ? 'filter-pill selected' : 'filter-pill'} onClick={() => setTipo(opcion)}>{opcion === 'retiro' ? 'Retiro' : TIPOS_MOVIMIENTO[opcion]}</button>)}</div><p className="venta-lista">{{ egreso: 'Plata que sale del negocio: alquiler, sueldos, mercadería, etc.', pase: 'Plata que pasa de una caja a otra: entre Lucas y Gonzalo, depositar efectivo o comprar dólares.', retiro: 'Un socio se lleva plata del negocio (ganancia).', aporte: 'Un socio pone plata en el negocio.' }[tipo]}</p><div className="modal-fields"><label className="field"><span>{etiquetaPersona}</span><select value={persona} onChange={event => setPersona(event.target.value)} aria-label={etiquetaPersona}><option value="">Elegí</option>{opciones(RECIBIO)}</select></label><label className="field"><span>{tipo === 'pase' ? 'Desde' : 'Con'}</span><select value={medio} onChange={event => setMedio(event.target.value as MetodoPago)} aria-label="Medio">{opciones(METODOS_PAGO)}</select></label></div>{tipo === 'pase' && <div className="modal-fields"><label className="field"><span>Va a</span><select value={destinoPersona} onChange={event => setDestinoPersona(event.target.value)} aria-label="Va a"><option value="">Elegí</option>{opciones(RECIBIO)}</select></label><label className="field"><span>Como</span><select value={destinoMedio} onChange={event => setDestinoMedio(event.target.value as MetodoPago)} aria-label="Medio de destino">{opciones(METODOS_PAGO)}</select></label></div>}<div className="modal-fields"><label className="field"><span>Monto ({medio === 'dolares' ? 'US$' : '$'})</span><input type="number" min="0" step="0.01" value={monto} onChange={event => setMonto(event.target.value)} aria-label="Monto" /></label><label className="field"><span>Fecha</span><input type="date" value={fecha} max={hoyEnArgentina()} onChange={event => setFecha(event.target.value)} /></label></div>{cambiaMoneda && <label className="field"><span>Cuánto llega ({destinoMedio === 'dolares' ? 'US$' : '$'})</span><input type="number" min="0" step="0.01" value={montoDestino} onChange={event => setMontoDestino(event.target.value)} aria-label="Cuánto llega" /></label>}{tipo === 'egreso' && <label className="field"><span>Categoría</span><select value={categoria} onChange={event => setCategoria(event.target.value)} aria-label="Categoría"><option value="">Elegí</option>{opciones(CATEGORIAS_EGRESO)}</select></label>}<label className="field"><span>Detalle <em>(opcional)</em></span><input value={descripcion} onChange={event => setDescripcion(event.target.value)} placeholder={{ egreso: 'Ej. alquiler de octubre', pase: 'Ej. Lucas le pasa el efectivo a Gonzalo', retiro: 'Ej. retiro de ganancia', aporte: 'Ej. para pagar mercadería' }[tipo]} /></label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!valido || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button></footer></section></div>
}

function ArqueoModal({ saldos, onClose }: { saldos: SaldoCaja[]; onClose: () => void }) {
  const [persona, setPersona] = useState('')
  const [medio, setMedio] = useState<MetodoPago>('efectivo')
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const calculado = persona ? saldoDe(saldos, persona as Recibio, medio) : null
  const diferencia = contado.trim() !== '' && calculado !== null ? Math.round((Number(contado) - calculado) * 100) / 100 : null
  const guardar = () => startTransition(async () => {
    const resultado = await registrarArqueo(persona, medio, Number(contado), nota)
    if ('error' in resultado) setError(resultado.error ?? 'No se pudo registrar el arqueo.')
    else terminar()
  })
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal arqueo-modal" role="dialog" aria-modal="true" aria-labelledby="arqueo-title"><header><div><p className="eyebrow">CAJA</p><h2 id="arqueo-title">Arqueo de caja</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><p className="venta-lista">Contá la plata de una caja y cargá cuánto hay. Si no coincide con lo que calcula el CRM, se registra un ajuste por la diferencia. La primera vez sirve para cargar el saldo con el que arrancan.</p><div className="modal-fields"><label className="field"><span>Caja de</span><select value={persona} onChange={event => setPersona(event.target.value)} aria-label="Caja de"><option value="">Elegí</option>{opciones(RECIBIO)}</select></label><label className="field"><span>Medio</span><select value={medio} onChange={event => setMedio(event.target.value as MetodoPago)} aria-label="Medio">{opciones(METODOS_PAGO)}</select></label></div>{calculado !== null && <p className="arqueo-calculado">Según el CRM hay <strong>{formatearImporte(calculado, medio)}</strong></p>}<label className="field"><span>Cuánto contaste ({medio === 'dolares' ? 'US$' : '$'})</span><input type="number" min="0" step="0.01" value={contado} onChange={event => setContado(event.target.value)} aria-label="Cuánto contaste" /></label>{diferencia !== null && <p className={diferencia === 0 ? 'venta-promo' : 'venta-ajuste'}>{diferencia === 0 ? 'Coincide: no hace falta ajuste.' : `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${formatearImporte(Math.abs(diferencia), medio)}: se registra un ajuste.`}</p>}<label className="field"><span>Nota <em>(opcional)</em></span><input value={nota} onChange={event => setNota(event.target.value)} placeholder="Ej. saldo inicial" /></label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!persona || contado.trim() === '' || Number(contado) < 0 || guardando} onClick={guardar}>{guardando ? 'Guardando…' : diferencia === 0 ? 'Listo' : 'Registrar arqueo'}</button></footer></section></div>
}

type FiltrosActividad = { desde: string; hasta: string; usuario: string; tipo: string; texto: string }
const FILTROS_ACTIVIDAD: FiltrosActividad = { desde: '', hasta: '', usuario: '', tipo: '', texto: '' }
const SISTEMA = 'sistema'
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// "Hoy", "Ayer" o "lunes 19/10/2026", para separar los movimientos por día.
function tituloDia(dia: string, hoy: string) {
  const ayer = diaArgentina(new Date(new Date(`${hoy}T12:00:00`).getTime() - 86_400_000))
  const [anio, mes, numeroDia] = dia.split('-')
  const nombre = DIAS_SEMANA[new Date(`${dia}T12:00:00`).getDay()]
  const fecha = `${nombre} ${numeroDia}/${mes}/${anio}`
  return dia === hoy ? `Hoy · ${fecha}` : dia === ayer ? `Ayer · ${fecha}` : fecha.charAt(0).toUpperCase() + fecha.slice(1)
}

// Movimientos: todo lo que se hizo en el CRM, con quién y cuándo (lo registra la base, no se puede borrar).
function Movimientos({ actividad, onNavigate }: { actividad: Actividad[]; onNavigate: (view: Vista) => void }) {
  const [filtros, setFiltros] = useState(FILTROS_ACTIVIDAD)
  const filtrar = (cambios: Partial<FiltrosActividad>) => setFiltros(actuales => ({ ...actuales, ...cambios }))
  const hoy = hoyEnArgentina()
  const usuarios = useMemo(() => [...new Set(actividad.map(item => item.usuario_email ?? SISTEMA))].sort(), [actividad])
  const buscado = normalizar(filtros.texto.trim())
  const visibles = actividad.filter(item => {
    const dia = diaArgentina(item.fecha)
    return (!filtros.desde || dia >= filtros.desde) && (!filtros.hasta || dia <= filtros.hasta) &&
      (!filtros.usuario || (item.usuario_email ?? SISTEMA) === filtros.usuario) && (!filtros.tipo || item.tipo === filtros.tipo) &&
      (!buscado || normalizar(`${item.accion} ${item.detalle ?? ''}`).includes(buscado))
  })
  const dias: { dia: string; items: Actividad[] }[] = []
  for (const item of visibles) {
    const dia = diaArgentina(item.fecha)
    if (dias.at(-1)?.dia === dia) dias.at(-1)!.items.push(item)
    else dias.push({ dia, items: [item] })
  }
  const hayFiltros = Object.values(filtros).some(Boolean)
  const nombreUsuario = (email: string | null) => email ? usuarioCorto(email) : 'Sistema'
  return <main className="app-shell"><Sidebar active="Movimientos" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Movimientos</strong></div></header><div className="content-wrap movimientos-page"><div className="page-heading"><div><p className="eyebrow">CONTROL</p><h1>Movimientos</h1><p className="heading-subtitle">Quién hizo qué y cuándo: ventas, mercadería, stock, productos, caja, clientes y configuración. Se registra solo y no se puede borrar.</p></div></div>{actividad.length === 0 ? <div className="card empty-state">Todavía no hay movimientos registrados.</div> : <><div className="card filtros-card"><div className="filtros-grid filtros-actividad"><label className="field"><span>Desde</span><input type="date" value={filtros.desde} onChange={event => filtrar({ desde: event.target.value })} aria-label="Desde" /></label><label className="field"><span>Hasta</span><input type="date" value={filtros.hasta} onChange={event => filtrar({ hasta: event.target.value })} aria-label="Hasta" /></label><label className="field"><span>Quién</span><select value={filtros.usuario} onChange={event => filtrar({ usuario: event.target.value })} aria-label="Filtrar por usuario"><option value="">Todos</option>{usuarios.map(usuario => <option key={usuario} value={usuario}>{usuario === SISTEMA ? 'Sistema' : usuarioCorto(usuario)}</option>)}</select></label><label className="field"><span>Qué</span><select value={filtros.tipo} onChange={event => filtrar({ tipo: event.target.value })} aria-label="Filtrar por tipo"><option value="">Todo</option>{opciones(TIPOS_ACTIVIDAD)}</select></label><label className="field"><span>Buscar</span><input value={filtros.texto} onChange={event => filtrar({ texto: event.target.value })} placeholder="Ej. venta #3, Elfbar, Lucas" aria-label="Buscar en los movimientos" /></label></div>{hayFiltros && <button className="text-link" onClick={() => setFiltros(FILTROS_ACTIVIDAD)}>Limpiar filtros</button>}</div><p className="stock-resumen">{numero(visibles.length)} {visibles.length === 1 ? 'movimiento' : 'movimientos'}{actividad.length >= 1000 ? ' · se muestran los últimos 1.000' : ''}</p>{dias.length === 0 ? <div className="card empty-state">Ningún movimiento coincide con los filtros.</div> : dias.map(({ dia, items }) => <section key={dia} className="card actividad-dia"><h2>{tituloDia(dia, hoy)}</h2><ol className="actividad-lista">{items.map(item => <li key={item.id} className={`actividad-item tipo-${item.tipo}`}><span className="actividad-hora">{horaArgentina(item.fecha)}</span><div className="actividad-cuerpo"><div className="actividad-cabeza"><span className={`actividad-usuario ${item.usuario_email ? '' : 'sistema'}`}><i>{nombreUsuario(item.usuario_email).charAt(0).toUpperCase()}</i>{nombreUsuario(item.usuario_email)}</span><span className="actividad-tipo">{TIPOS_ACTIVIDAD[item.tipo] ?? item.tipo}</span></div><strong>{item.accion}</strong>{item.detalle && <p>{item.detalle}</p>}</div></li>)}</ol></section>)}</>}</div></section></main>
}

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
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Clientes</strong></div></header><div className="content-wrap clients-page"><div className="page-heading clients-heading"><div><p className="eyebrow">RELACIÓN CON CLIENTES</p><h1>Clientes</h1><p className="heading-subtitle">Conocé y gestioná a las personas que eligen tu tienda.</p></div><button className="quick-button" onClick={() => setMostrarNuevo(true)}><Plus /> Nuevo cliente</button></div><div className="metrics-grid clients-metrics"><Metric icon={<Users />} label="Total de clientes" value={numero(clientes.length)} tone="purple" /><Metric icon={<span className="metric-dot green" />} label="Compraron alguna vez" value={numero(compraron)} tone="mint" /><Metric icon={<span className="metric-dot orange" />} label="Sin contactar todavía" value={numero(sinContactar)} tone="peach" /></div><div className="clients-toolbar"><label className="search-control"><Search /><input value={filtros.texto} onChange={event => filtrar({ texto: event.target.value })} placeholder="Buscar por nombre o teléfono..." /></label><Filtro valor={filtros.segmento} etiquetas={SEGMENTOS} todos="Todos los segmentos" onChange={segmento => filtrar({ segmento })} /><Filtro valor={filtros.zona} etiquetas={ZONAS} todos="Todas las zonas" onChange={zona => filtrar({ zona })} /><span className="result-count">{numero(filtrados.length)} clientes</span></div><div className="card clients-table-card"><div className="clients-table-head"><div><h2>Base de clientes</h2><p>Tocá un cliente para ver su ficha</p></div></div><div className="sales-table-wrap"><table className="clients-table"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Segmento</th><th>Zona</th><th>Campaña</th><th>Último contacto</th></tr></thead><tbody>{visibles.map(cliente => <tr key={cliente.id} tabIndex={0} onClick={() => onSelect(cliente.id)} onKeyDown={event => event.key === 'Enter' && onSelect(cliente.id)}><td className="celda-principal"><div className="client-table"><span>{iniciales(cliente.nombre)}</span><strong>{cliente.nombre}</strong></div></td><td data-label="Teléfono">{cliente.telefono}</td><td data-label="Segmento">{SEGMENTOS[cliente.segmento]}</td><td data-label="Zona">{cliente.zona ? ZONAS[cliente.zona] : '—'}</td><td data-label="Campaña"><span className={`status-pill campana-${cliente.estado_campana}`}>{ESTADOS_CAMPANA[cliente.estado_campana]}</span></td><td data-label="Último contacto">{formatearFecha(cliente.fecha_ultimo_contacto)}</td></tr>)}</tbody></table>{visibles.length === 0 && <div className="empty-state">Ningún cliente coincide con la búsqueda.</div>}</div><div className="clients-footer"><span>{filtrados.length === 0 ? 'Sin resultados' : `Mostrando ${numero(desde)}–${numero(desde + visibles.length - 1)} de ${numero(filtrados.length)}`}</span><div><button className="pagination-button" disabled={pagina === 1} onClick={() => irAPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft /></button><span className="pagination-current" aria-label={`Página ${pagina} de ${paginas}`}>{pagina}</span><button className="pagination-button" disabled={pagina === paginas} onClick={() => irAPagina(pagina + 1)} aria-label="Página siguiente"><ChevronRight /></button></div></div></div></div></section>{mostrarNuevo && <NuevoCliente onClose={() => setMostrarNuevo(false)} />}</main>
}

function Filtro({ valor, etiquetas, todos, onChange }: { valor: string; etiquetas: Record<string, string>; todos: string; onChange: (valor: string) => void }) { return <label className="filter-control"><select value={valor} onChange={event => onChange(event.target.value)} aria-label={todos}><option value="">{todos}</option>{opciones(etiquetas)}</select><ChevronDown /></label> }

function FichaCliente({ cliente, ventas, onBack, onNavigate }: { cliente: Cliente; ventas: Venta[]; onBack: () => void; onNavigate: (view: Vista) => void }) {
  const [notas, setNotas] = useState(cliente.notas ?? '')
  const [guardando, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardarNotas = () => startTransition(async () => {
    const error = await actualizarCliente(cliente.id, { notas })
    setResultado(error ? { ok: false, texto: error } : { ok: true, texto: 'Notas guardadas.' })
  })
  const compras = ventas.filter(venta => venta.cliente_id === cliente.id)
  const gastadoPesos = compras.filter(venta => venta.metodo_pago !== 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const gastadoUsd = compras.filter(venta => venta.metodo_pago === 'dolares').reduce((suma, venta) => suma + venta.total, 0)
  const unidades = compras.reduce((suma, venta) => suma + venta.venta_items.reduce((s, item) => s + item.cantidad, 0), 0)
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ficha de cliente</strong></div></header><div className="content-wrap client-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft /> Volver a clientes</button><div className="detail-heading"><div><p className="eyebrow">FICHA DE CLIENTE</p><h1>{cliente.nombre}</h1><p className="heading-subtitle">{SEGMENTOS[cliente.segmento]}{cliente.zona && ` · ${ZONAS[cliente.zona]}`}</p></div>{guardando ? <span className="ficha-estado">Guardando…</span> : resultado && <span className={`ficha-estado ${resultado.ok ? 'ok' : 'error'}`} role="status">{resultado.texto}</span>}</div><div className="metrics-grid ficha-metricas"><Metric icon={<ShoppingBag />} label="Compras" value={numero(compras.length)} tone="purple" /><Metric icon={<span className="metric-dot green" />} label="Total gastado" value={money(gastadoPesos) + (gastadoUsd ? ` + US$ ${numero(gastadoUsd)}` : '')} tone="mint" /><Metric icon={<span className="metric-dot orange" />} label="Unidades" value={numero(unidades)} tone="peach" /><Metric icon={<span className="metric-dot purple" />} label="Última compra" value={formatearFecha(cliente.fecha_ultima_compra)} tone="blue" /></div><div className="card clients-table-card ficha-compras"><div className="clients-table-head"><div><h2>Compras</h2><p>Qué compró, cuándo y cómo pagó</p></div></div>{compras.length === 0 ? <div className="empty-state">Todavía no tiene compras registradas.</div> : <div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>N°</th><th>Fecha</th><th>Productos y precio</th><th>Pago</th><th>Recibió</th><th>Cargó</th><th>Total</th></tr></thead><tbody>{compras.map(venta => <tr key={venta.id}><td data-label="N°"><strong>#{venta.numero}</strong></td><td data-label="Fecha">{formatearFecha(venta.fecha)}</td><td data-label="Productos y precio de venta"><div className="venta-items-celda">{venta.venta_items.map(item => <span key={item.id}>{item.cantidad} × {item.descripcion} · <b>{formatearImporte(item.precio_unitario, venta.metodo_pago)} c/u</b></span>)}</div></td><td data-label="Pago"><span className={`payment-pill ${venta.metodo_pago}`}>{METODOS_PAGO[venta.metodo_pago]}</span></td><td data-label="Recibió">{RECIBIO[venta.recibio]}</td><td data-label="Cargó">{usuarioCorto(venta.cargada_por_email)}</td><td data-label="Total"><strong>{formatearImporte(venta.total, venta.metodo_pago)}</strong></td></tr>)}</tbody></table></div>}</div><div className="detail-columns"><div className="card profile-card"><div className="section-title"><div><h2>Datos</h2><p>Cómo está cargado en la base</p></div></div><dl className="ficha-datos"><dt>Teléfono</dt><dd>{cliente.telefono}</dd><dt>Agendado como</dt><dd>{cliente.nombre_original ?? '—'}</dd><dt>Segmento</dt><dd>{SEGMENTOS[cliente.segmento]}</dd><dt>Zona</dt><dd>{cliente.zona ? ZONAS[cliente.zona] : '—'}</dd><dt>Último contacto</dt><dd>{formatearFecha(cliente.fecha_ultimo_contacto)}</dd><dt>Cargado el</dt><dd>{formatearFecha(cliente.created_at)}</dd></dl></div><div className="card notes-card"><div className="section-title"><div><h2>Notas</h2><p>Información útil sobre este cliente</p></div></div><label className="field ficha-notas"><textarea value={notas} onChange={event => setNotas(event.target.value)} rows={4} placeholder="Ej. prefiere pods de menta" aria-label="Notas" /></label><button className="quick-button" disabled={guardando || notas.trim() === (cliente.notas ?? '')} onClick={guardarNotas}>Guardar notas</button></div></div></div></section></main>
}

// Mientras hay un modal o el menú abierto, la página de fondo no scrollea (en el celular se movía el fondo).
function useBloquearScroll(activo = true) {
  useEffect(() => {
    if (!activo) return
    const raiz = document.documentElement
    const anterior = raiz.style.overflow
    raiz.style.overflow = 'hidden'
    return () => { raiz.style.overflow = anterior }
  }, [activo])
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
  useBloquearScroll()
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const problema = await crearCliente(formData)
      if (problema) setError(problema)
      else terminar()
    })
  }
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title"><header><div><p className="eyebrow">NUEVO REGISTRO</p><h2 id="new-client-title">Nuevo cliente</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><form onSubmit={enviar}><div className="modal-body"><label className="field"><span>Nombre</span><input name="nombre" required placeholder="Ej. Martina González" /></label><label className="field"><span>Teléfono</span><input name="telefono" required inputMode="tel" placeholder="Ej. 221 438 3399" /></label><div className="modal-fields"><label className="field"><span>Segmento</span><select name="segmento" defaultValue="cliente">{opciones(SEGMENTOS)}</select></label><label className="field"><span>Zona</span><select name="zona" defaultValue="la_plata">{opciones(ZONAS)}</select></label></div><label className="field"><span>Notas <em>(opcional)</em></span><textarea name="notas" rows={3} placeholder="Ej. prefiere pods de menta" /></label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cliente'}</button></footer></form></section></div>
}

type LineaVenta = { clave: number; marca: string; productoId: string; saborId: string; cantidad: string }
const lineaVacia = (clave: number): LineaVenta => ({ clave, marca: '', productoId: '', saborId: '', cantidad: '1' })
const redondear = (valor: number) => Math.round(valor * 100) / 100

function NuevaVentaModal({ venta, clientes, productos, onClose, onIrAProductos }: { venta: Venta | null; clientes: Cliente[]; productos: Producto[]; onClose: () => void; onIrAProductos: () => void }) {
  const productoPorId = useMemo(() => new Map(productos.map(producto => [producto.id, producto])), [productos])
  const saborPorId = useMemo(() => new Map(productos.flatMap(producto => producto.sabores.map(sabor => [sabor.id, sabor] as const))), [productos])
  // Al editar, las líneas arrancan con lo que se vendió (marca, producto y sabor de cada ítem).
  const lineasIniciales = (): LineaVenta[] => {
    if (!venta || venta.venta_items.length === 0) return [lineaVacia(1)]
    return venta.venta_items.map((item, i) => {
      const sabor = item.sabor_id ? saborPorId.get(item.sabor_id) : undefined
      const producto = sabor ? productoPorId.get(sabor.producto_id) : undefined
      return { clave: i + 1, marca: producto?.marca ?? '', productoId: producto?.id ?? '', saborId: sabor?.id ?? '', cantidad: String(item.cantidad) }
    })
  }
  const [busqueda, setBusqueda] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(() => venta ? clientes.find(opcion => opcion.id === venta.cliente_id) ?? null : null)
  const [clienteNuevo, setClienteNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [lineas, setLineas] = useState(lineasIniciales)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(venta?.metodo_pago ?? 'efectivo')
  const [recibio, setRecibio] = useState<string>(venta?.recibio ?? '')
  const [fecha, setFecha] = useState(venta?.fecha ?? hoyEnArgentina())
  const [totalManual, setTotalManual] = useState(venta && venta.total !== venta.total_lista ? String(venta.total) : '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const sugeridos = useMemo(() => busqueda.trim() ? filtrarClientes(clientes, { ...FILTROS_INICIALES, texto: busqueda }).slice(0, 5) : [], [clientes, busqueda])
  const marcas = useMemo(() => marcasDe(productos), [productos])

  // Precios de lista según el medio de pago, con la promo x3 por modelo. Si se carga un total cobrado
  // distinto, cada producto se ajusta en la misma proporción (igual que lo guarda la base).
  const importe = (valor: number) => formatearImporte(valor, metodoPago)
  const unidades = (linea: LineaVenta) => Number(linea.cantidad) || 0
  const precioLista = (linea: LineaVenta) => { const producto = productoPorId.get(linea.productoId); return producto ? precioSegunPago(producto, metodoPago) : null }
  const completas = lineas.filter(linea => linea.saborId && productoPorId.has(linea.productoId))
  const calculo = calcularTotales(completas.map(linea => ({ producto: productoPorId.get(linea.productoId)!, cantidad: unidades(linea) })), metodoPago)
  const hayTotalManual = totalManual.trim() !== ''
  const totalCobrado = hayTotalManual ? Number(totalManual) : calculo.totalLista ?? Number.NaN
  const totalValido = Number.isFinite(totalCobrado) && totalCobrado >= 0
  const promoAplicada = calculo.totalLista !== null ? calculo.sinPromo - calculo.totalLista : 0
  const ajustado = hayTotalManual && totalValido && totalCobrado !== calculo.totalLista
  const conPrecioAjustado = totalValido && (ajustado || promoAplicada > 0)
  const precioVenta = (linea: LineaVenta) => !calculo.faltaPrecio && calculo.sinPromo > 0 ? redondear((precioLista(linea) ?? 0) * totalCobrado / calculo.sinPromo) : calculo.unidades ? redondear(totalCobrado / calculo.unidades) : 0
  // Stock disponible: al editar, lo que esta venta ya había descontado vuelve a estar disponible.
  const devueltoPorSabor = new Map<string, number>()
  for (const item of venta?.venta_items ?? []) if (item.sabor_id) devueltoPorSabor.set(item.sabor_id, (devueltoPorSabor.get(item.sabor_id) ?? 0) + item.cantidad)
  const disponible = (saborId: string) => (saborPorId.get(saborId)?.stock ?? 0) + (devueltoPorSabor.get(saborId) ?? 0)
  const pedidoPorSabor = new Map<string, number>()
  for (const linea of completas) pedidoPorSabor.set(linea.saborId, (pedidoPorSabor.get(linea.saborId) ?? 0) + unidades(linea))

  const cambiarLinea = (clave: number, cambios: Partial<LineaVenta>) => setLineas(actuales => actuales.map(linea => linea.clave === clave ? { ...linea, ...cambios } : linea))
  const hayCliente = cliente !== null || (clienteNuevo && nuevoNombre.trim() !== '' && nuevoTelefono.trim() !== '')
  const lineasCompletas = lineas.every(linea => linea.saborId !== '' && Number.isInteger(Number(linea.cantidad)) && Number(linea.cantidad) >= 1)
  const elegirClienteNuevo = () => { setClienteNuevo(true); if (!/\d/.test(busqueda)) setNuevoNombre(busqueda.trim()); else setNuevoTelefono(busqueda.trim()) }
  const guardar = () => startTransition(async () => {
    const datos = { clienteId: cliente?.id ?? null, nuevoNombre, nuevoTelefono, fecha, metodoPago, recibio, total: hayTotalManual ? Number(totalManual) : null, items: lineas.map(linea => ({ sabor_id: linea.saborId, cantidad: Number(linea.cantidad) })) }
    const problema = venta ? await editarVenta(venta.id, datos) : await registrarVenta(datos)
    if (problema) setError(problema)
    else terminar()
  })
  const precioDeLinea = (linea: LineaVenta) => {
    if (!linea.saborId) return <small>—</small>
    const lista = precioLista(linea)
    if (lista === null && !conPrecioAjustado) return <small className="dato-faltante">sin precio en US$</small>
    const unitario = conPrecioAjustado ? precioVenta(linea) : lista ?? 0
    return <><strong>{importe(unitario * unidades(linea))}</strong><small>{importe(unitario)} c/u{conPrecioAjustado && lista !== null && unitario !== lista && <s>{importe(lista)}</s>}</small></>
  }
  const campoCliente = cliente
    ? <div className="venta-cliente"><div><strong>{cliente.nombre}</strong><small>{cliente.telefono}</small></div><button type="button" className="text-button" onClick={() => setCliente(null)}>Cambiar</button></div>
    : clienteNuevo
      ? <><div className="modal-fields"><input value={nuevoNombre} onChange={event => setNuevoNombre(event.target.value)} placeholder="Nombre" aria-label="Nombre del cliente nuevo" /><input value={nuevoTelefono} onChange={event => setNuevoTelefono(event.target.value)} inputMode="tel" placeholder="Teléfono (ej. 221 438 3399)" aria-label="Teléfono del cliente nuevo" /></div><button type="button" className="text-button" onClick={() => setClienteNuevo(false)}>Buscar un cliente existente</button></>
      : <><input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar cliente por nombre o teléfono..." aria-label="Buscar cliente" />{busqueda.trim() && <div className="autocomplete-list">{sugeridos.map(sugerido => <button type="button" key={sugerido.id} onClick={() => { setCliente(sugerido); setBusqueda('') }}>{sugerido.nombre}<small>{sugerido.telefono}</small></button>)}<button type="button" className="create-client-option" onClick={elegirClienteNuevo}>+ Cliente nuevo</button></div>}</>
  const campoProductos = productos.length === 0
    ? <p className="empty-items">Todavía no hay productos cargados. <button type="button" className="text-link" onClick={onIrAProductos}>Cargalos en Productos y stock</button></p>
    : <><div className="venta-lineas">{lineas.map(linea => { const sinStock = linea.saborId !== '' && (pedidoPorSabor.get(linea.saborId) ?? 0) > disponible(linea.saborId); return <div className="venta-linea" key={linea.clave}><select className="venta-marca" value={linea.marca} onChange={event => cambiarLinea(linea.clave, { marca: event.target.value, productoId: '', saborId: '' })} aria-label="Marca"><option value="">Marca</option>{marcas.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}</select><select className="venta-producto" value={linea.productoId} disabled={!linea.marca} onChange={event => cambiarLinea(linea.clave, { productoId: event.target.value, saborId: '' })} aria-label="Producto"><option value="">{linea.marca ? 'Producto' : 'Elegí la marca'}</option>{productos.filter(producto => producto.marca === linea.marca).map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select><select className="venta-sabor" value={linea.saborId} disabled={!linea.productoId} onChange={event => cambiarLinea(linea.clave, { saborId: event.target.value })} aria-label="Sabor"><option value="">{linea.productoId ? 'Sabor' : 'Elegí el producto'}</option>{productoPorId.get(linea.productoId)?.sabores.filter(opcion => opcion.activo || opcion.id === linea.saborId).map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre} · stock {disponible(opcion.id)}</option>)}</select><input type="number" min="1" step="1" value={linea.cantidad} onChange={event => cambiarLinea(linea.clave, { cantidad: event.target.value })} aria-label="Cantidad" /><div className="venta-precio">{precioDeLinea(linea)}{sinStock && <small className="dato-faltante">stock: {disponible(linea.saborId)}</small>}</div><button type="button" className="close-button" disabled={lineas.length === 1} onClick={() => setLineas(actuales => actuales.filter(otra => otra.clave !== linea.clave))} aria-label="Quitar producto"><X /></button></div> })}</div><button type="button" className="text-button" onClick={() => setLineas(actuales => [...actuales, lineaVacia((actuales.at(-1)?.clave ?? 0) + 1)])}><Plus /> Agregar otro producto</button></>
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="new-sale-title"><header><div><p className="eyebrow">{venta ? `VENTA #${venta.numero}` : 'REGISTRAR OPERACIÓN'}</p><h2 id="new-sale-title">{venta ? 'Editar venta' : 'Nueva venta'}</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body">{venta && <p className="venta-lista">Cargada por {usuarioCorto(venta.cargada_por_email)}{venta.editada_en && ` · última edición de ${usuarioCorto(venta.editada_por_email)}`}. Al guardar, el stock se corrige solo.</p>}<div className="field"><span>Cliente</span>{campoCliente}</div><div className="modal-fields"><label className="field"><span>Medio de pago</span><select value={metodoPago} onChange={event => setMetodoPago(event.target.value as MetodoPago)}>{opciones(METODOS_PAGO)}</select></label><label className="field"><span>Quién recibió el pago</span><select value={recibio} onChange={event => setRecibio(event.target.value)}><option value="">Elegí</option>{opciones(RECIBIO)}</select></label></div><div className="field"><span>Productos</span>{campoProductos}</div><div className="modal-fields"><label className="field"><span>Fecha</span><input type="date" value={fecha} max={hoyEnArgentina()} onChange={event => setFecha(event.target.value)} /></label><label className="field"><span>Total cobrado <em>(si hubo descuento)</em></span><input type="number" min="0" step="0.01" value={totalManual} onChange={event => setTotalManual(event.target.value)} placeholder={calculo.totalLista !== null ? `Lista: ${importe(calculo.totalLista)}` : 'Escribí el total'} aria-label="Total cobrado" /></label></div>{promoAplicada > 0 && <p className="venta-promo">Promo x3 aplicada: −{importe(promoAplicada)} sobre {importe(calculo.sinPromo)}.</p>}{calculo.faltaPrecio && !hayTotalManual && <p className="venta-ajuste">Algún producto no tiene precio en dólares: escribí el total cobrado (o cargá el precio en Productos).</p>}{ajustado && calculo.totalLista !== null && <p className="venta-ajuste">{totalCobrado < calculo.totalLista ? 'Descuento' : 'Recargo'} de {importe(Math.abs(calculo.totalLista - totalCobrado))}{calculo.totalLista > 0 && ` (${Math.abs(Math.round((totalCobrado / calculo.totalLista - 1) * 100))}%)`} sobre el total de lista ({importe(calculo.totalLista)}). El precio de venta de cada producto se ajusta en la misma proporción.</p>}<div className="sale-total"><span>Total</span><strong>{importe(totalValido ? totalCobrado : 0)}</strong></div>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!hayCliente || !lineasCompletas || !recibio || !totalValido || guardando} onClick={guardar}>{guardando ? 'Guardando…' : venta ? 'Guardar cambios' : 'Registrar venta'}</button></footer></section></div>
}

function IngresoModal({ productos, cotizacion, onClose }: { productos: Producto[]; cotizacion: number | null; onClose: () => void }) {
  const [productoId, setProductoId] = useState('')
  const [fecha, setFecha] = useState(hoyEnArgentina)
  const [costo, setCosto] = useState('')
  const [notas, setNotas] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const producto = productos.find(opcion => opcion.id === productoId)
  const sabores = producto?.sabores.filter(sabor => sabor.activo) ?? []
  const cantidad = (saborId: string) => Number(cantidades[saborId]) || 0
  const unidades = sabores.reduce((suma, sabor) => suma + cantidad(sabor.id), 0)
  const costoUnitario = Number(costo.replace(',', '.'))
  const costoValido = costo.trim() !== '' && Number.isFinite(costoUnitario) && costoUnitario >= 0
  const cantidadesValidas = sabores.every(sabor => !cantidades[sabor.id] || (Number.isInteger(Number(cantidades[sabor.id])) && Number(cantidades[sabor.id]) >= 0))
  const guardar = () => startTransition(async () => {
    const problema = await registrarCompra({ productoId, fecha, costoUnitarioUsd: costoUnitario, notas, items: sabores.filter(sabor => cantidad(sabor.id) > 0).map(sabor => ({ sabor_id: sabor.id, cantidad: cantidad(sabor.id) })) })
    if (problema) setError(problema)
    else terminar()
  })
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="ingreso-title"><header><div><p className="eyebrow">STOCK</p><h2 id="ingreso-title">Ingreso de mercadería</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><label className="field"><span>Producto</span><select value={productoId} onChange={event => { setProductoId(event.target.value); setCantidades({}) }} aria-label="Producto"><option value="">Elegí el producto</option>{productos.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.marca} {opcion.nombre}</option>)}</select></label><div className="modal-fields"><label className="field"><span>Fecha de compra</span><input type="date" value={fecha} max={hoyEnArgentina()} onChange={event => setFecha(event.target.value)} /></label><label className="field"><span>Costo por unidad (US$)</span><input type="number" min="0" step="0.01" value={costo} onChange={event => setCosto(event.target.value)} placeholder="Ej. 9.50" aria-label="Costo por unidad en dólares" /></label></div>{producto && <div className="field"><span>Unidades por sabor</span><div className="ingreso-sabores">{sabores.map(sabor => <label key={sabor.id} className="ingreso-sabor"><span>{sabor.nombre}<small>hay {numero(sabor.stock)}</small></span><input type="number" min="0" step="1" value={cantidades[sabor.id] ?? ''} onChange={event => setCantidades(actuales => ({ ...actuales, [sabor.id]: event.target.value }))} placeholder="0" aria-label={`Unidades de ${sabor.nombre}`} /></label>)}</div></div>}<label className="field"><span>Notas <em>(opcional, ej. proveedor)</em></span><input value={notas} onChange={event => setNotas(event.target.value)} /></label><div className="sale-total"><span>{numero(unidades)} unidades · total</span><strong>{formatearImporte(costoValido ? costoUnitario * unidades : 0, 'dolares')}</strong></div>{cotizacion && costoValido && unidades > 0 && <p className="venta-lista ingreso-pesos">≈ {money(Math.round(costoUnitario * unidades * cotizacion))} con la cotización de {money(cotizacion)}</p>}{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!producto || unidades === 0 || !costoValido || !cantidadesValidas || guardando} onClick={guardar}>{guardando ? 'Registrando…' : 'Registrar ingreso'}</button></footer></section></div>
}

function Ajustes({ configuracion, onNavigate }: { configuracion: Configuracion; onNavigate: (view: Vista) => void }) {
  const [valor, setValor] = useState(configuracion.cotizacion_usd ? String(configuracion.cotizacion_usd) : '')
  const [stockBajo, setStockBajo] = useState(String(configuracion.stock_bajo))
  const [guardando, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardar = (accion: () => Promise<string | null>, mensaje: string) => startTransition(async () => {
    const error = await accion()
    setResultado(error ? { ok: false, texto: error } : { ok: true, texto: mensaje })
  })
  return <main className="app-shell"><Sidebar active="Configuración" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Configuración</strong></div></header><div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">AJUSTES</p><h1>Configuración</h1><p className="heading-subtitle">Datos que usa el CRM para hacer cuentas.</p></div>{guardando ? <p className="ficha-estado">Guardando…</p> : resultado && <p className={`ficha-estado ${resultado.ok ? 'ok' : 'error'}`} role="status">{resultado.texto}</p>}</div><div className="config-grid"><div className="card profile-card config-card"><div className="section-title"><div><h2>Cotización del dólar</h2><p>Cuántos pesos vale 1 US$ para ustedes. Se usa para pasar a pesos el costo de la mercadería y calcular márgenes y ganancia.</p></div></div><div className="config-cotizacion"><label className="field"><span>1 US$ =</span><input type="number" min="0" step="0.01" value={valor} onChange={event => setValor(event.target.value)} placeholder="Ej. 1540" aria-label="Pesos por dólar" /></label><button className="quick-button" disabled={guardando || valor.trim() === ''} onClick={() => guardar(() => guardarCotizacion(Number(valor.replace(',', '.'))), 'Cotización guardada.')}>Guardar</button></div><p className="venta-lista">{configuracion.cotizacion_usd ? `Actual: 1 US$ = ${money(configuracion.cotizacion_usd)} · actualizada el ${formatearFecha(configuracion.actualizada_en)}` : 'Todavía no está cargada.'}</p></div><div className="card profile-card config-card"><div className="section-title"><div><h2>Bajo stock</h2><p>Un sabor figura con “Bajo stock” cuando le quedan estas unidades o menos.</p></div></div><div className="config-cotizacion"><label className="field"><span>Unidades</span><input type="number" min="0" step="1" value={stockBajo} onChange={event => setStockBajo(event.target.value)} aria-label="Unidades de bajo stock" /></label><button className="quick-button" disabled={guardando || stockBajo.trim() === ''} onClick={() => guardar(() => guardarStockBajo(Number(stockBajo)), 'Bajo stock guardado.')}>Guardar</button></div><p className="venta-lista">Actual: {configuracion.stock_bajo} unidades o menos.</p></div></div></div></section></main>
}

function AjusteStockModal({ productos, onClose }: { productos: Producto[]; onClose: () => void }) {
  const [productoId, setProductoId] = useState('')
  const [motivo, setMotivo] = useState<'defectuoso' | 'conteo'>('defectuoso')
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const terminar = useCerrarAlTerminar(guardando, onClose)
  useBloquearScroll()
  const producto = productos.find(opcion => opcion.id === productoId)
  const sabores = producto?.sabores.filter(sabor => sabor.activo || sabor.stock !== 0) ?? []
  const cargados = sabores.filter(sabor => (cantidades[sabor.id] ?? '').trim() !== '')
  const validos = cargados.every(sabor => Number.isInteger(Number(cantidades[sabor.id])) && Number(cantidades[sabor.id]) >= 0)
  const cambios = cargados.filter(sabor => motivo === 'defectuoso' ? Number(cantidades[sabor.id]) > 0 : Number(cantidades[sabor.id]) !== sabor.stock).length
  const guardar = () => startTransition(async () => {
    const problema = await ajustarStock(productoId, motivo, cargados.map(sabor => ({ sabor_id: sabor.id, cantidad: Number(cantidades[sabor.id]) })))
    if (problema) setError(problema)
    else terminar()
  })
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="ajuste-title"><header><div><p className="eyebrow">STOCK</p><h2 id="ajuste-title">Defectuosos o conteo</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><div className="filter-pills" role="group" aria-label="Qué registrar">{([['defectuoso', 'Defectuosos'], ['conteo', 'Conteo de stock']] as const).map(([clave, etiqueta]) => <button key={clave} type="button" className={motivo === clave ? 'filter-pill selected' : 'filter-pill'} onClick={() => { setMotivo(clave); setCantidades({}) }}>{etiqueta}</button>)}</div><p className="venta-lista">{motivo === 'defectuoso' ? 'Unidades que vinieron falladas o se rompieron: se descuentan del stock y quedan como defectuosas.' : 'Contá lo que hay de cada sabor y cargalo: el stock se corrige a ese número y la diferencia queda como ajuste. Sirve para cargar el stock inicial.'}</p><label className="field"><span>Producto</span><select value={productoId} onChange={event => { setProductoId(event.target.value); setCantidades({}) }} aria-label="Producto"><option value="">Elegí el producto</option>{productos.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.marca} {opcion.nombre}</option>)}</select></label>{producto && <div className="field"><span>{motivo === 'defectuoso' ? 'Defectuosos por sabor' : 'Lo que contaste de cada sabor'}</span><div className="ingreso-sabores">{sabores.map(sabor => { const valor = cantidades[sabor.id] ?? ''; const diferencia = valor.trim() !== '' && motivo === 'conteo' ? Number(valor) - sabor.stock : null; return <label key={sabor.id} className="ingreso-sabor"><span>{sabor.nombre}<small>hay {numero(sabor.stock)}{diferencia ? ` · ${diferencia > 0 ? '+' : '−'}${Math.abs(diferencia)}` : ''}</small></span><input type="number" min="0" step="1" value={valor} onChange={event => setCantidades(actuales => ({ ...actuales, [sabor.id]: event.target.value }))} placeholder={motivo === 'conteo' ? String(Math.max(sabor.stock, 0)) : '0'} aria-label={`${motivo === 'defectuoso' ? 'Defectuosos' : 'Conteo'} de ${sabor.nombre}`} /></label> })}</div></div>}{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!producto || cambios === 0 || !validos || guardando} onClick={guardar}>{guardando ? 'Guardando…' : `Guardar${cambios ? ` (${cambios} ${cambios === 1 ? 'sabor' : 'sabores'})` : ''}`}</button></footer></section></div>
}
