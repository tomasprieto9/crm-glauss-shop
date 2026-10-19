'use client'

import { createContext, useContext, useMemo, useOptimistic, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Users, X, ArrowLeft, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cerrarSesion } from '@/app/login/actions'
import { actualizarCliente, crearCliente } from '@/app/clientes/actions'
import { CONSENTIMIENTOS, ESTADOS_CAMPANA, SEGMENTOS, ZONAS, formatearFecha, type CambiosCliente, type Cliente, type Consentimiento, type EstadoCampana } from '@/lib/clientes'

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
type Filtros = { texto: string; segmento: string; zona: string; consentimiento: string; pagina: number }
const FILTROS_INICIALES: Filtros = { texto: '', segmento: '', zona: '', consentimiento: '', pagina: 1 }

export default function CrmApp({ email, clientes }: { email: string; clientes: Cliente[] }) {
  return <UsuarioContext value={email}><ClientesContext value={clientes}><Vistas clientes={clientes} /></ClientesContext></UsuarioContext>
}

function Vistas({ clientes }: { clientes: Cliente[] }) {
  const [view, setView] = useState<Vista>('dashboard')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  // Los filtros viven acá para que no se pierdan al entrar y salir de una ficha.
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const seleccionado = clientes.find(cliente => cliente.id === seleccionadoId)
  const navegar = (vista: Vista) => { setSeleccionadoId(null); setView(vista) }

  if (seleccionado) return <FichaCliente key={seleccionado.id} cliente={seleccionado} onBack={() => setSeleccionadoId(null)} onNavigate={navegar} />
  if (view === 'dashboard') return <Dashboard onNavigate={navegar} />
  if (view === 'ventas') return <Sales onNavigate={navegar} />
  if (view === 'reactivacion') return <Reactivation clients={initialClients} onNavigate={navegar} />
  if (view === 'productos') return <Products onNavigate={navegar} />
  if (view === 'finanzas') return <Finance onNavigate={navegar} />
  if (view === 'reportes') return <Reports onNavigate={navegar} />
  return <Clientes clientes={clientes} filtros={filtros} onFiltros={setFiltros} onSelect={setSeleccionadoId} onNavigate={navegar} />
}

