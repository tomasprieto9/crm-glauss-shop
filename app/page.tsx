'use client'

import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react'

const navItems = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Clientes', icon: Users },
  { label: 'Vendas', icon: ShoppingBag },
  { label: 'Produtos', icon: Package },
  { label: 'Financeiro', icon: WalletCards },
  { label: 'Relatórios', icon: FileText },
]

const sales = [42, 58, 51, 67, 62, 76, 72, 84, 77, 92, 87, 96]
const customers = [
  { name: 'Marina Costa', initials: 'MC', tone: 'lavender', order: 'Pedido #1048', value: 'R$ 289,90', status: 'Concluído' },
  { name: 'Rafael Mendes', initials: 'RM', tone: 'peach', order: 'Pedido #1047', value: 'R$ 149,00', status: 'Enviado' },
  { name: 'Bianca Nunes', initials: 'BN', tone: 'mint', order: 'Pedido #1046', value: 'R$ 412,50', status: 'Concluído' },
  { name: 'Lucas Almeida', initials: 'LA', tone: 'blue', order: 'Pedido #1045', value: 'R$ 89,90', status: 'Processando' },
]

export default function Page() {
  const [active, setActive] = useState('Visão geral')
  const [period, setPeriod] = useState('Últimos 30 dias')
  const [searchOpen, setSearchOpen] = useState(false)
  const [showNotification, setShowNotification] = useState(false)

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">g</span><span>glauss</span><span className="brand-dot">.</span></div>
        <div className="workspace"><div className="workspace-avatar">GS</div><div><strong>Glauss Shop</strong><span>Minha loja</span></div><ChevronDown size={15} /></div>
        <nav className="nav-list" aria-label="Navegação principal">
          <span className="nav-label">MENU PRINCIPAL</span>
          {navItems.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => setActive(item.label)} className={`nav-item ${active === item.label ? 'active' : ''}`}><Icon size={18} /><span>{item.label}</span>{item.label === 'Clientes' && <span className="nav-count">12</span>}</button> })}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Desbloqueie todo o potencial</strong><p>Tenha relatórios avançados e muito mais.</p><button>Conhecer plano Pro <ArrowUpRight size={13} /></button></div>
          <button className="nav-item"><CircleHelp size={18} /><span>Central de ajuda</span></button>
          <button className="nav-item"><Settings size={18} /><span>Configurações</span></button>
          <div className="profile"><div className="profile-avatar">JS</div><div><strong>João Silva</strong><span>Administrador</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Glauss Shop</span><span>/</span><strong>{active}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Pesquisar" onClick={() => setSearchOpen(!searchOpen)}><Search size={19} /></button><button className="icon-button notification-button" aria-label="Notificações" onClick={() => setShowNotification(!showNotification)}><Bell size={19} /><i /></button><button className="quick-button"><Plus size={17} /> Nova venda</button></div>{searchOpen && <div className="search-popover"><Search size={16} /><input autoFocus placeholder="Buscar clientes, pedidos..." /></div>}{showNotification && <div className="notification-popover"><strong>Notificações</strong><p>Você tem 3 novos pedidos para revisar.</p><button>Ver pedidos</button></div>}</header>
        <div className="content-wrap">
          <div className="page-heading"><div><p className="eyebrow">TERÇA-FEIRA, 14 DE MAIO DE 2024</p><h1>Bom dia, João <span>✦</span></h1><p className="heading-subtitle">Aqui está o que está acontecendo na sua loja hoje.</p></div><button className="date-button"><CalendarDays size={16} /> {period} <ChevronDown size={15} /></button></div>
          <div className="metrics-grid">
            <MetricCard title="Vendas totais" value="R$ 24.680,00" change="18,4%" up icon={<TrendingUp size={18} />} accent="purple" />
            <MetricCard title="Pedidos" value="284" change="12,8%" up icon={<ShoppingBag size={18} />} accent="blue" />
            <MetricCard title="Ticket médio" value="R$ 86,90" change="3,2%" up icon={<Tag size={18} />} accent="peach" />
            <MetricCard title="Clientes ativos" value="1.248" change="5,7%" up icon={<Users size={18} />} accent="mint" />
          </div>
          <div className="dashboard-grid">
            <section className="card sales-card"><div className="card-head"><div><h2>Visão de vendas</h2><p>Acompanhe o crescimento da sua loja</p></div><div className="legend"><span><i className="legend-dot purple-dot" />Vendas</span><button onClick={() => setPeriod(period === 'Últimos 30 dias' ? 'Últimos 7 dias' : 'Últimos 30 dias')}>{period}<ChevronDown size={14} /></button></div></div><div className="chart-summary"><strong>R$ 24.680,00</strong><span className="positive"><ArrowUpRight size={14} /> 18,4%</span><small>vs. período anterior</small></div><div className="chart"><div className="y-axis"><span>R$ 3k</span><span>R$ 2k</span><span>R$ 1k</span><span>R$ 0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 620 190" preserveAspectRatio="none" aria-label="Gráfico de vendas"><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7567e8" stopOpacity=".22" /><stop offset="1" stopColor="#7567e8" stopOpacity="0" /></linearGradient></defs><path d="M0 157 C30 145, 36 150, 58 130 S94 143, 114 114 S148 127, 170 100 S202 119, 224 86 S257 110, 280 83 S314 99, 336 65 S369 81, 393 54 S427 74, 451 47 S481 61, 505 32 S542 50, 566 22 S598 33, 620 8 L620 190 L0 190 Z" fill="url(#salesFill)" /><path d="M0 157 C30 145, 36 150, 58 130 S94 143, 114 114 S148 127, 170 100 S202 119, 224 86 S257 110, 280 83 S314 99, 336 65 S369 81, 393 54 S427 74, 451 47 S481 61, 505 32 S542 50, 566 22 S598 33, 620 8" fill="none" stroke="#7567e8" strokeWidth="3" strokeLinecap="round" /></svg><div className="x-axis"><span>15 abr</span><span>20 abr</span><span>25 abr</span><span>30 abr</span><span>05 mai</span><span>10 mai</span><span>14 mai</span></div></div></div></section>
            <section className="card reactivation-card"><div className="card-head"><div><h2>Reative seus clientes</h2><p>Oportunidades para hoje</p></div><Zap size={18} className="zap-icon" /></div><div className="reactivation-number">86</div><p className="reactivation-copy">clientes não compram há mais de 60 dias.</p><div className="progress-bar"><span /></div><div className="reactivation-foot"><span>Potencial estimado</span><strong>R$ 8.420,00</strong></div><button className="outline-button" onClick={() => alert('Campanha criada!')}>Criar campanha <ArrowUpRight size={15} /></button></section>
          </div>
          <div className="bottom-grid"><section className="card orders-card"><div className="card-head"><div><h2>Pedidos recentes</h2><p>Veja as últimas movimentações</p></div><button className="text-button" onClick={() => setActive('Vendas')}>Ver todos <ArrowUpRight size={14} /></button></div><div className="orders-table"><div className="table-row table-heading"><span>CLIENTE</span><span>PEDIDO</span><span>VALOR</span><span>STATUS</span></div>{customers.map((customer) => <div className="table-row" key={customer.name}><div className="customer-cell"><span className={`customer-avatar ${customer.tone}`}>{customer.initials}</span><strong>{customer.name}</strong></div><span className="muted">{customer.order}</span><strong>{customer.value}</strong><span className={`status ${customer.status.toLowerCase()}`}>{customer.status}</span></div>)}</div></section><section className="card quick-actions"><div className="card-head"><div><h2>Ações rápidas</h2><p>Atalhos para o dia a dia</p></div></div><div className="action-list"><button onClick={() => setActive('Clientes')}><span className="action-icon lavender-bg"><Users size={17} /></span><span><strong>Adicionar cliente</strong><small>Cadastre um novo contato</small></span><ArrowUpRight size={15} /></button><button onClick={() => setActive('Produtos')}><span className="action-icon peach-bg"><Package size={17} /></span><span><strong>Cadastrar produto</strong><small>Adicione itens ao catálogo</small></span><ArrowUpRight size={15} /></button><button onClick={() => setActive('Relatórios')}><span className="action-icon mint-bg"><FileText size={17} /></span><span><strong>Gerar relatório</strong><small>Exporte seus resultados</small></span><ArrowUpRight size={15} /></button></div></section></div>
          <footer>glauss <span>feito para pequenos negócios</span><span className="footer-right">Ajuda · Termos · Privacidade</span></footer>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ title, value, change, up, icon, accent }: { title: string; value: string; change: string; up: boolean; icon: React.ReactNode; accent: string }) {
  return <div className="metric-card"><div className={`metric-icon ${accent}`}>{icon}</div><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className={`metric-change ${up ? 'positive' : 'negative'}`}>{up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}<span>vs. período anterior</span></div></div>
}
