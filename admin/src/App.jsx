import React, { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Pizza, MapPin, Store, Lock, Clock, Timer, Check, X, Truck, CheckCircle, Bike, Search, Plus, Pencil, DollarSign, List, Sun, Moon, LogOut, Settings, ChevronRight, ChevronLeft, Wifi, WifiOff, AlertCircle, CreditCard, FileText, Package, Phone, Hash, AlertTriangle } from 'lucide-react'

window.__googleCallback = (response) => {
  const s = window.__adminAuthSetters
  if (!s) return
  if (response.error) { if (s.setErro) s.setErro('Erro ao autenticar com Google'); return }
  ;(async () => {
    try {
      const r = await fetch(`${API}/auth/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: response.access_token })
      })
      const data = await r.json()
      if (data.token && data.user) {
        if (VALID_ROLES.includes(data.user.role)) {
          s.onLogin(data.user, data.token)
        } else {
          s.setErro('Sua conta não tem permissão de acesso administrativo.')
        }
      } else s.setErro(data.erro || 'Erro ao autenticar')
    } catch { s.setErro('Erro de conexão') }
  })()
}

const API = '/api'
const GOOGLE_CLIENT_ID = '433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com'

const VALID_ROLES = ['admin', 'atendente', 'financeiro']

const pedidoSteps = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'aceito', label: 'Preparo' },
  { key: 'liberado', label: 'Pronto' },
  { key: 'em_rota', label: 'Saiu' },
  { key: 'entregador_proximo', label: 'Chegou!' },
  { key: 'entregue', label: 'Entregue' },
]

const allNavItems = [
  { key: 'pedidos', label: 'Pedidos', icon: List, roles: ['admin', 'atendente'], section: 'Geral' },
  { key: 'cardapio', label: 'Cardápio', icon: Pizza, roles: ['admin'], section: 'Geral' },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, roles: ['admin', 'financeiro'], section: 'Admin' },
  { key: 'rastreio', label: 'Rastreio', icon: MapPin, roles: ['admin'], section: 'Admin' },
  { key: 'pizzaria', label: 'Pizzaria', icon: Store, roles: ['admin'], section: 'Admin' },
  { key: 'permissoes', label: 'Permissões', icon: Lock, roles: ['admin'], section: 'Admin' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings, roles: ['admin'], section: 'Admin' },
]

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [autenticado, setAutenticado] = useState(false)
  const [aba, setAba] = useState(() => localStorage.getItem('adminAba') || 'pedidos')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('adminDark') === 'true')

  useEffect(() => { localStorage.setItem('adminAba', aba) }, [aba])

  useEffect(() => {
    if (token && user && VALID_ROLES.includes(user.role)) {
      setAutenticado(true)
    }
  }, [token, user])

  const handleLogin = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', userToken)
    if (VALID_ROLES.includes(userData.role)) {
      setAutenticado(true)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setToken('')
    setAutenticado(false)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    localStorage.removeItem('adminAba')
  }

  /* --- som global de pedidos pendentes (qualquer tela) --- */
  const audioCtxRef = useRef(null)
  const loopTimerRef = useRef(null)
  const loopAtivoRef = useRef(false)

  /* Cria AudioContext e tenta destravar (pode precisar de clique do usuário) */
  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    return audioCtxRef.current
  }

  function tocarLoopPendente() {
    loopAtivoRef.current = true
    const ctx = getAudioCtx()
    const tocar = () => {
      if (!loopAtivoRef.current || ctx.state === 'closed') return
      const t = ctx.currentTime
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 520 + i * 130
        gain.gain.setValueAtTime(0.25, t + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.25)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.25)
      }
      if (loopAtivoRef.current) loopTimerRef.current = setTimeout(tocar, 3000)
    }
    tocar()
  }

  function pararLoopPendente() {
    loopAtivoRef.current = false
    if (loopTimerRef.current) { clearTimeout(loopTimerRef.current); loopTimerRef.current = null }
  }

  useEffect(() => {
    let mounted = true
    const buscar = () => {
      fetch(`${API}/orders`).then(r => r.json()).then(data => {
        if (!mounted || !Array.isArray(data)) return
        const temPendente = data.some(p => p.status === 'pendente')
        if (temPendente && !loopAtivoRef.current) tocarLoopPendente()
        if (!temPendente && loopAtivoRef.current) pararLoopPendente()
      }).catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 5000)
    return () => { mounted = false; clearInterval(id); pararLoopPendente() }
  }, [])

  if (!autenticado) {
    return <AdminLogin onLogin={handleLogin} user={user} token={token} />
  }

  const role = user?.role || 'admin'
  const navItems = allNavItems.filter(item => item.roles.includes(role))
  const sections = [...new Set(navItems.map(n => n.section))]

  return (
    <div className={`admin-app${darkMode ? ' dark' : ''}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <Pizza size={22} />
          <span>Israelita</span>
        </div>
        <nav className="sidebar-nav">
          {sections.map(section => (
            <React.Fragment key={section}>
              <div className="sidebar-nav-section">{section}</div>
              {navItems.filter(n => n.section === section).map(item => {
                const Icon = item.icon
                return (
                  <button key={item.key} className={`sidebar-nav-item ${aba === item.key ? 'active' : ''}`} onClick={() => setAba(item.key)}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.nome}</span>
            <span className="sidebar-user-role">{role === 'admin' ? 'Administrador' : role === 'atendente' ? 'Atendente' : 'Financeiro'}</span>
          </div>
          <div className="sidebar-footer-actions">
            <button className="topbar-btn" onClick={() => { setDarkMode(!darkMode); localStorage.setItem('adminDark', !darkMode) }} title={darkMode ? 'Modo claro' : 'Modo escuro'}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="topbar-btn" onClick={handleLogout} title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <main className="admin-content" style={{ animation: 'fadeUp 0.35s ease' }}>
          {aba === 'cardapio' && role === 'admin' && <AdminMenu />}
          {aba === 'pedidos' && (role === 'admin' || role === 'atendente') && <AdminOrders />}
          {aba === 'financeiro' && (role === 'admin' || role === 'financeiro') && <AdminFinanceiro />}
          {aba === 'rastreio' && role === 'admin' && <RastreioPage />}
          {aba === 'pizzaria' && role === 'admin' && <AdminPizzariaConfig />}
          {aba === 'permissoes' && role === 'admin' && <AdminPermissoes user={user} token={token} />}
          {aba === 'configuracoes' && role === 'admin' && <AdminConfiguracoes />}
        </main>
      </div>
    </div>
  )
}

function AdminLogin({ onLogin, user, token }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  window.__adminAuthSetters = { onLogin, setErro }

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: window.__googleCallback
      })
      client.requestAccessToken()
    } catch { setErro('Erro ao iniciar login Google') }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha })
      })
      const data = await res.json()
      if (data.autenticado) {
        if (data.user && VALID_ROLES.includes(data.user.role)) {
          onLogin(data.user, data.token || token || 'token-admin')
        } else {
          onLogin({ nome: 'Admin', role: 'admin' }, data.token || token || 'token-admin')
        }
      } else {
        setErro('Senha incorreta')
      }
    } catch { setErro('Erro de conexão') }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo"><Pizza size={48} /></div>
        <h2>Admin Israelita Pizzas</h2>
        <p className="login-desc">Faça login para acessar o painel administrativo</p>
        <form onSubmit={handleLogin}>
          <input type="password" placeholder="Senha de administrador" value={senha} onChange={e => { setSenha(e.target.value); setErro('') }} autoFocus />
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar com senha'}
          </button>
        </form>
        <div className="login-divider"><span>ou</span></div>
        <button className="google-btn" onClick={handleGoogleLogin} disabled={!window.google?.accounts?.oauth2}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span>Entrar com Google</span>
        </button>
      </div>
    </div>
  )
}

