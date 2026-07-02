import React, { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'

function IconPizza({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 22 20H2Z"/><circle cx={12} cy={15} r={1.5}/><circle cx={9} cy={11} r={1}/><circle cx={15} cy={11} r={1}/></svg></span>
}
function IconPin({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C7 2 3 6 3 11c0 7 9 11 9 11s9-4 9-11c0-5-4-9-9-9z"/><circle cx={12} cy={11} r={3}/></svg></span>
}
function IconStore({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
}
function IconLock({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
}
function IconClock({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
}
function IconTimer({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><polyline points="10 2 14 2 12 4"/></svg></span>
}
function IconCheck({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
}
function IconClose({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
}
function IconTruck({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><rect x="16" y="5" width="7" height="11" rx="1"/><line x1="16" y1="9" x2="22" y2="9"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>
}
function IconCheckCircle({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
}
function IconScooter({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M16 8l-3 7H6"/><path d="M19 5c-1.5 0-4 1-4 4v4"/></svg></span>
}
function IconSearch({ size = 20 }) {
  return <span className="i" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [autenticado, setAutenticado] = useState(false)
  const [aba, setAba] = useState(() => localStorage.getItem('adminAba') || 'pedidos')
  const [tema, setTema] = useState(() => localStorage.getItem('adminTema') || 'classic')

  useEffect(() => {
    localStorage.setItem('adminAba', aba)
  }, [aba])

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

  if (!autenticado) {
    return <AdminLogin onLogin={handleLogin} user={user} token={token} />
  }

  const role = user?.role || 'admin'

  return (
    <div className={`admin-app theme-${tema}`}>
      <header className="admin-header-bar">
        <div className="admin-header-left">
          <span className="admin-header-logo"><IconPizza /> Israelita</span>
          <span className="admin-header-role">{role === 'admin' ? 'Admin' : role === 'atendente' ? 'Atendente' : 'Financeiro'}</span>
        </div>
        <div className="admin-header-right">
          <span className="admin-header-user">{user?.nome}</span>
          <select className="theme-selector" value={tema} onChange={e => { setTema(e.target.value); localStorage.setItem('adminTema', e.target.value) }}>
            <option value="classic">Clássico</option>
            <option value="elegance">Elegance</option>
            <option value="vibrant">Vibrante</option>
            <option value="minimal">Minimal</option>
            <option value="noturno">Noturno</option>
            <option value="neon">Neon</option>
          </select>
          <button className="admin-header-sair" onClick={handleLogout}>Sair</button>
        </div>
      </header>
      <div className="admin-page">
        <div className="admin-tabs">
          {role === 'admin' && (
            <button className={`tab-btn ${aba === 'cardapio' ? 'active' : ''}`} onClick={() => setAba('cardapio')}>Cardápio</button>
          )}
          {(role === 'admin' || role === 'atendente') && (
            <button className={`tab-btn ${aba === 'pedidos' ? 'active' : ''}`} onClick={() => setAba('pedidos')}>Pedidos</button>
          )}
          {(role === 'admin' || role === 'financeiro') && (
            <button className={`tab-btn ${aba === 'financeiro' ? 'active' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
          )}
          {role === 'admin' && (
            <>
              <button className={`tab-btn ${aba === 'rastreio' ? 'active' : ''}`} onClick={() => setAba('rastreio')}><IconPin /> Rastreio</button>
              <button className={`tab-btn ${aba === 'pizzaria' ? 'active' : ''}`} onClick={() => setAba('pizzaria')}><IconStore /> Pizzaria</button>
              <button className={`tab-btn ${aba === 'permissoes' ? 'active' : ''}`} onClick={() => setAba('permissoes')}><IconLock /> Permissões</button>
            </>
          )}
        </div>
        {aba === 'cardapio' && role === 'admin' && <AdminMenu />}
        {aba === 'pedidos' && (role === 'admin' || role === 'atendente') && <AdminOrders />}
        {aba === 'financeiro' && (role === 'admin' || role === 'financeiro') && <AdminFinanceiro />}
        {aba === 'rastreio' && role === 'admin' && <RastreioPage />}
        {aba === 'pizzaria' && role === 'admin' && <AdminPizzariaConfig />}
        {aba === 'permissoes' && role === 'admin' && <AdminPermissoes user={user} token={token} />}
      </div>
    </div>
  )
}

function AdminLogin({ onLogin, user, token }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error) { setErro('Erro ao autenticar com Google'); return }
          try {
            const r = await fetch(`${API}/auth/google`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: response.access_token })
            })
            const data = await r.json()
            if (data.token && data.user) {
              if (VALID_ROLES.includes(data.user.role)) {
                onLogin(data.user, data.token)
              } else {
                setErro('Sua conta não tem permissão de acesso administrativo.')
              }
            } else {
              setErro(data.erro || 'Erro ao autenticar')
            }
          } catch { setErro('Erro de conexão') }
        }
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
          onLogin(data.user, token || 'token-admin')
        } else {
          onLogin({ nome: 'Admin', role: 'admin' }, 'token-admin')
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
        <div className="login-logo"><IconPizza size={48} /></div>
        <h2>Admin Israelita Pizzas</h2>
        <p className="login-desc">Faça login para acessar o painel administrativo</p>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Senha de administrador"
            value={senha}
            onChange={e => { setSenha(e.target.value); setErro('') }}
            autoFocus
          />
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" className="btn-add btn-full" disabled={loading}>
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

  return (
    <>
      <div className="admin-header">
        <h2>Gerenciar Cardápio</h2>
        <div className="admin-header-actions">
          <button className="btn-add" onClick={() => { setEditando(null); setMostrarForm(true) }}>+ Novo Item</button>
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
      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Qualidade</th><th>Categoria</th><th>Preço</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {menu.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.nome}</td>
              <td><span className={`tipo-badge tipo-${item.tipo || 'produto'}`}>{item.tipo === 'sabor' ? 'Sabor' : item.tipo === 'tamanho' ? 'Tamanho' : 'Produto'}</span></td>
              <td>
                {item.tipo === 'sabor' ? (
                  <span className={`tipo-badge ${item.classificacao === 'tradicional' ? 'tipo-tradicional' : item.classificacao === 'especial' ? 'tipo-especial' : item.classificacao === 'nobre' ? 'tipo-nobre' : ''}`}>
                    {item.classificacao ? item.classificacao.charAt(0).toUpperCase() + item.classificacao.slice(1) : '-'}
                  </span>
                ) : '-'}
              </td>
              <td>{item.categoria}</td>
              <td>
                {item.tipo === 'sabor' ? '-' : item.tipo === 'tamanho' ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {['Tradicional', 'Especial', 'Nobre'].map(t => {
                      const key = 'preco_' + t.toLowerCase()
                      return item[key] ? `${t[0]}: R$${item[key].toFixed(2)}` : ''
                    }).filter(Boolean).join(' / ') || '-'}
                  </span>
                ) : `R$ ${item.preco?.toFixed(2)}`}
              </td>
              <td className="acoes">
                <button className="btn-edit" onClick={() => { setEditando(item); setMostrarForm(true) }}>Editar</button>
                <button className="btn-del" onClick={() => deletar(item.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="produto">Produto</option>
            <option value="sabor">Sabor de Pizza</option>
            <option value="tamanho">Tamanho de Pizza</option>
          </select>
          {form.tipo === 'produto' && (
            <input type="number" step="0.01" placeholder="Preço" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} required />
          )}
          {form.tipo === 'sabor' && (
            <select value={form.classificacao} onChange={e => setForm({ ...form, classificacao: e.target.value })}>
              <option value="">Sem classificação</option>
              <option value="tradicional">Tradicional</option>
              <option value="especial">Especial</option>
              <option value="nobre">Nobre</option>
            </select>
          )}
          {form.tipo === 'tamanho' && (
            <>
              <input type="number" min="1" max="4" placeholder="Máx. de sabores" value={form.maxSabores} onChange={e => setForm({ ...form, maxSabores: parseInt(e.target.value) || '' })} required />
              <p className="settings-label" style={{ marginTop: 8 }}>Preços por qualidade:</p>
              <input type="number" step="0.01" placeholder="Preço Tradicional" value={form.preco_tradicional} onChange={e => setForm({ ...form, preco_tradicional: e.target.value })} />
              <input type="number" step="0.01" placeholder="Preço Especial" value={form.preco_especial} onChange={e => setForm({ ...form, preco_especial: e.target.value })} />
              <input type="number" step="0.01" placeholder="Preço Nobre" value={form.preco_nobre} onChange={e => setForm({ ...form, preco_nobre: e.target.value })} />
            </>
          )}
          <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
            <option>Pizzas Salgadas</option>
            <option>Pizzas Doces</option>
            <option>Bebidas</option>
            <option>Porções</option>
            <option>Sobremesas</option>
            <option>Tamanhos de Pizza</option>
          </select>
          <input placeholder="URL da imagem (opcional)" value={form.imagem} onChange={e => setForm({ ...form, imagem: e.target.value })} />
          <div className="form-actions">
            <button type="submit" className="btn-add">Salvar</button>
            <button type="button" className="btn-del" onClick={onCancelar}>Cancelar</button>
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
    const restante = 300000 - (Date.now() - new Date(data).getTime())
    if (restante <= 0) return 'Cancelado'
    const min = Math.floor(restante / 60000)
    const seg = Math.floor((restante % 60000) / 1000)
    return `${min}:${seg.toString().padStart(2, '0')}`
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'À caminho', entregador_proximo: 'Entregador Próximo', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', liberado: 'status-liberado', entregador_proximo: 'status-entregador_proximo', entregue: 'status-entregue', recusado: 'status-recusado' }
  const FILTROS = ['pendente', 'aceito', 'liberado', 'entregador_proximo', 'entregue', 'recusado', 'todos']

  return (
    <>
      <div className="admin-header">
        <h2>Pedidos Recebidos</h2>
        <div className="filtro-status">
          {FILTROS.map(s => {
            const count = s === 'todos' ? ordenados.length : ordenados.filter(p => p.status === s).length
            return (
              <button key={s} className={`cat-btn ${filtro === s ? 'active' : ''}`} onClick={() => setFiltro(s)}>
                {s === 'todos' ? 'Todos' : statusLabel[s]}
                <span className={`status-count-badge ${count === 0 ? 'zero' : ''}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      {filtrados.length === 0 ? (
        <div className="empty-state"><p>Nenhum pedido hoje</p></div>
      ) : (
        <div className="pedidos-lista">
          {filtrados.map(pedido => (
            <div key={pedido.id} className={`pedido-card ${pedido.status}${pedido.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
              <div className="pedido-header">
                <strong>Pedido #{pedido.id}</strong>
                <span className={`status-badge ${statusClass[pedido.status]}`}>{statusLabel[pedido.status]}</span>
              </div>
              <div className="pedido-body">
                <div className="pedido-cliente">
                  <span className="pedido-cliente-nome">{pedido.cliente?.nome}</span>
                  <span className="pedido-cliente-tel">{pedido.cliente?.telefone}</span>
                </div>
                <div className="pedido-endereco"><IconPin /> {pedido.cliente?.endereco || 'Não informado'}</div>
                <div className="pedido-meta">
                  <span className="pedido-data"><IconClock /> {new Date(pedido.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="pedido-valor">R$ {pedido.total?.toFixed(2)}</span>
                  {pedido.status === 'pendente' && pedido.data && (
                    <span className={`pedido-timer ${tempoRestante(pedido.data) === 'Cancelado' ? 'timer-expirado' : ''}`}><IconTimer /> {tempoRestante(pedido.data)}</span>
                  )}
                </div>
                <div className="pedido-itens">
                  {pedido.itens?.map(item => (
                    <span key={item.id} className="pedido-item">{item.qtd}x {item.nome}</span>
                  ))}
                </div>
              </div>
              <div className="pedido-actions">
                {pedido.status === 'pendente' && (
                  <>
                    <button className="btn-aceitar" onClick={() => atualizarStatus(pedido.id, 'aceito')}><IconCheck /> Aceitar</button>
                    <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}><IconClose /> Recusar</button>
                  </>
                )}
                {pedido.status === 'aceito' && (
                  <>
                    <button className="btn-liberar" onClick={() => atualizarStatus(pedido.id, 'liberado')}><IconTruck /> Liberar</button>
                    <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}><IconClose /> Recusar</button>
                  </>
                )}
                {pedido.status === 'liberado' && (
                  <>
                    <button className="btn-aceitar" onClick={() => atualizarStatus(pedido.id, 'entregue')}><IconCheckCircle /> Entregue</button>
                    <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}><IconClose /> Recusar</button>
                  </>
                )}
                {pedido.status === 'entregador_proximo' && (
                  <>
                    <button className="btn-aceitar" onClick={() => atualizarStatus(pedido.id, 'entregue')}><IconCheckCircle /> Entregue</button>
                    <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}><IconClose /> Recusar</button>
                  </>
                )}
              </div>
            </div>
          ))}
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
      <div className="admin-header">
        <h2>Resumo Financeiro</h2>
      </div>
      <div className="financeiro-grid">
        <div className="fin-card">
          <span className="fin-label">Total de Pedidos</span>
          <span className="fin-value">{stats.totalPedidos}</span>
        </div>
        <div className="fin-card">
          <span className="fin-label">Receita Total (Entregues)</span>
          <span className="fin-value">R$ {stats.totalReceita.toFixed(2)}</span>
        </div>
        <div className="fin-card fin-pendente">
          <span className="fin-label">Receita Pendente (Aceitos)</span>
          <span className="fin-value">R$ {stats.receitaPendente.toFixed(2)}</span>
        </div>
        <div className="fin-card">
          <span className="fin-label">Pendentes</span>
          <span className="fin-value">{stats.pendentes}</span>
        </div>
        <div className="fin-card">
          <span className="fin-label">Aceitos</span>
          <span className="fin-value">{stats.aceitos}</span>
        </div>
        <div className="fin-card">
          <span className="fin-label">Entregues</span>
          <span className="fin-value">{stats.entregues}</span>
        </div>
        <div className="fin-card">
          <span className="fin-label">Recusados</span>
          <span className="fin-value">{stats.recusados}</span>
        </div>
      </div>
    </>
  )
}

function RastreioPage() {
  const [pos, setPos] = useState(null)
  const [status, setStatus] = useState('desconectado')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [motoboyNome, setMotoboyNome] = useState('')

  useEffect(() => {
    let mounted = true
    const buscar = () => {
      fetch(`${API}/motoboy/position`)
        .then(r => r.json())
        .then(data => {
          if (!mounted) return
          if (data?.lat && data?.lng) {
            setPos({ lat: data.lat, lng: data.lng })
            const diff = Date.now() - (data.timestamp || 0)
            setStatus(diff < 45000 ? 'conectado' : 'perdendo_sinal')
            setUltimaAtualizacao(data.timestamp)
            if (data.nome) setMotoboyNome(data.nome)
          } else {
            setPos(null)
            setStatus('desconectado')
            setUltimaAtualizacao(null)
          }
        })
        .catch(() => { if (mounted) setStatus('desconectado') })
    }
    buscar()
    const id = setInterval(buscar, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    const verificar = () => {
      if (ultimaAtualizacao && Date.now() - ultimaAtualizacao > 45000) setStatus('perdendo_sinal')
    }
    const id = setInterval(verificar, 5000)
    return () => clearInterval(id)
  }, [ultimaAtualizacao])

  const center = pos || { lat: -25.4290, lng: -49.2671 }

  const getStatusText = () => {
    if (status === 'conectado') return 'Online'
    if (!ultimaAtualizacao) return 'Offline'
    const diffMin = Math.floor((Date.now() - ultimaAtualizacao) / 60000)
    if (diffMin < 1) return 'Online'
    return `${diffMin} min offline`
  }

  const statusColor = { conectado: '#43A047', perdendo_sinal: '#FF8F00', desconectado: '#E53935' }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', flex: 1 }}><IconPin /> Rastreio do Motoboy</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '50px', background: `${statusColor[status]}15`, border: `2px solid ${statusColor[status]}` }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor[status], animation: status === 'conectado' ? 'motoboyBtnPulse 1s infinite alternate' : 'none' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: statusColor[status] }}>{getStatusText()}</span>
        </div>
      </div>
      {!pos && status === 'desconectado' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 12 }}><IconScooter size={48} /></div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>Motoboy desconectado</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Aguardando sinal do motoboy...</p>
        </div>
      )}
      {pos && (
        <div style={{ height: 'calc(100vh - 220px)', minHeight: 300, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <MapContainer center={[center.lat, center.lng]} zoom={15} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pos && (
              <Marker position={[pos.lat, pos.lng]} icon={L.divIcon({
                className: '',
                html: `<div class="motoboy-marker-info"><div class="motoboy-marker-nome">${motoboyNome || 'Motoboy'}</div><div class="motoboy-marker-status" style="border-color:${statusColor[status]};color:${statusColor[status]}">${getStatusText()}</div><svg viewBox="0 0 24 36" width="28" height="42"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${statusColor[status]}"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg><div class="motoboy-marker-pulse"></div></div>`,
                iconSize: [28, 42],
                iconAnchor: [14, 42],
              })}>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}
      {(pos || ultimaAtualizacao) && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {motoboyNome && <span style={{ fontWeight: 600 }}>{motoboyNome}</span>} · Última atualização: {ultimaAtualizacao ? new Date(ultimaAtualizacao).toLocaleTimeString('pt-BR') : '—'}
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
      <div className="admin-header"><h2>Dados da Pizzaria</h2></div>
      <div className="pizzaria-form">
        <div className="pizzaria-form-row">
          <label>CNPJ</label>
          <input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} />
        </div>
        <div className="pizzaria-form-row">
          <label>Nome Fantasia</label>
          <input placeholder="Israelita Pizzas" value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
        </div>
        <div className="pizzaria-form-row">
          <label>Razão Social</label>
          <input placeholder="Razão Social" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
        </div>
        <div className="pizzaria-form-row">
          <label>Telefone</label>
          <input placeholder="(41) 99999-9999" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
        </div>
        <div className="pizzaria-form-row">
          <label>CEP</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input placeholder="82840-080" value={form.cep} onChange={e => handleCepChange(e.target.value)} />
            {buscandoCep && <span className="endereco-loading">Consultando...</span>}
          </div>
        </div>
        <div className="pizzaria-form-row pizzaria-form-row-duplo">
          <div className="pizzaria-form-field">
            <label>Rua</label>
            <input placeholder="Rua" value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} />
          </div>
          <div className="pizzaria-form-field pizzaria-form-field-num">
            <label>Nº</label>
            <input placeholder="Nº" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
          </div>
        </div>
        <div className="pizzaria-form-row">
          <label>Complemento</label>
          <input placeholder="Complemento" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} />
        </div>
        <div className="pizzaria-form-row pizzaria-form-row-triplo">
          <div className="pizzaria-form-field">
            <label>Bairro</label>
            <input placeholder="Bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
          </div>
          <div className="pizzaria-form-field">
            <label>Cidade</label>
            <input placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
          </div>
          <div className="pizzaria-form-field pizzaria-form-field-uf">
            <label>UF</label>
            <input placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
          </div>
        </div>
        <div className="pizzaria-form-row">
          <label>Localização</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Latitude" value={form.lat || ''} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} style={{width:160}} />
            <input placeholder="Longitude" value={form.lng || ''} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} style={{width:160}} />
            <button className="endereco-mapa-btn" type="button" onClick={() => setMostrarMapaPizzaria(true)}><IconPin /> Marcar no mapa</button>
          </div>
        </div>
        {msg && <p className={`pizzaria-msg ${msg.includes('sucesso') ? 'pizzaria-msg-ok' : ''}`}>{msg}</p>}
        <button className="btn-add" onClick={handleSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
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
      if (res.ok) setUsuarios(await res.json())
    } catch {}
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
      <div className="admin-header">
        <h2><IconLock /> Gerenciar Permissões</h2>
        <div className="filtro-status">
          {['todas', 'cliente', 'motoboy', 'atendente', 'financeiro', 'admin'].map(r => (
            <button key={r} className={`cat-btn ${filtroRole === r ? 'active' : ''}`} onClick={() => setFiltroRole(r)}>
              {r === 'todas' ? 'Todas' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className="pizzaria-msg pizzaria-msg-ok" style={{marginBottom:12}}>{msg}</p>}
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
                <span className="tipo-badge" style={{ background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role], border: '1px solid ' + ROLE_COLORS[u.role] + '44' }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                <span className="tipo-badge" style={{ background: STATUS_COLORS[u.status] + '22', color: STATUS_COLORS[u.status], border: '1px solid ' + STATUS_COLORS[u.status] + '44' }}>
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
                    <button className="btn-add" onClick={() => alterarRole(u.id)}>Salvar</button>
                    <button className="btn-del" onClick={() => setEditandoId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn-edit" onClick={() => { setEditandoId(u.id); setNovaRole(''); setNovoStatus('') }}>Editar permissão</button>
              )}
            </div>
          ))}
        </div>
      )}
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
      if (data[0]) { setLat(parseFloat(data[0].lat)); setLng(parseFloat(data[0].lon)); if (mapRef.current) mapRef.current.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 17) }
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
          <h3><IconPin /> Marcar Local Exato</h3>
          <button className="modal-close" onClick={onClose}><IconClose /></button>
        </div>
        {buscando ? (
          <div className="mapa-loading"><div className="mapa-loading-icon"><IconSearch size={32} /></div><p>Localizando...</p></div>
        ) : !pronto ? null : (
          <>
            <div className="mapa-search">
              <input type="text" placeholder="Buscar endereço..." value={buscaEndereco} onChange={e => { setBuscaEndereco(e.target.value); setErroBusca('') }} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              <button onClick={handleSearch} disabled={buscandoEndereco}>{buscandoEndereco ? '...' : 'Buscar'}</button>
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
              <button className="btn-del" onClick={onClose}>Cancelar</button>
              <button className="btn-add" onClick={() => { onConfirm({ lat, lng }); onClose() }}><IconCheckCircle /> Confirmar</button>
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
