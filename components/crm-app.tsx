'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Plus, Search, Users, X, ArrowLeft, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cerrarSesion } from '@/app/login/actions'
import { actualizarCliente, crearCliente } from '@/app/clientes/actions'
import { registrarVenta } from '@/app/ventas/actions'
import { ESTADOS_CAMPANA, SEGMENTOS, ZONAS, formatearFecha, type Cliente } from '@/lib/clientes'
import { METODOS_PAGO, hoyEnArgentina, type MetodoPago, type Venta } from '@/lib/ventas'

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

export default function CrmApp({ email, clientes, ventas }: { email: string; clientes: Cliente[]; ventas: Venta[] }) {
  return <UsuarioContext value={email}><ClientesContext value={clientes}><Vistas clientes={clientes} ventas={ventas} /></ClientesContext></UsuarioContext>
}

function Vistas({ clientes, ventas }: { clientes: Cliente[]; ventas: Venta[] }) {
  const [view, setView] = useState<Vista>('dashboard')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  // Los filtros viven acá para que no se pierdan al entrar y salir de una ficha.
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const seleccionado = clientes.find(cliente => cliente.id === seleccionadoId)
  const navegar = (vista: Vista) => { setSeleccionadoId(null); setView(vista) }
  // Cada pantalla nueva arranca desde arriba (si no, la ficha se abría scrolleada).
  useEffect(() => { window.scrollTo(0, 0) }, [view, seleccionadoId])

  if (seleccionado) return <FichaCliente key={seleccionado.id} cliente={seleccionado} onBack={() => setSeleccionadoId(null)} onNavigate={navegar} />
  if (view === 'dashboard') return <Dashboard onNavigate={navegar} />
  if (view === 'ventas') return <Sales ventas={ventas} clientes={clientes} onNavigate={navegar} />
  if (view === 'reactivacion') return <Reactivation clients={initialClients} onNavigate={navegar} />
  if (view === 'productos') return <Products onNavigate={navegar} />
  if (view === 'finanzas') return <Finance onNavigate={navegar} />
  if (view === 'reportes') return <Reports onNavigate={navegar} />
  return <Clientes clientes={clientes} filtros={filtros} onFiltros={setFiltros} onSelect={setSeleccionadoId} onNavigate={navegar} />
}