function AdminMenu() {
  const [menu, setMenu] = useState([])
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const carregar = () => fetch(`${API}/menu`).then(r => r.json()).then(setMenu)
  useEffect(() => { carregar() }, [])

  const deletar = async (id) => {
    if (!confirm('Deletar este item?')) return
    await fetch(`${API}/menu/${id}`, { method: 'DELETE' })
    carregar()
  }

  const tipoClass = (t) => t === 'sabor' ? 'badge badge-success' : t === 'tamanho' ? 'badge badge-info' : 'badge'
  const qualClass = (c) => c === 'tradicional' ? 'badge badge-info' : c === 'especial' ? 'badge badge-liberate' : c === 'nobre' ? 'badge badge-warning' : ''

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Cardápio</h1>
          <p className="page-description">Gerencie os itens do cardápio</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setEditando(null); setMostrarForm(true) }}><Plus size={18} /> Novo Item</button>
        </div>
      </div>
      {mostrarForm && (
        <MenuItemForm
          item={editando}
          onSalvar={async (dados) => {
            if (editando) {
              await fetch(`${API}/menu/${editando.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
              })
            } else {
              await fetch(`${API}/menu`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
              })
            }
            setMostrarForm(false)
            setEditando(null)
            carregar()
          }}
          onCancelar={() => { setMostrarForm(false); setEditando(null) }}
        />
      )}
      <div className="card">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Qualidade</th><th>Categoria</th><th>Preço</th><th></th></tr>
            </thead>
            <tbody>
              {menu.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.nome}</td>
                  <td><span className={tipoClass(item.tipo)}>{item.tipo === 'sabor' ? 'Sabor' : item.tipo === 'tamanho' ? 'Tamanho' : 'Produto'}</span></td>
                  <td>
                    {item.tipo === 'sabor' ? (
                      <span className={qualClass(item.classificacao)}>
                        {item.classificacao ? item.classificacao.charAt(0).toUpperCase() + item.classificacao.slice(1) : '-'}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{item.categoria}</td>
                  <td>
                    {item.tipo === 'sabor' ? '-' : item.tipo === 'tamanho' ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                        {['Tradicional', 'Especial', 'Nobre'].map(t => {
                          const key = 'preco_' + t.toLowerCase()
                          return item[key] ? `${t[0]}: R$${item[key].toFixed(2)}` : ''
                        }).filter(Boolean).join(' / ') || '-'}
                      </span>
                    ) : `R$ ${item.preco?.toFixed(2)}`}
                  </td>
                  <td className="table-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => { setEditando(item); setMostrarForm(true) }}><Pencil size={14} /></button>
                    <button className="btn btn-destructive btn-xs" onClick={() => deletar(item.id)}><X size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function MenuItemForm({ item, onSalvar, onCancelar }) {
  const [form, setForm] = useState(
    item || { nome: '', descricao: '', preco: '', categoria: 'Pizzas Salgadas', imagem: '', tipo: 'produto', maxSabores: '', classificacao: '', preco_tradicional: '', preco_especial: '', preco_nobre: '' }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const dados = { ...form }
    if (dados.tipo === 'produto') dados.preco = parseFloat(dados.preco)
    else delete dados.preco
    if (dados.tipo !== 'tamanho') { delete dados.maxSabores; delete dados.preco_tradicional; delete dados.preco_especial; delete dados.preco_nobre }
    if (dados.tipo !== 'sabor') delete dados.classificacao
    if (dados.tipo === 'tamanho') {
      if (dados.preco_tradicional !== undefined && dados.preco_tradicional !== '') dados.preco_tradicional = parseFloat(dados.preco_tradicional)
      if (dados.preco_especial !== undefined && dados.preco_especial !== '') dados.preco_especial = parseFloat(dados.preco_especial)
      if (dados.preco_nobre !== undefined && dados.preco_nobre !== '') dados.preco_nobre = parseFloat(dados.preco_nobre)
    }
    onSalvar(dados)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{item ? 'Editar Item' : 'Novo Item'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input className="form-input" placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="form-group">
            <textarea className="form-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} />
          </div>
          <div className="form-group">
            <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="produto">Produto</option>
              <option value="sabor">Sabor de Pizza</option>
              <option value="tamanho">Tamanho de Pizza</option>
            </select>
          </div>
          {form.tipo === 'produto' && (
            <div className="form-group">
              <input className="form-input" type="number" step="0.01" placeholder="Preço" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} required />
            </div>
          )}
          {form.tipo === 'sabor' && (
            <div className="form-group">
              <select className="form-input" value={form.classificacao} onChange={e => setForm({ ...form, classificacao: e.target.value })}>
                <option value="">Sem classificação</option>
                <option value="tradicional">Tradicional</option>
                <option value="especial">Especial</option>
                <option value="nobre">Nobre</option>
              </select>
            </div>
          )}
          {form.tipo === 'tamanho' && (
            <>
              <div className="form-group">
                <input className="form-input" type="number" min="1" max="4" placeholder="Máx. de sabores" value={form.maxSabores} onChange={e => setForm({ ...form, maxSabores: parseInt(e.target.value) || '' })} required />
              </div>
              <p className="form-label" style={{ marginTop: 4 }}>Preços por qualidade</p>
              <div className="form-group">
                <input className="form-input" type="number" step="0.01" placeholder="Preço Tradicional" value={form.preco_tradicional} onChange={e => setForm({ ...form, preco_tradicional: e.target.value })} />
              </div>
              <div className="form-group">
                <input className="form-input" type="number" step="0.01" placeholder="Preço Especial" value={form.preco_especial} onChange={e => setForm({ ...form, preco_especial: e.target.value })} />
              </div>
              <div className="form-group">
                <input className="form-input" type="number" step="0.01" placeholder="Preço Nobre" value={form.preco_nobre} onChange={e => setForm({ ...form, preco_nobre: e.target.value })} />
              </div>
            </>
          )}
          <div className="form-group">
            <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              <option>Pizzas Salgadas</option>
              <option>Pizzas Doces</option>
              <option>Bebidas</option>
              <option>Porções</option>
              <option>Sobremesas</option>
              <option>Tamanhos de Pizza</option>
            </select>
          </div>
          <div className="form-group">
            <input className="form-input" placeholder="URL da imagem (opcional)" value={form.imagem} onChange={e => setForm({ ...form, imagem: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary"><Check size={18} /> Salvar</button>
            <button type="button" className="btn btn-destructive" onClick={onCancelar}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminOrders() {
  const [pedidos, setPedidos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [, setTick] = useState(0)
  const [marketplaceInfo, setMarketplaceInfo] = useState({})
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    fetch(`${API}/marketplaces/info`)
      .then(r => r.json())
      .then(data => {
        const map = {}
        data.forEach(mp => { map[mp.platform] = mp })
        setMarketplaceInfo(map)
      })
      .catch(() => {})
  }, [])

  const carregar = () => fetch(`${API}/orders`).then(r => r.json()).then(data => setPedidos(data))
  useEffect(() => { carregar(); const id = setInterval(carregar, 10000); return () => clearInterval(id) }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1)
      pedidos.forEach(p => {
        if (p.status !== 'pendente' || !p.data) return
        const elapsed = Date.now() - new Date(p.data).getTime()
        if (elapsed >= 300000) {
          fetch(`${API}/orders/${p.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'recusado' })
          }).then(() => carregar()).catch(() => {})
        }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [pedidos])

  const atualizarStatus = async (id, status) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    carregar()
  }

  const hojeStr = () => new Date().toLocaleDateString('pt-BR')
  const pedidosDoDia = useMemo(() => {
    const hoje = hojeStr()
    return pedidos.filter(p => p.data && new Date(p.data).toLocaleDateString('pt-BR') === hoje)
  }, [pedidos])

  const ordenados = [...pedidosDoDia].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
  const filtrados = (filtro === 'todos' ? ordenados : ordenados.filter(p => p.status === filtro))

  const tempoRestante = (data) => {
    if (!data) return ''
    const elapsed = Date.now() - new Date(data).getTime()
    const restante = 300000 - elapsed
    if (restante <= 0) return 'Cancelado'
    const min = Math.floor(restante / 60000)
    const seg = Math.floor((restante % 60000) / 1000)
    return `${min}:${seg.toString().padStart(2, '0')}`
  }

  const tempoDecorrido = (data) => {
    if (!data) return ''
    const diff = Date.now() - new Date(data).getTime()
    if (diff < 60000) return 'Agora'
    const min = Math.floor(diff / 60000)
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    return `${h}h${min % 60}min`
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'À caminho', entregador_proximo: 'Entregador Próximo', entregue: 'Entregue', recusado: 'Recusado' }
  const badgeClass = { pendente: 'badge badge-warning', aceito: 'badge badge-info', liberado: 'badge badge-liberate', entregador_proximo: 'badge badge-amber', entregue: 'badge badge-success', recusado: 'badge badge-destructive' }
  const FILTROS = ['pendente', 'aceito', 'liberado', 'entregador_proximo', 'entregue', 'recusado', 'todos']

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pedidos</h1>
          <p className="page-description">Acompanhe e gerencie os pedidos recebidos</p>
        </div>
      </div>
      <div className="section">
        <div className="filter-group">
          {FILTROS.map(s => {
            const count = s === 'todos' ? ordenados.length : ordenados.filter(p => p.status === s).length
            return (
              <button key={s} className={`filter-btn ${filtro === s ? 'active' : ''}`} onClick={() => setFiltro(s)}>
                {s === 'todos' ? 'Todos' : statusLabel[s]}
                <span className={`filter-count ${count === 0 ? 'zero' : ''}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      {filtrados.length === 0 ? (
        <div className="empty-state"><p>Nenhum pedido hoje</p></div>
      ) : (
        <div className="pedidos-list">
          {filtrados.map(pedido => {
            const origem = pedido.cliente?.origem
            const mpInfo = marketplaceInfo[origem]
            return (
            <div key={pedido.id} className={`pedido-card ${pedido.status}${pedido.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
              <div className="pedido-card-header" onClick={() => setExpandido(expandido === pedido.id ? null : pedido.id)} style={{ cursor: 'pointer' }}>
                <span className="pedido-id">
                  Pedido #{pedido.id}
                  {mpInfo && <span className="pedido-origem-badge" style={{ background: mpInfo.color }}>{mpInfo.displayName}</span>}
                </span>
                <span className={badgeClass[pedido.status]}>{statusLabel[pedido.status]}</span>
              </div>
              <div className="pedido-card-body">
                <div className="pedido-info-row">
                  <div className="pedido-info-icon"><MapPin size={18} /></div>
                  <div className="pedido-info-content">
                    <div className="pedido-info-label">Cliente</div>
                    <div className="pedido-info-value">
                      {pedido.cliente?.nome}{pedido.cliente?.telefone ? ` · ${pedido.cliente.telefone}` : ''}
                    </div>
                  </div>
                </div>
                <div className="pedido-info-row">
                  <div className="pedido-info-icon"><MapPin size={18} /></div>
                  <div className="pedido-info-content">
                    <div className="pedido-info-label">Endereço</div>
                    <div className="pedido-info-value">{pedido.cliente?.endereco || 'Não informado'}</div>
                  </div>
                </div>
                {pedido.itens?.length > 0 && (
                  <div className="pedido-info-row">
                    <div className="pedido-info-icon"><Pizza size={18} /></div>
                    <div className="pedido-info-content">
                      <div className="pedido-info-label">Itens</div>
                      <div className="pedido-itens">
                        {pedido.itens.map(item => (
                          <span key={item.id} className="pedido-item">{item.qtd}x {item.nome}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {expandido === pedido.id && (
                  <div className="pedido-detalhes">
                    {pedido.cliente?.cpf && (
                      <div className="detalhe-row">
                        <FileText size={14} />
                        <span className="detalhe-label">CPF</span>
                        <span>{pedido.cliente.cpf}</span>
                      </div>
                    )}
                    {pedido.cliente?.pagamento?.length > 0 && pedido.cliente.pagamento.map((p, i) => (
                      <div key={i} className="detalhe-row">
                        <CreditCard size={14} />
                        <span className="detalhe-label">Pagamento</span>
                        <span>
                          {p.metodo === 'ONLINE' ? 'Online' : p.metodo}{p.bandeira ? ` - ${p.bandeira}` : ''}
                          <span className="detalhe-valor">R$ {p.valor?.toFixed(2)}</span>
                          {p.prepago && <CheckCircle size={12} className="detalhe-pago" />}
                        </span>
                      </div>
                    ))}
                    {pedido.cliente?.observacoes && (
                      <div className="detalhe-row">
                        <FileText size={14} />
                        <span className="detalhe-label">Obs</span>
                        <span>{pedido.cliente.observacoes}</span>
                      </div>
                    )}
                    {pedido.cliente?.codigo_coleta && (
                      <div className="detalhe-row">
                        <Hash size={14} />
                        <span className="detalhe-label">Coleta</span>
                        <span className="detalhe-codigo">{pedido.cliente.codigo_coleta}</span>
                      </div>
                    )}
                    {pedido.cliente?.metodo_entrega && (
                      <div className="detalhe-row">
                        <Truck size={14} />
                        <span className="detalhe-label">Entrega</span>
                        <span>{pedido.cliente.metodo_entrega === 'MERCHANT' ? 'Entrega própria' : 'iFood'}</span>
                      </div>
                    )}
                    {pedido.cliente?.teste && (
                      <div className="detalhe-row">
                        <AlertTriangle size={14} />
                        <span className="detalhe-label">Teste</span>
                        <span className="detalhe-teste">Pedido de teste</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pedido-meta">
                  <span className="pedido-meta-item"><Clock size={14} /> {new Date(pedido.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="pedido-meta-item pedido-valor">R$ {pedido.total?.toFixed(2)}</span>
                  {pedido.data && (
                    <span className={`pedido-timer ${pedido.status === 'pendente' && tempoRestante(pedido.data) === 'Cancelado' ? 'timer-expirado' : ''}`}>
                      <Timer size={14} /> {pedido.status === 'pendente' ? tempoRestante(pedido.data) : tempoDecorrido(pedido.data)}
                    </span>
                  )}
                </div>
              </div>
              <div className="pedido-card-footer">
                {pedido.status === 'pendente' && (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => atualizarStatus(pedido.id, 'aceito')}><Check size={16} /> Aceitar</button>
                    <button className="btn btn-destructive btn-sm" onClick={() => atualizarStatus(pedido.id, 'recusado')}><X size={16} /> Recusar</button>
                  </>
                )}
                {pedido.status === 'aceito' && (
                  <>
                    <button className="btn btn-liberar btn-sm" onClick={() => atualizarStatus(pedido.id, 'liberado')}><Truck size={16} /> Liberar</button>
                    <button className="btn btn-destructive btn-sm" onClick={() => atualizarStatus(pedido.id, 'recusado')}><X size={16} /> Recusar</button>
                  </>
                )}
                {pedido.status === 'liberado' && (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => atualizarStatus(pedido.id, 'entregue')}><CheckCircle size={16} /> Entregue</button>
                    <button className="btn btn-destructive btn-sm" onClick={() => atualizarStatus(pedido.id, 'recusado')}><X size={16} /> Recusar</button>
                  </>
                )}
                {pedido.status === 'entregador_proximo' && (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => atualizarStatus(pedido.id, 'entregue')}><CheckCircle size={16} /> Entregue</button>
                    <button className="btn btn-destructive btn-sm" onClick={() => atualizarStatus(pedido.id, 'recusado')}><X size={16} /> Recusar</button>
                  </>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function AdminFinanceiro() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch(`${API}/orders/stats`).then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return <div className="empty-state"><p>Carregando...</p></div>

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Financeiro</h1>
          <p className="page-description">Resumo financeiro do dia</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total de Pedidos</span>
          <span className="stat-value">{stats.totalPedidos}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Receita (Entregues)</span>
          <span className="stat-value">R$ {stats.totalReceita.toFixed(2)}</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">Receita Pendente</span>
          <span className="stat-value">R$ {stats.receitaPendente.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pendentes</span>
          <span className="stat-value">{stats.pendentes}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Em Preparo</span>
          <span className="stat-value">{stats.aceitos}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Entregues</span>
          <span className="stat-value">{stats.entregues}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Recusados</span>
          <span className="stat-value">{stats.recusados}</span>
        </div>
      </div>
    </>
  )
}

function RastreioPage() {
  const [motoboys, setMotoboys] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [pizzaria, setPizzaria] = useState(null)

  const getLat = p => parseFloat(p.entrega_lat) || parseFloat(p.cliente?.lat) || parseFloat(p.cliente?.endereco_lat) || null
  const getLng = p => parseFloat(p.entrega_lng) || parseFloat(p.cliente?.lng) || parseFloat(p.cliente?.endereco_lng) || null

  const statusCor = m => {
    if (!m.online) return '#E53935'
    const diff = Date.now() - new Date(m.timestamp).getTime()
    if (diff < 45000) return '#43A047'
    return '#FF8F00'
  }

  const statusTexto = m => {
    if (!m.online) return 'Offline'
    const diff = Date.now() - new Date(m.timestamp).getTime()
    if (diff < 45000) return m.lat ? 'Online' : 'Online (sem GPS)'
    return 'Sinal perdido'
  }

  useEffect(() => {
    fetch(`${API}/admin/config/pizzaria`)
      .then(r => r.json())
      .then(data => { if (data.lat && data.lng) setPizzaria(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let mounted = true
    const buscar = () => {
      fetch(`${API}/motoboy/positions`)
        .then(r => r.json())
        .then(data => { if (mounted && Array.isArray(data)) setMotoboys(data) })
        .catch(() => {})
      fetch(`${API}/orders`)
        .then(r => r.json())
        .then(data => {
          if (!mounted || !Array.isArray(data)) return
          const hoje = new Date().toLocaleDateString('pt-BR')
          const ativos = data.filter(p => {
            const dataPedido = p.data ? new Date(p.data).toLocaleDateString('pt-BR') : ''
            return dataPedido === hoje && ['aceito','liberado','em_rota','entregador_proximo','entregue'].includes(p.status)
          })
          setPedidos(ativos)
        })
        .catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const onlineCount = motoboys.filter(m => m.online).length
  const algumOnline = motoboys.some(m => m.online)
  const center = motoboys.find(m => m.lat) || pizzaria || { lat: -25.4290, lng: -49.2671 }

  const comCoords = pedidos.filter(p => getLat(p) && getLng(p))
  const entregues = comCoords.filter(p => p.status === 'entregue')
  const total = comCoords.length
  const concluidos = entregues.length
  const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0

  const rotaCoords = []
  if (pizzaria?.lat && pizzaria?.lng) rotaCoords.push([pizzaria.lat, pizzaria.lng])
  comCoords.sort((a, b) => {
    const ordem = { entregue: 4, entregador_proximo: 3, em_rota: 2, liberado: 1, aceito: 0 }
    return (ordem[a.status] || 0) - (ordem[b.status] || 0)
  })
  comCoords.forEach(p => rotaCoords.push([getLat(p), getLng(p)]))

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'Saiu p/ entrega', em_rota: 'Em rota', entregador_proximo: 'Chegando!', entregue: 'Entregue' }

  return (
    <div className="rastreio-page">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header-left">
          <h1 className="page-title">Rastreio</h1>
          <p className="page-description">Acompanhe a localização dos motoboys em tempo real</p>
        </div>
        <div className="rastreio-stats-header">
          <span className="rastreio-online-count">{onlineCount} motoboy{onlineCount !== 1 ? 's' : ''} online</span>
        </div>
      </div>

      {total > 0 && (
        <div className="rastreio-route-progress">
          <div className="rastreio-route-header">
            <span className="rastreio-route-label">Rota do dia</span>
            <span className="rastreio-route-pct">{progresso}%</span>
          </div>
          <div className="rastreio-route-bar">
            <div className="rastreio-route-fill" style={{ width: `${progresso}%` }} />
          </div>
          <div className="rastreio-route-meta">
            <span>{concluidos} concluída{concluidos !== 1 ? 's' : ''}</span>
            <span>{total - concluidos} restante{total - concluidos !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {!algumOnline ? (
        <div className="rastreio-offline">
          <div className="rastreio-offline-icon"><Bike size={48} /></div>
          <p>Nenhum motoboy online</p>
          <p>Aguardando conexão...</p>
        </div>
      ) : (
        <>
          <div className="rastreio-mapa">
            <MapContainer center={[center.lat, center.lng]} zoom={15} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {motoboys.filter(m => m.online && m.lat).map(m => {
                const cor = statusCor(m)
                return (
                  <Marker key={m.nome} position={[m.lat, m.lng]} icon={L.divIcon({
                    className: '',
                    html: `<div class="motoboy-marker-info"><div class="motoboy-marker-nome">${m.nome}</div><div class="motoboy-marker-status" style="border-color:${cor};color:${cor}">${statusTexto(m)}</div><svg viewBox="0 0 24 36" width="28" height="42"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${cor}"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg></div>`,
                    iconSize: [28, 42],
                    iconAnchor: [14, 42],
                  })} />
                )
              })}
              {rotaCoords.length > 1 && (
                <Polyline positions={rotaCoords} pathOptions={{ color: '#FF8F00', weight: 3, opacity: 0.6, dashArray: '8 4' }} />
              )}
              {pizzaria?.lat && pizzaria?.lng && (
                <Marker position={[pizzaria.lat, pizzaria.lng]} icon={L.divIcon({
                  className: '',
                  html: '<div style="background:#E53935;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">P</div>',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })} />
              )}
              {comCoords.map((p, i) => {
                const lat = getLat(p)
                const lng = getLng(p)
                if (!lat || !lng) return null
                const cor = p.status === 'entregue' ? '#43A047' : '#FF8F00'
                return (
                  <Marker key={p.id} position={[lat, lng]} icon={L.divIcon({
                    className: '',
                    html: `<div style="background:${cor};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer" title="${p.cliente?.nome || `#${p.id}`}">${i + 1}</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                  })} />
                )
              })}
            </MapContainer>
          </div>
          <div className="rastreio-footer">
            {motoboys.filter(m => m.online).map((m, i) => (
              <span key={m.nome}>{i > 0 && ' · '}<span style={{ fontWeight: 600, color: statusCor(m) }}>{m.nome}</span></span>
            ))}
          </div>
        </>
      )}

      {motoboys.length > 0 && (
        <div className="rastreio-motoboys-list">
          {motoboys.map(m => (
            <div key={m.nome} className="rastreio-motoboy-item" style={{ borderLeftColor: statusCor(m) }}>
              <div className="rastreio-motoboy-info">
                <strong>{m.nome}</strong>
                <span className="rastreio-motoboy-status-txt" style={{ color: statusCor(m) }}>{statusTexto(m)}</span>
              </div>
              <span className="rastreio-motoboy-time">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString('pt-BR') : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {comCoords.length > 0 && (
        <div className="rastreio-lista">
          {comCoords.map((p, i) => (
            <div key={p.id} className="rastreio-lista-item" style={{ background: p.status === 'entregue' ? 'rgba(67,160,71,0.08)' : 'rgba(255,143,0,0.08)' }}>
              <span className="rastreio-lista-num" style={{ background: p.status === 'entregue' ? '#43A047' : '#FF8F00' }}>{i + 1}</span>
              <div className="rastreio-lista-info">
                <span className="rastreio-lista-cliente">#{p.id} - {p.cliente?.nome || 'Sem nome'}</span>
                <span className="rastreio-lista-status">{statusLabel[p.status] || p.status}</span>
              </div>
              {p.status === 'entregue' && <CheckCircle size={18} color="#43A047" style={{ flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminPizzariaConfig() {
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [mostrarMapaPizzaria, setMostrarMapaPizzaria] = useState(false)
  const cepTimer = useRef(null)

  const handleMapaConfirmPizzaria = ({ lat, lng }) => {
    setForm(f => ({ ...f, lat, lng }))
    setMostrarMapaPizzaria(false)
  }

  const handleCepChange = (value) => {
    const fmt = value.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
    setForm(f => ({ ...f, cep: fmt }))
    const digits = fmt.replace(/\D/g, '')
    if (digits.length === 8) {
      if (cepTimer.current) clearTimeout(cepTimer.current)
      cepTimer.current = setTimeout(async () => {
        setBuscandoCep(true)
        try {
          const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
          const result = await r.json()
          if (!result.erro) setForm(f => ({ ...f, rua: result.logradouro, bairro: result.bairro, cidade: result.localidade, estado: result.uf }))
        } catch {}
        setBuscandoCep(false)
      }, 300)
    }
  }

  useEffect(() => {
    fetch(`${API}/admin/config/pizzaria`).then(r => r.json()).then(data => setForm(data)).catch(() => {})
  }, [])

  const handleSalvar = async () => {
    setSalvando(true)
    setMsg('')
    try {
      const payload = { ...form, senha: 'admin123' }
      const res = await fetch(`${API}/admin/config/pizzaria`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok) { setMsg('Salvo com sucesso!'); setTimeout(() => setMsg(''), 3000) }
      else setMsg('Erro: ' + (data.erro || 'Falha ao salvar'))
    } catch { setMsg('Erro de conexão') }
    setSalvando(false)
  }

  if (!form) return <div className="empty-state"><p>Carregando...</p></div>

  return (
    <div className="pizzaria-config">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pizzaria</h1>
          <p className="page-description">Configure os dados da sua pizzaria</p>
        </div>
      </div>
      <div className="card">
        <div className="pizzaria-form">
          {msg && <p className={`form-msg ${msg.includes('sucesso') ? 'success' : ''}`}>{msg}</p>}
          <div className="form-group">
            <label className="form-label">CNPJ</label>
            <input className="form-input" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Nome Fantasia</label>
            <input className="form-input" placeholder="Israelita Pizzas" value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Razão Social</label>
            <input className="form-input" placeholder="Razão Social" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(41) 99999-9999" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">CEP</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="form-input" placeholder="82840-080" value={form.cep} onChange={e => handleCepChange(e.target.value)} />
              {buscandoCep && <span className="endereco-loading">Consultando...</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Rua</label>
              <input className="form-input" placeholder="Rua" value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nº</label>
              <input className="form-input" placeholder="Nº" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Complemento</label>
            <input className="form-input" placeholder="Complemento" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} />
          </div>
          <div className="form-row-triple">
            <div className="form-group">
              <label className="form-label">Bairro</label>
              <input className="form-input" placeholder="Bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Cidade</label>
              <input className="form-input" placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">UF</label>
              <input className="form-input" placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Localização</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="Latitude" value={form.lat || ''} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} style={{width:140}} />
              <input className="form-input" placeholder="Longitude" value={form.lng || ''} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} style={{width:140}} />
              <button className="endereco-mapa-btn" type="button" onClick={() => setMostrarMapaPizzaria(true)}><MapPin size={16} /> Marcar no mapa</button>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando} style={{ alignSelf: 'flex-start' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      <MapaEntregaModal
        isOpen={mostrarMapaPizzaria}
        onClose={() => setMostrarMapaPizzaria(false)}
        onConfirm={handleMapaConfirmPizzaria}
        enderecoInicial={form?.rua ? `${form.rua}, ${form.numero} - ${form.bairro}, ${form.cidade} - ${form.estado}` : ''}
        initialCoords={form?.lat && form?.lng ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : null}
      />
    </div>
  )
}

function AdminPermissoes({ user, token }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editandoId, setEditandoId] = useState(null)
  const [novaRole, setNovaRole] = useState('')
  const [novoStatus, setNovoStatus] = useState('')
  const [filtroRole, setFiltroRole] = useState('todas')
  const [msg, setMsg] = useState('')

  const carregar = async () => {
    setLoading(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : { 'x-admin-password': 'admin123' }
      const res = await fetch(`${API}/auth/users`, { headers })
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data)
      }
    } catch (e) { console.log('[Permissoes] Network error:', e) }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const alterarRole = async (id) => {
    if (!novaRole && !novoStatus) return
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      else headers['x-admin-password'] = 'admin123'
      const body = {}
      if (novaRole) body.role = novaRole
      if (novoStatus) body.status = novoStatus
      const res = await fetch(`${API}/auth/users/${id}/role`, {
        method: 'PATCH', headers, body: JSON.stringify(body)
      })
      if (res.ok) {
        setMsg('Permissão atualizada!')
        setTimeout(() => setMsg(''), 3000)
        setEditandoId(null); setNovaRole(''); setNovoStatus('')
        carregar()
      } else {
        const err = await res.json()
        setMsg('Erro: ' + (err.erro || 'Falha'))
      }
    } catch { setMsg('Erro de conexão') }
  }

  const ROLE_LABELS = { cliente: 'Cliente', motoboy: 'Motoboy', atendente: 'Atendente', financeiro: 'Financeiro', admin: 'Admin' }
  const ROLE_COLORS = { cliente: '#78909C', motoboy: '#FF8F00', atendente: '#43A047', financeiro: '#1E88E5', admin: '#E53935' }
  const STATUS_LABELS = { ativo: 'Ativo', pendente: 'Pendente', bloqueado: 'Bloqueado' }
  const STATUS_COLORS = { ativo: '#43A047', pendente: '#FF8F00', bloqueado: '#E53935' }

  const filtrados = filtroRole === 'todas' ? usuarios : usuarios.filter(u => u.role === filtroRole)

  return (
    <div className="permissoes-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Permissões</h1>
          <p className="page-description">Gerencie as permissões dos usuários</p>
        </div>
        <div className="filter-group">
          {['todas', 'cliente', 'motoboy', 'atendente', 'financeiro', 'admin'].map(r => (
            <button key={r} className={`filter-btn ${filtroRole === r ? 'active' : ''}`} onClick={() => setFiltroRole(r)}>
              {r === 'todas' ? 'Todas' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className="form-msg success" style={{ marginBottom: 16 }}>{msg}</p>}
      {loading ? (
        <div className="empty-state"><p>Carregando...</p></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><p>Nenhum usuário encontrado</p></div>
      ) : (
        <div className="permissoes-grid">
          {filtrados.map(u => (
            <div key={u.id} className="permissoes-card">
              <div className="permissoes-card-header">
                <span className="permissoes-card-nome">{u.nome || 'Sem nome'}</span>
                <span className="permissoes-card-email">{u.email}</span>
              </div>
              <div className="permissoes-card-badges">
                <span className="badge" style={{ color: ROLE_COLORS[u.role], borderColor: `${ROLE_COLORS[u.role]}44`, background: `${ROLE_COLORS[u.role]}15` }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                <span className="badge" style={{ color: STATUS_COLORS[u.status], borderColor: `${STATUS_COLORS[u.status]}44`, background: `${STATUS_COLORS[u.status]}15` }}>
                  {STATUS_LABELS[u.status] || u.status}
                </span>
              </div>
              {editandoId === u.id ? (
                <div className="permissoes-edit-form">
                  <select value={novaRole} onChange={e => setNovaRole(e.target.value)}>
                    <option value="">Manter role</option>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={novoStatus} onChange={e => setNovoStatus(e.target.value)}>
                    <option value="">Manter status</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <div className="permissoes-edit-actions">
                    <button className="btn btn-primary btn-xs" onClick={() => alterarRole(u.id)}><Check size={14} /> Salvar</button>
                    <button className="btn btn-destructive btn-xs" onClick={() => setEditandoId(null)}><X size={14} /> Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditandoId(u.id); setNovaRole(''); setNovoStatus('') }}><Pencil size={14} /> Editar</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminConfiguracoes() {
  const [marketplaces, setMarketplaces] = useState([])
  const [config, setConfig] = useState({})
  const [statuses, setStatuses] = useState({})
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [salvando, setSalvando] = useState({})
  const [testando, setTestando] = useState({})
  const [testResult, setTestResult] = useState(null)
  const [msg, setMsg] = useState('')
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/marketplaces/info`).then(r => r.json()),
      fetch(`${API}/config/marketplaces`).then(r => r.json()),
      fetch(`${API}/marketplaces/status`).then(r => r.json())
    ]).then(([info, cfg, st]) => {
      setMarketplaces(info)
      setConfig(cfg)
      setStatuses(st)
    }).catch(() => {})
  }, [])

  const handleSalvar = async (platform) => {
    setSalvando(s => ({ ...s, [platform]: true }))
    setMsg('')
    setTestResult(null)
    try {
      const res = await fetch(`${API}/config/marketplaces/${platform}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config[platform])
      })
      const data = await res.json()
      if (res.ok) {
        setMsg('Configurações salvas!')
        setTimeout(() => setMsg(''), 3000)
        if (data.status) {
          setStatuses(st => ({ ...st, [platform]: data.status }))
        }
      } else {
        setMsg('Erro: ' + (data.erro || 'Falha'))
      }
    } catch { setMsg('Erro de conexão') }
    setSalvando(s => ({ ...s, [platform]: false }))
  }

  const handleTest = async (platform) => {
    setTestando(s => ({ ...s, [platform]: true }))
    setTestResult(null)
    try {
      const res = await fetch(`${API}/marketplace/${platform}/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config[platform])
      })
      const result = await res.json()
      setTestResult(result)
      setStatuses(st => ({
        ...st,
        [platform]: result.success
          ? { status: 'connected', label: 'Conectado' }
          : { status: 'error', label: 'Erro de autenticação' }
      }))
    } catch {
      setTestResult({ success: false, message: 'Erro de conexão com o servidor' })
    }
    setTestando(s => ({ ...s, [platform]: false }))
  }

  const handleFieldChange = (platform, key, value) => {
    setConfig(c => ({ ...c, [platform]: { ...(c[platform] || {}), [key]: value } }))
    setTestResult(null)
  }

  const handlePoll = async (platform) => {
    setPolling(true)
    setMsg('')
    try {
      const res = await fetch(`${API}/marketplace/${platform}/poll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`Polling concluído: ${data.importedCount} pedido(s) importado(s) de ${data.totalEvents} evento(s)`)
      } else {
        setMsg('Erro: ' + (data.error || 'Falha'))
      }
    } catch {
      setMsg('Erro de conexão')
    }
    setPolling(false)
  }

  const [debugLog, setDebugLog] = useState(null)
  const handleDebug = async () => {
    try {
      const res = await fetch(`${API}/marketplace/debug/log`)
      const data = await res.json()
      setDebugLog(data)
    } catch {
      setMsg('Erro ao buscar log')
    }
  }

  if (marketplaces.length === 0) return <div className="empty-state"><p>Carregando...</p></div>

  if (selectedPlatform) {
    const mp = marketplaces.find(m => m.platform === selectedPlatform)
    if (!mp) return <div className="empty-state"><p>Marketplace não encontrado</p></div>
    const platformConfig = config[mp.platform] || {}
    const status = statuses[mp.platform] || { status: 'not_configured', label: 'Não configurado' }
    const isEnabled = platformConfig.enabled || false
    const webhookUrl = `${window.location.origin}/api/marketplace/${mp.platform}/webhook`
    const hasWebhook = mp.fields.some(f => f.section === 'webhook')
    const credentialsFields = mp.fields.filter(f => f.section === 'credentials')
    const webhookFields = mp.fields.filter(f => f.section === 'webhook')
    const topFields = mp.fields.filter(f => f.key === 'enabled')

    const statusColors = {
      not_configured: 'var(--muted-foreground)',
      disabled: 'var(--muted-foreground)',
      configured: 'var(--info)',
      connected: 'var(--success)',
      error: 'var(--destructive)'
    }

    return (
      <div className="marketplace-detail">
        <div className="marketplace-detail-topbar">
          <button className="btn btn-ghost" onClick={() => { setSelectedPlatform(null); setTestResult(null) }}>
            <ChevronLeft size={18} /> Voltar
          </button>
        </div>
        <div className="marketplace-detail-header">
          <div className="marketplace-detail-icon" style={{ background: mp.color }}>
            {mp.displayName[0]}
          </div>
          <div className="marketplace-detail-info">
            <h2 className="page-title">{mp.displayName}</h2>
            <span className="marketplace-detail-status" style={{ color: statusColors[status.status] || 'var(--muted-foreground)' }}>
              {status.status === 'connected' && <Wifi size={14} />}
              {status.status === 'error' && <AlertCircle size={14} />}
              {status.status === 'not_configured' && <WifiOff size={14} />}
              {status.label}
            </span>
          </div>
        </div>

        {msg && <p className={`form-msg ${msg.includes('sucesso') ? 'success' : ''}`} style={{ marginBottom: 16 }}>{msg}</p>}

        <div className="card">
          <div className="card-body marketplace-detail-body">
            {topFields.map(field => (
              <div className="config-section" key={field.key}>
                <div className="form-group">
                  <label className="form-label">{field.label}</label>
                  <label className="toggle-label">
                    <input type="checkbox" checked={isEnabled} onChange={e => handleFieldChange(mp.platform, field.key, e.target.checked)} />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">{isEnabled ? 'Ativado' : 'Desativado'}</span>
                  </label>
                </div>
              </div>
            ))}

            {credentialsFields.length > 0 && (
              <div className="config-section">
                <h4 className="config-subtitle">Credenciais da API</h4>
                {credentialsFields.map(field => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label">{field.label}</label>
                    <input className="form-input" type={field.type === 'password' ? 'text' : 'text'} autoComplete="off" placeholder={field.label} value={platformConfig[field.key] || ''} disabled={!isEnabled} onChange={e => handleFieldChange(mp.platform, field.key, e.target.value)} />
                    {field.hint && <span className="form-hint">{field.hint}</span>}
                  </div>
                ))}
              </div>
            )}

            {hasWebhook && (
              <div className="config-section">
                <h4 className="config-subtitle">Webhook</h4>
                <p className="config-desc">Configure esta URL no {mp.displayName} para receber os pedidos automaticamente.</p>
                <div className="form-group">
                  <label className="form-label">URL do Webhook</label>
                  <div className="input-copy">
                    <input className="form-input" readOnly value={webhookUrl} onClick={e => e.target.select()} />
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); setMsg('URL copiada!'); setTimeout(() => setMsg(''), 2000) }}>Copiar</button>
                  </div>
                </div>
                {webhookFields.map(field => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label">{field.label}</label>
                    <div className="input-copy">
                      <input className="form-input" type="text" autoComplete="off" placeholder={field.label} value={platformConfig[field.key] || ''} disabled={!isEnabled} onChange={e => handleFieldChange(mp.platform, field.key, e.target.value)} />
                      {platformConfig[field.key] && (
                        <button className="btn btn-ghost btn-sm" disabled={!isEnabled} onClick={() => handleFieldChange(mp.platform, field.key, '')}>Limpar</button>
                      )}
                    </div>
                    {field.hint && <span className="form-hint" dangerouslySetInnerHTML={{ __html: field.hint }} />}
                  </div>
                ))}
              </div>
            )}

            {testResult && (
              <div className={`test-result ${testResult.success ? 'test-result-success' : 'test-result-error'}`}>
                {testResult.success ? <CheckCircle size={18} /> : <X size={18} />}
                {testResult.message}
              </div>
            )}

            <div className="marketplace-detail-actions">
              <button className="btn btn-secondary" onClick={() => handleTest(mp.platform)} disabled={!isEnabled || testando[mp.platform]}>
                {testando[mp.platform] ? 'Testando...' : 'Testar conexão'}
              </button>
              {mp.supportsPolling && (
                <button className="btn btn-ghost" onClick={() => handlePoll(mp.platform)} disabled={!isEnabled || polling}>
                  {polling ? 'Buscando...' : 'Buscar pedidos pendentes'}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => handleSalvar(mp.platform)} disabled={salvando[mp.platform]}>
                {salvando[mp.platform] ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="btn btn-ghost" onClick={handleDebug} style={{ fontSize: 12 }}>
                Debug
              </button>
            </div>
            {debugLog && (
              <div className="config-section" style={{ marginTop: 16 }}>
                <h4 className="config-subtitle">Últimos eventos do webhook</h4>
                <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: 'var(--bg)', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(debugLog, null, 2)}
                </pre>
                <button className="btn btn-ghost btn-sm" onClick={() => setDebugLog(null)} style={{ marginTop: 4 }}>Fechar</button>
                <button className="btn btn-ghost btn-sm" onClick={handleDebug} style={{ marginTop: 4, marginLeft: 4 }}>Atualizar</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="marketplace-hub">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Marketplaces</h1>
          <p className="page-description">Gerencie as integrações com plataformas de delivery</p>
        </div>
      </div>

      {msg && <p className={`form-msg ${msg.includes('sucesso') ? 'success' : ''}`} style={{ marginBottom: 16 }}>{msg}</p>}

      <div className="marketplace-grid">
        {marketplaces.map(mp => {
          const status = statuses[mp.platform] || { status: 'not_configured', label: 'Não configurado' }
          const statusColors = {
            not_configured: 'var(--muted-foreground)',
            disabled: 'var(--muted-foreground)',
            configured: 'var(--info)',
            connected: 'var(--success)',
            error: 'var(--destructive)'
          }
          const statusIcons = {
            connected: Wifi,
            error: AlertCircle,
            configured: CheckCircle,
            not_configured: WifiOff,
            disabled: WifiOff
          }
          const StatusIcon = statusIcons[status.status] || WifiOff

          return (
            <div key={mp.platform} className="marketplace-card" onClick={() => setSelectedPlatform(mp.platform)}>
              <div className="marketplace-card-avatar" style={{ background: mp.color }}>
                {mp.displayName[0]}
              </div>
              <div className="marketplace-card-content">
                <span className="marketplace-card-name">{mp.displayName}</span>
                <span className="marketplace-card-status" style={{ color: statusColors[status.status] || 'var(--muted-foreground)' }}>
                  <StatusIcon size={12} />
                  {status.label}
                </span>
              </div>
              <ChevronRight size={18} className="marketplace-card-arrow" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MapaEntregaModal({ isOpen, onClose, onConfirm, enderecoInicial, initialCoords }) {
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [buscaEndereco, setBuscaEndereco] = useState('')
  const [buscandoEndereco, setBuscandoEndereco] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const mapRef = useRef(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    mountedRef.current = true
    setPronto(false); setLat(null); setLng(null); setBuscando(true); setBuscaEndereco(''); setErroBusca('')
    if (initialCoords?.lat && initialCoords?.lng) {
      setLat(initialCoords.lat); setLng(initialCoords.lng); setBuscando(false); setPronto(true)
      return
    }
    if (!enderecoInicial) { setLat(-23.5505); setLng(-46.6333); setBuscando(false); setPronto(true); return }
    const geocode = async () => {
      try {
        const enderecoLimpo = enderecoInicial.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/- CEP:\s*[\d-]+/gi, '').replace(/\s+/g, ' ').trim()
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoLimpo)}&limit=1`, { headers: { 'User-Agent': 'IsraelitaPizzasApp/1.0' } })
        const data = await res.json()
        if (!mountedRef.current) return
        if (data[0]) { setLat(parseFloat(data[0].lat)); setLng(parseFloat(data[0].lon)) }
        else { setLat(-23.5505); setLng(-46.6333) }
      } catch { if (mountedRef.current) { setLat(-23.5505); setLng(-46.6333) } }
      finally { if (mountedRef.current) { setBuscando(false); setPronto(true) } }
    }
    geocode()
    return () => { mountedRef.current = false }
  }, [isOpen])

  useEffect(() => {
    if (pronto && mapRef.current) mapRef.current.flyTo([lat, lng], 16)
  }, [pronto, lat, lng])

  const handleSearch = async () => {
    if (!buscaEndereco.trim()) return
    setBuscandoEndereco(true); setErroBusca('')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(buscaEndereco)}&limit=1`, { headers: { 'User-Agent': 'IsraelitaPizzasApp/1.0' } })
      const data = await res.json()
      if (!mountedRef.current) return
      if (data[0]) { setLat(parseFloat(data[0].lat)); setLng(parseFloat(data[0].lng)); if (mapRef.current) mapRef.current.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lng)], 17) }
      else setErroBusca('Endereço não encontrado.')
    } catch { setErroBusca('Erro ao buscar.') }
    setBuscandoEndereco(false)
  }

  const pinIcon = L.divIcon({
    className: '',
    html: '<div class="mapa-marker-blue"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="44"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#2196F3"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg></div>',
    iconSize: [32, 44],
    iconAnchor: [16, 44],
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal modal-mapa" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><MapPin size={20} /> Marcar Local Exato</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {buscando ? (
          <div className="mapa-loading"><div className="mapa-loading-icon"><Search size={32} /></div><p>Localizando...</p></div>
        ) : !pronto ? null : (
          <>
            <div className="mapa-search">
              <input className="mapa-search-input" type="text" placeholder="Buscar endereço..." value={buscaEndereco} onChange={e => { setBuscaEndereco(e.target.value); setErroBusca('') }} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              <button className="mapa-search-btn" onClick={handleSearch} disabled={buscandoEndereco}>{buscandoEndereco ? '...' : 'Buscar'}</button>
            </div>
            {erroBusca && <p className="mapa-search-erro">{erroBusca}</p>}
            <p className="mapa-instrucao">Clique no mapa para ajustar o ponto.</p>
            <div className="mapa-container">
              <MapContainer ref={mapRef} center={[lat, lng]} zoom={16} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[lat, lng]} icon={pinIcon} />
                <MapClickHandler onClick={(newLat, newLng) => { setLat(newLat); setLng(newLng) }} />
                <MapController lat={lat} lng={lng} />
              </MapContainer>
            </div>
            <div className="mapa-coords">Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}</div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { onConfirm({ lat, lng }); onClose() }}><CheckCircle size={18} /> Confirmar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MapController({ lat, lng }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 16) }, [lat, lng])
  return null
}

function MapClickHandler({ onClick }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default App