function Dashboard({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Resumen" breadcrumb="Dashboard" eyebrow="RESUMEN DEL NEGOCIO" title="Dashboard" subtitle="Una mirada rápida a lo que está pasando en tu tienda." mensaje="Todavía no hay ventas cargadas para armar el resumen." onNavigate={onNavigate} /> }

function SeccionVacia({ active, breadcrumb, eyebrow, title, subtitle, mensaje, onNavigate }: { active: string; breadcrumb: string; eyebrow: string; title: string; subtitle: string; mensaje: string; onNavigate: (view: Vista) => void }) { return <main className="app-shell"><Sidebar active={active} onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>{breadcrumb}</strong></div></header><div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-subtitle">{subtitle}</p></div></div><div className="card empty-state">{mensaje}</div></div></section></main> }

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <Card className="metric-card"><CardContent className="p-0"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-title">{label}</span><div className="metric-value">{value}</div></CardContent></Card> }

function Sidebar({ active, onNavigate }: { active: string; onNavigate?: (view: Vista) => void }) { const email = useContext(UsuarioContext); const totalClientes = useContext(ClientesContext).length; return <aside className="sidebar"><div className="brand"><span className="brand-mark">g</span><span>glauss</span><span className="brand-dot">.</span></div><nav className="nav-list"><span className="nav-label">MENU PRINCIPAL</span>{[['Resumen', '◈'], ['Ventas', '▣'], ['Clientes', '♙'], ['Reactivación', '↻'], ['Productos y stock', '□'], ['Finanzas', '$'], ['Reportes', '▤']].map(([label, icon]) => <button key={label} onClick={() => label === 'Resumen' ? onNavigate?.('dashboard') : label === 'Clientes' ? onNavigate?.('clientes') : label === 'Ventas' ? onNavigate?.('ventas') : label === 'Reactivación' ? onNavigate?.('reactivacion') : label === 'Productos y stock' ? onNavigate?.('productos') : label === 'Finanzas' ? onNavigate?.('finanzas') : label === 'Reportes' ? onNavigate?.('reportes') : undefined} className={`nav-item ${label === active ? 'active' : ''}`}><span className="nav-glyph">{icon}</span>{label}{label === 'Clientes' && <span className="nav-count">{numero(totalClientes)}</span>}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item">? <span>Central de ayuda</span></button><button className="nav-item">⚙ <span>Configuración</span></button><div className="profile"><div className="profile-avatar">{email.charAt(0).toUpperCase()}</div><div><strong title={email}>{email}</strong><form action={cerrarSesion}><button className="logout-button">Cerrar sesión</button></form></div></div></div></aside> }

function Products({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Productos y stock" breadcrumb="Productos y Stock" eyebrow="CATÁLOGO E INVENTARIO" title="Productos y Stock" subtitle="Controlá tu catálogo y mantené siempre disponible lo que más vendés." mensaje="Todavía no hay productos cargados." onNavigate={onNavigate} /> }

function Sales({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Ventas" breadcrumb="Ventas" eyebrow="HISTORIAL COMERCIAL" title="Ventas" subtitle="Consultá y gestioná todas las ventas de tu tienda." mensaje="Todavía no hay ventas cargadas." onNavigate={onNavigate} /> }

function Finance({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Finanzas" breadcrumb="Finanzas" eyebrow="CONTROL FINANCIERO" title="Finanzas" subtitle="Seguí tus ingresos, egresos y balance mes a mes." mensaje="Todavía no hay movimientos cargados." onNavigate={onNavigate} /> }

function Reports({ onNavigate }: { onNavigate: (view: Vista) => void }) { return <SeccionVacia active="Reportes" breadcrumb="Reportes" eyebrow="ANÁLISIS DEL NEGOCIO" title="Reportes" subtitle="Entendé qué se vende y cómo evoluciona tu tienda." mensaje="Todavía no hay ventas cargadas para armar reportes." onNavigate={onNavigate} /> }

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

function filtrarClientes(clientes: Cliente[], { texto, segmento, zona, consentimiento }: Filtros) {
  const buscado = normalizar(texto.trim())
  const digitos = texto.replace(/\D/g, '')
  return clientes.filter(cliente =>
    (!segmento || cliente.segmento === segmento) &&
    (!zona || cliente.zona === zona) &&
    (!consentimiento || cliente.consentimiento === consentimiento) &&
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
  const dijeronQueSi = clientes.filter(cliente => cliente.consentimiento === 'si').length
  const sinContactar = clientes.filter(cliente => cliente.estado_campana === 'pendiente').length
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Clientes</strong></div></header><div className="content-wrap clients-page"><div className="page-heading clients-heading"><div><p className="eyebrow">RELACIÓN CON CLIENTES</p><h1>Clientes</h1><p className="heading-subtitle">Conocé y gestioná a las personas que eligen tu tienda.</p></div><button className="quick-button" onClick={() => setMostrarNuevo(true)}><Plus /> Nuevo cliente</button></div><div className="metrics-grid clients-metrics"><Metric icon={<Users />} label="Total de clientes" value={numero(clientes.length)} tone="purple" /><Metric icon={<span className="metric-dot green" />} label="Dijeron que sí" value={numero(dijeronQueSi)} tone="mint" /><Metric icon={<span className="metric-dot orange" />} label="Sin contactar todavía" value={numero(sinContactar)} tone="peach" /></div><div className="clients-toolbar"><label className="search-control"><Search /><input value={filtros.texto} onChange={event => filtrar({ texto: event.target.value })} placeholder="Buscar por nombre o teléfono..." /></label><Filtro valor={filtros.segmento} etiquetas={SEGMENTOS} todos="Todos los segmentos" onChange={segmento => filtrar({ segmento })} /><Filtro valor={filtros.zona} etiquetas={ZONAS} todos="Todas las zonas" onChange={zona => filtrar({ zona })} /><Filtro valor={filtros.consentimiento} etiquetas={CONSENTIMIENTOS} todos="Todo consentimiento" onChange={consentimiento => filtrar({ consentimiento })} /><span className="result-count">{numero(filtrados.length)} clientes</span></div><div className="card clients-table-card"><div className="clients-table-head"><div><h2>Base de clientes</h2><p>Tocá un cliente para ver su ficha</p></div></div><div className="sales-table-wrap"><table className="clients-table"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Segmento</th><th>Zona</th><th>Consentimiento</th><th>Campaña</th><th>Último contacto</th></tr></thead><tbody>{visibles.map(cliente => <tr key={cliente.id} tabIndex={0} onClick={() => onSelect(cliente.id)} onKeyDown={event => event.key === 'Enter' && onSelect(cliente.id)}><td><div className="client-table"><span>{iniciales(cliente.nombre)}</span><strong>{cliente.nombre}</strong></div></td><td>{cliente.telefono}</td><td>{SEGMENTOS[cliente.segmento]}</td><td>{cliente.zona ? ZONAS[cliente.zona] : '—'}</td><td><span className={`status-pill consentimiento-${cliente.consentimiento}`}>{CONSENTIMIENTOS[cliente.consentimiento]}</span></td><td><span className={`status-pill campana-${cliente.estado_campana}`}>{ESTADOS_CAMPANA[cliente.estado_campana]}</span></td><td>{formatearFecha(cliente.fecha_ultimo_contacto)}</td></tr>)}</tbody></table>{visibles.length === 0 && <div className="empty-state">Ningún cliente coincide con la búsqueda.</div>}</div><div className="clients-footer"><span>{filtrados.length === 0 ? 'Sin resultados' : `Mostrando ${numero(desde)}–${numero(desde + visibles.length - 1)} de ${numero(filtrados.length)}`}</span><div><button className="pagination-button" disabled={pagina === 1} onClick={() => irAPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft /></button><span className="pagination-current" aria-label={`Página ${pagina} de ${paginas}`}>{pagina}</span><button className="pagination-button" disabled={pagina === paginas} onClick={() => irAPagina(pagina + 1)} aria-label="Página siguiente"><ChevronRight /></button></div></div></div></div></section>{mostrarNuevo && <NuevoCliente onClose={() => setMostrarNuevo(false)} />}</main>
}

function Filtro({ valor, etiquetas, todos, onChange }: { valor: string; etiquetas: Record<string, string>; todos: string; onChange: (valor: string) => void }) { return <label className="filter-control"><select value={valor} onChange={event => onChange(event.target.value)} aria-label={todos}><option value="">{todos}</option>{opciones(etiquetas)}</select><ChevronDown /></label> }

function FichaCliente({ cliente, onBack, onNavigate }: { cliente: Cliente; onBack: () => void; onNavigate: (view: Vista) => void }) {
  // Los controles muestran el cambio al instante; si el guardado falla, vuelven al valor de la base.
  const [actual, aplicarCambios] = useOptimistic(cliente, (anterior: Cliente, cambios: CambiosCliente) => ({ ...anterior, ...cambios }))
  const [notas, setNotas] = useState(cliente.notas ?? '')
  const [guardando, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardar = (cambios: CambiosCliente, mensaje: string) => startTransition(async () => {
    aplicarCambios(cambios)
    const error = await actualizarCliente(cliente.id, cambios)
    setResultado(error ? { ok: false, texto: error } : { ok: true, texto: mensaje })
  })
  return <main className="app-shell"><Sidebar active="Clientes" onNavigate={onNavigate} /><section className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>Ficha de cliente</strong></div></header><div className="content-wrap client-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft /> Volver a clientes</button><div className="detail-heading"><div><p className="eyebrow">FICHA DE CLIENTE</p><h1>{cliente.nombre}</h1><p className="heading-subtitle">{SEGMENTOS[cliente.segmento]}{cliente.zona && ` · ${ZONAS[cliente.zona]}`}</p></div>{guardando ? <span className="ficha-estado">Guardando…</span> : resultado && <span className={`ficha-estado ${resultado.ok ? 'ok' : 'error'}`} role="status">{resultado.texto}</span>}</div><div className="detail-columns"><div className="card profile-card"><div className="section-title"><div><h2>Datos</h2><p>Cómo está cargado en la base</p></div></div><dl className="ficha-datos"><dt>Teléfono</dt><dd>{cliente.telefono}</dd><dt>Agendado como</dt><dd>{cliente.nombre_original ?? '—'}</dd><dt>Segmento</dt><dd>{SEGMENTOS[cliente.segmento]}</dd><dt>Zona</dt><dd>{cliente.zona ? ZONAS[cliente.zona] : '—'}</dd><dt>Último contacto</dt><dd>{formatearFecha(cliente.fecha_ultimo_contacto)}</dd><dt>Última compra</dt><dd>{formatearFecha(cliente.fecha_ultima_compra)}</dd><dt>Cargado el</dt><dd>{formatearFecha(cliente.created_at)}</dd></dl></div><div className="ficha-columna"><div className="card profile-card"><div className="section-title"><div><h2>Campaña de WhatsApp</h2><p>Los cambios se guardan apenas los elegís.</p></div></div><div className="ficha-controles"><label className="field"><span>Consentimiento</span><select value={actual.consentimiento} disabled={guardando} onChange={event => guardar({ consentimiento: event.target.value as Consentimiento }, 'Consentimiento guardado.')}>{opciones(CONSENTIMIENTOS)}</select></label><label className="field"><span>Estado de campaña</span><select value={actual.estado_campana} disabled={guardando} onChange={event => guardar({ estado_campana: event.target.value as EstadoCampana }, 'Estado de campaña guardado.')}>{opciones(ESTADOS_CAMPANA)}</select></label><label className="ficha-check"><input type="checkbox" checked={actual.edad_verificada} disabled={guardando} onChange={event => guardar({ edad_verificada: event.target.checked }, 'Edad verificada guardada.')} />Edad verificada (mayor de 18, con DNI)</label></div></div><div className="card notes-card"><div className="section-title"><div><h2>Notas</h2><p>Información útil sobre este cliente</p></div></div><label className="field ficha-notas"><textarea value={notas} onChange={event => setNotas(event.target.value)} rows={4} placeholder="Ej. prefiere pods de menta" aria-label="Notas" /></label><button className="quick-button" disabled={guardando || notas.trim() === (cliente.notas ?? '')} onClick={() => guardar({ notas }, 'Notas guardadas.')}>Guardar notas</button></div></div></div></div></section></main>
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