function Dashboard({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Resumen" breadcrumb="Dashboard" eyebrow="RESUMEN DEL NEGOCIO" title="Dashboard" subtitle="Una mirada rápida a lo que está pasando en tu tienda." mensaje="El resumen con los números del negocio se arma en la próxima etapa." onNavigate={onNavigate} /> }

function SeccionVacia({ active, breadcrumb, eyebrow, title, subtitle, mensaje, onNavigate }: { active: string; breadcrumb: string; eyebrow: string; title: string; subtitle: string; mensaje: string; onNavigate: (view: Vista) => void }) { return <main className="app-shell"><Sidebar active={active} onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>{breadcrumb}</strong></div></header><div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-subtitle">{subtitle}</p></div></div><div className="card empty-state">{mensaje}</div></div></section></main> }

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <Card className="metric-card"><CardContent className="p-0"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-title">{label}</span><div className="metric-value">{value}</div></CardContent></Card> }

function Sidebar({ active, onNavigate }: { active: string; onNavigate?: (view: Vista) => void }) { const email = useContext(UsuarioContext); const totalClientes = useContext(ClientesContext).length; const [abierto, setAbierto] = useState(false); const ir = (vista: Vista) => { setAbierto(false); onNavigate?.(vista) }; const marca = <div className="brand"><span className="brand-mark">g</span><span>glauss</span><span className="brand-dot">.</span></div>; return <><div className="mobile-bar"><button className="menu-button" aria-label="Abrir menú" onClick={() => setAbierto(true)}><Menu /></button>{marca}</div>{abierto && <div className="sidebar-fondo" onClick={() => setAbierto(false)} />}<aside className={`sidebar ${abierto ? 'abierto' : ''}`}><div className="sidebar-top">{marca}<button className="menu-cerrar" aria-label="Cerrar menú" onClick={() => setAbierto(false)}><X /></button></div><nav className="nav-list"><span className="nav-label">MENU PRINCIPAL</span>{[['Resumen', '◈'], ['Ventas', '▣'], ['Clientes', '♙'], ['Reactivación', '↻'], ['Productos y stock', '□'], ['Finanzas', '$'], ['Reportes', '▤']].map(([label, icon]) => <button key={label} onClick={() => label === 'Resumen' ? ir('dashboard') : label === 'Clientes' ? ir('clientes') : label === 'Ventas' ? ir('ventas') : label === 'Reactivación' ? ir('reactivacion') : label === 'Productos y stock' ? ir('productos') : label === 'Finanzas' ? ir('finanzas') : label === 'Reportes' ? ir('reportes') : undefined} className={`nav-item ${label === active ? 'active' : ''}`}><span className="nav-glyph">{icon}</span>{label}{label === 'Clientes' && <span className="nav-count">{numero(totalClientes)}</span>}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item">? <span>Central de ayuda</span></button><button className="nav-item">⚙ <span>Configuración</span></button><div className="profile"><div className="profile-avatar">{email.charAt(0).toUpperCase()}</div><div><strong title={email}>{email}</strong><form action={cerrarSesion}><button className="logout-button">Cerrar sesión</button></form></div></div></div></aside></> }

function Products({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Productos y stock" breadcrumb="Productos y Stock" eyebrow="CATÁLOGO E INVENTARIO" title="Productos y Stock" subtitle="Controlá tu catálogo y mantené siempre disponible lo que más vendés." mensaje="Todavía no hay productos cargados." onNavigate={onNavigate} /> }

function Sales({ ventas, clientes, onNavigate }: { ventas: Venta[]; clientes: Cliente[]; onNavigate: (view: Vista) => void }) {
  const [mostrarNueva, setMostrarNueva] = useState(false)
  return <main className="app-shell"><Sidebar active="Ventas" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ventas</strong></div></header><div className="content-wrap sales-page"><div className="page-heading"><div><p className="eyebrow">HISTORIAL COMERCIAL</p><h1>Ventas</h1><p className="heading-subtitle">Registrá y consultá las ventas de tu tienda.</p></div><button className="quick-button" onClick={() => setMostrarNueva(true)}><Plus /> Nueva venta</button></div>{ventas.length === 0 ? <div className="card empty-state">Todavía no hay ventas cargadas.</div> : <div className="card clients-table-card"><div className="sales-table-top"><div><h2>Historial de ventas</h2><p>{numero(ventas.length)} {ventas.length === 1 ? 'venta registrada' : 'ventas registradas'}</p></div></div><div className="sales-table-wrap"><table className="clients-table sales-table"><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead><tbody>{ventas.map(venta => <tr key={venta.id}><td><strong>#{venta.numero}</strong></td><td>{formatearFecha(venta.fecha)}</td><td><strong>{venta.clientes?.nombre ?? '—'}</strong></td><td>{resumenProductos(venta)}</td><td><span className={`payment-pill ${venta.metodo_pago}`}>{METODOS_PAGO[venta.metodo_pago]}</span></td><td><strong>{money(venta.total)}</strong></td></tr>)}</tbody></table></div></div>}</div></section>{mostrarNueva && <NuevaVentaModal clientes={clientes} onClose={() => setMostrarNueva(false)} />}</main>
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

function NuevoCliente({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const problema = await crearCliente(formData)
      if (problema) setError(problema)
      else onClose()
    })
  }
  return <div className="modal-backdrop"><section className="sale-modal new-client-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title"><header><div><p className="eyebrow">NUEVO REGISTRO</p><h2 id="new-client-title">Nuevo cliente</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><form onSubmit={enviar}><div className="modal-body"><label className="field"><span>Nombre</span><input name="nombre" required placeholder="Ej. Martina González" /></label><label className="field"><span>Teléfono</span><input name="telefono" required inputMode="tel" placeholder="Ej. 221 438 3399" /></label><div className="modal-fields"><label className="field"><span>Segmento</span><select name="segmento" defaultValue="cliente">{opciones(SEGMENTOS)}</select></label><label className="field"><span>Zona</span><select name="zona" defaultValue="la_plata">{opciones(ZONAS)}</select></label></div><label className="field"><span>Notas <em>(opcional)</em></span><textarea name="notas" rows={3} placeholder="Ej. prefiere pods de menta" /></label><label className="ficha-check"><input type="checkbox" name="mayor_de_18" value="si" required />Es mayor de 18 años</label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cliente'}</button></footer></form></section></div>
}

function resumenProductos(venta: Venta) {
  const [primero, ...resto] = venta.venta_items
  if (!primero) return '—'
  return `${primero.cantidad > 1 ? `${primero.cantidad} × ` : ''}${primero.descripcion}${resto.length ? ` + ${resto.length} más` : ''}`
}

type LineaVenta = { clave: number; descripcion: string; cantidad: string; precio: string }
const lineaVacia = (clave: number): LineaVenta => ({ clave, descripcion: '', cantidad: '1', precio: '' })
const subtotalLinea = (linea: LineaVenta) => (Number(linea.cantidad) || 0) * (Number(linea.precio) || 0)

function NuevaVentaModal({ clientes, onClose }: { clientes: Cliente[]; onClose: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNuevo, setClienteNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [lineas, setLineas] = useState([lineaVacia(1)])
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [fecha, setFecha] = useState(hoyEnArgentina)
  const [dniVerificado, setDniVerificado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()
  const sugeridos = useMemo(() => busqueda.trim() ? filtrarClientes(clientes, { ...FILTROS_INICIALES, texto: busqueda }).slice(0, 5) : [], [clientes, busqueda])
  const total = lineas.reduce((suma, linea) => suma + subtotalLinea(linea), 0)
  const cambiarLinea = (clave: number, cambios: Partial<LineaVenta>) => setLineas(actuales => actuales.map(linea => linea.clave === clave ? { ...linea, ...cambios } : linea))
  const hayCliente = cliente !== null || (clienteNuevo && nuevoNombre.trim() !== '' && nuevoTelefono.trim() !== '')
  const lineasCompletas = lineas.every(linea => linea.descripcion.trim() !== '' && Number(linea.cantidad) >= 1 && linea.precio !== '')
  const elegirClienteNuevo = () => { setClienteNuevo(true); if (!/\d/.test(busqueda)) setNuevoNombre(busqueda.trim()); else setNuevoTelefono(busqueda.trim()) }
  const guardar = () => startTransition(async () => {
    const problema = await registrarVenta({ clienteId: cliente?.id ?? null, nuevoNombre, nuevoTelefono, fecha, metodoPago, dniVerificado, items: lineas.map(linea => ({ descripcion: linea.descripcion, cantidad: Number(linea.cantidad), precio_unitario: Number(linea.precio) })) })
    if (problema) setError(problema)
    else onClose()
  })
  const campoCliente = cliente
    ? <div className="venta-cliente"><div><strong>{cliente.nombre}</strong><small>{cliente.telefono}</small></div><button type="button" className="text-button" onClick={() => setCliente(null)}>Cambiar</button></div>
    : clienteNuevo
      ? <><div className="modal-fields"><input value={nuevoNombre} onChange={event => setNuevoNombre(event.target.value)} placeholder="Nombre" aria-label="Nombre del cliente nuevo" /><input value={nuevoTelefono} onChange={event => setNuevoTelefono(event.target.value)} inputMode="tel" placeholder="Teléfono (ej. 221 438 3399)" aria-label="Teléfono del cliente nuevo" /></div><button type="button" className="text-button" onClick={() => setClienteNuevo(false)}>Buscar un cliente existente</button></>
      : <><input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar cliente por nombre o teléfono..." aria-label="Buscar cliente" />{busqueda.trim() && <div className="autocomplete-list">{sugeridos.map(sugerido => <button type="button" key={sugerido.id} onClick={() => { setCliente(sugerido); setBusqueda('') }}>{sugerido.nombre}<small>{sugerido.telefono}</small></button>)}<button type="button" className="create-client-option" onClick={elegirClienteNuevo}>+ Cliente nuevo</button></div>}</>
  return <div className="modal-backdrop"><section className="sale-modal new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="new-sale-title"><header><div><p className="eyebrow">REGISTRAR OPERACIÓN</p><h2 id="new-sale-title">Nueva venta</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="modal-body"><div className="field"><span>Cliente</span>{campoCliente}</div><div className="field"><span>Productos</span><div className="venta-lineas">{lineas.map(linea => <div className="venta-linea" key={linea.clave}><input className="venta-descripcion" value={linea.descripcion} onChange={event => cambiarLinea(linea.clave, { descripcion: event.target.value })} placeholder="Qué se vendió (ej. Elfbar BC5000 menta)" aria-label="Producto" /><input type="number" min="1" step="1" value={linea.cantidad} onChange={event => cambiarLinea(linea.clave, { cantidad: event.target.value })} aria-label="Cantidad" /><input type="number" min="0" step="1" value={linea.precio} onChange={event => cambiarLinea(linea.clave, { precio: event.target.value })} placeholder="Precio c/u" aria-label="Precio por unidad" /><strong>{money(subtotalLinea(linea))}</strong><button type="button" className="close-button" disabled={lineas.length === 1} onClick={() => setLineas(actuales => actuales.filter(otra => otra.clave !== linea.clave))} aria-label="Quitar producto"><X /></button></div>)}</div><button type="button" className="text-button" onClick={() => setLineas(actuales => [...actuales, lineaVacia((actuales.at(-1)?.clave ?? 0) + 1)])}><Plus /> Agregar otro producto</button></div><div className="modal-fields"><label className="field"><span>Método de pago</span><select value={metodoPago} onChange={event => setMetodoPago(event.target.value as MetodoPago)}>{opciones(METODOS_PAGO)}</select></label><label className="field"><span>Fecha</span><input type="date" value={fecha} max={hoyEnArgentina()} onChange={event => setFecha(event.target.value)} /></label></div><div className="sale-total"><span>Total</span><strong>{money(total)}</strong></div><label className="ficha-check"><input type="checkbox" checked={dniVerificado} onChange={event => setDniVerificado(event.target.checked)} />Verifiqué el DNI (mayor de 18)</label>{error && <p className="login-error" role="alert">{error}</p>}</div><footer><button className="cancel-button" onClick={onClose}>Cancelar</button><button className="quick-button" disabled={!hayCliente || !lineasCompletas || !dniVerificado || guardando} onClick={guardar}>{guardando ? 'Registrando…' : 'Registrar venta'}</button></footer></section></div>
}
