import React, { useState, useEffect, useRef } from 'react'


const API = '/api'

function App() {
  const [pagina, setPagina] = useState('cardapio')
  const [carrinho, setCarrinho] = useState([])
  const [adminAutenticado, setAdminAutenticado] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'classic')
  const [font, setFont] = useState(() => localStorage.getItem('appFont') || 'classico')
  const [pizzaEditando, setPizzaEditando] = useState(null)
  const [bannerApp, setBannerApp] = useState({ texto: '', key: 0 })
  const [cartOpen, setCartOpen] = useState(false)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [mostrarAuth, setMostrarAuth] = useState(false)
  const [cliente, setCliente] = useState({ nome: '', telefone: '', endereco: '' })
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [pedidoCriadoId, setPedidoCriadoId] = useState(null)
  const [pendentesCount, setPendentesCount] = useState(0)
  const pendentesRef = useRef(0)
  const alarmTimer = useRef(null)
  const alarmCtx = useRef(null)

  useEffect(() => {
    if (!bannerApp.key) return
    const t = setTimeout(() => setBannerApp({ texto: '', key: 0 }), 3000)
    return () => clearTimeout(t)
  }, [bannerApp.key])

  const tocarAlarme = () => {
    try {
      if (alarmCtx.current) alarmCtx.current.close()
      alarmCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = alarmCtx.current
      const tocarBeep = () => {
        if (!ctx || ctx.state === 'closed') return
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'square'
          osc.frequency.value = 880 + i * 60
          gain.gain.setValueAtTime(0.15, t + i * 0.12)
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.1)
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.1)
        }
      }
      tocarBeep()
      alarmTimer.current = setInterval(tocarBeep, 3000)
    } catch (_) {}
  }

  const pararAlarme = () => {
    if (alarmTimer.current) { clearInterval(alarmTimer.current); alarmTimer.current = null }
    if (alarmCtx.current) { alarmCtx.current.close(); alarmCtx.current = null }
  }

  useEffect(() => {
    if (!adminAutenticado) { pararAlarme(); setPendentesCount(0); pendentesRef.current = 0; return }
    const verificar = () => {
      fetch(`${API}/orders`)
        .then(r => r.json())
        .then(data => {
          const pendentes = data.filter(p => p.status === 'pendente').length
          if (pendentes > pendentesRef.current) tocarAlarme()
          else if (pendentes === 0) pararAlarme()
          pendentesRef.current = pendentes
          setPendentesCount(pendentes)
        })
        .catch(() => {})
    }
    verificar()
    const id = setInterval(verificar, 5000)
    return () => { clearInterval(id); pararAlarme() }
  }, [adminAutenticado])

  const tocarNotificacao = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime
      osc.frequency.setValueAtTime(660, t)
      osc.frequency.setValueAtTime(880, t + 0.12)
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
      osc.start(t); osc.stop(t + 0.4)
    } catch (_) {}
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('adminAuth')
    if (saved === 'true') setAdminAutenticado(true)
  }, [])

  const adicionarAoCarrinho = (item) => {
    setCarrinho(prev => {
      if (item.tipo === 'pizza') {
        return [...prev, { ...item, qtd: 1 }]
      }
      const existente = prev.find(i => i.id === item.id && i.tipo !== 'pizza')
      if (existente) {
        return prev.map(i => (i.id === item.id && i.tipo !== 'pizza') ? { ...i, qtd: i.qtd + 1 } : i)
      }
      return [...prev, { ...item, qtd: 1 }]
    })
  }

  const removerDoCarrinho = (itemId) => {
    setCarrinho(prev => {
      const existente = prev.find(i => i.id === itemId)
      if (existente?.qtd > 1) {
        return prev.map(i => i.id === itemId ? { ...i, qtd: i.qtd - 1 } : i)
      }
      return prev.filter(i => i.id !== itemId)
    })
  }

  const editarPizza = (pizza) => {
    setCarrinho(prev => prev.filter(i => i.id !== pizza.id))
    setPizzaEditando(pizza)
    setPagina('cardapio')
  }

  const limparCarrinho = () => setCarrinho([])

  const finalizarPedido = async () => {
    if (!cliente.nome || !cliente.telefone) return alert('Preencha nome e telefone')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cliente, itens: carrinho, total: totalCarrinho })
      })
      if (!res.ok) return alert('Erro ao enviar pedido. Tente novamente.')
      const pedidoCriado = await res.json()
      setPedidoEnviado(true)
      setPedidoCriadoId(pedidoCriado.id)
      setCarrinho([])
      setCliente({ nome: '', telefone: '', endereco: '' })
      setTimeout(() => { setPedidoEnviado(false); setCartOpen(false); setPedidoCriadoId(null) }, 8000)
    } catch (_) { alert('Erro ao enviar pedido. Tente novamente.') }
  }

  const totalCarrinho = carrinho.reduce((sum, i) => sum + i.preco * i.qtd, 0)
  const qtdCarrinho = carrinho.reduce((sum, i) => sum + i.qtd, 0)

  const handleLogin = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', userToken)
    setMostrarAuth(false)
  }

  const handleLogout = () => {
    setUser(null)
    setToken('')
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setMostrarAuth(false)
  }

  return (
    <div className={`app theme-${theme} font-${font}`}>
      <div className="bg-decoration" aria-hidden="true">
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🧀</span>
        <span className="float-pizza">🌿</span>
        <span className="float-pizza">🍕</span>
      </div>
      <div className="neon-orbs" aria-hidden="true">
        <div className="neon-orb orb-1"></div>
        <div className="neon-orb orb-2"></div>
      </div>
      <div className="classic-orbs" aria-hidden="true">
        <div className="classic-orb orb-left"></div>
        <div className="classic-orb orb-right"></div>
      </div>
      {bannerApp.texto && <div className="banner-max-sabores" role="alert">{bannerApp.texto}</div>}
      <header className="header">
        <div className="header-content">
          <div className="logo" onClick={() => setPagina('cardapio')}>
            <span className="logo-icon">🍕</span>
            <div className="logo-text">
              <span className="logo-title">Israelita</span>
              <span className="logo-sub">Pizza · forno a lenha</span>
            </div>
          </div>
          <nav className="nav">
            <button className={`nav-btn ${pagina === 'cardapio' ? 'active' : ''}`} onClick={() => setPagina('cardapio')}>Cardápio</button>
            <button className={`nav-btn ${qtdCarrinho > 0 ? 'active' : ''}`} onClick={() => setCartOpen(true)}>
              Carrinho {qtdCarrinho > 0 && <span key={qtdCarrinho} className="badge">{qtdCarrinho}</span>}
            </button>
            <button className={`nav-btn ${pagina === 'meus-pedidos' ? 'active' : ''}`} onClick={() => setPagina('meus-pedidos')}>Meus Pedidos</button>
            {user ? (
              <div className="user-nav">
                <span className="user-nav-name">{user.nome}</span>
                <button className="nav-btn" onClick={handleLogout}>Sair</button>
              </div>
            ) : (
              <button className={`nav-btn ${mostrarAuth ? 'active' : ''}`} onClick={() => setMostrarAuth(true)}>Entrar / Cadastrar</button>
            )}
            <button className={`nav-btn ${pagina === 'admin' ? 'active' : ''}`} onClick={() => setPagina('admin')}>
              {adminAutenticado ? 'Admin' : 'Entrar'}
              {adminAutenticado && pendentesCount > 0 && <span key={pendentesCount} className="badge badge-alerta">{pendentesCount}</span>}
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {pagina === 'cardapio' && <Cardapio onAdicionar={adicionarAoCarrinho} onBanner={(msg) => { setBannerApp({ texto: msg, key: Date.now() }); tocarNotificacao() }} pizzaEditando={pizzaEditando} onPizzaEditDone={() => setPizzaEditando(null)} />}
        {pagina === 'admin' && (
          <AdminPanel
            autenticado={adminAutenticado}
            pendentesCount={pendentesCount}
            onLogin={() => {
              setAdminAutenticado(true)
              sessionStorage.setItem('adminAuth', 'true')
            }}
            onThemeChange={setTheme}
            onFontChange={setFont}
          />
        )}
        {pagina === 'meus-pedidos' && <MeusPedidos token={token} onVoltar={() => setPagina('cardapio')} />}
      </main>

      {mostrarAuth && (
        <AuthModal
          onLogin={handleLogin}
          onClose={() => setMostrarAuth(false)}
        />
      )}

      <nav className="bottom-nav">
        <button className={`bottom-nav-btn ${pagina === 'cardapio' ? 'active' : ''}`} onClick={() => setPagina('cardapio')}>
          <span className="bottom-nav-icon">🍕</span>
          <span className="bottom-nav-label">Cardápio</span>
        </button>
        <button className={`bottom-nav-btn ${qtdCarrinho > 0 ? 'active' : ''}`} onClick={() => setCartOpen(true)}>
          <span className="bottom-nav-icon">🛒</span>
          <span className="bottom-nav-label">Carrinho</span>
          {qtdCarrinho > 0 && <span key={qtdCarrinho} className="bottom-nav-badge">{qtdCarrinho}</span>}
        </button>
        <button className={`bottom-nav-btn ${pagina === 'meus-pedidos' ? 'active' : ''}`} onClick={() => setPagina('meus-pedidos')}>
          <span className="bottom-nav-icon">📋</span>
          <span className="bottom-nav-label">Pedidos</span>
        </button>
        <button className={`bottom-nav-btn ${pagina === 'admin' ? 'active' : ''}`} onClick={() => setPagina('admin')}>
          <span className="bottom-nav-icon">⚙️</span>
          <span className="bottom-nav-label">Admin</span>
          {adminAutenticado && pendentesCount > 0 && <span key={pendentesCount} className="bottom-nav-badge">{pendentesCount}</span>}
        </button>
      </nav>
      <footer className="classic-footer">
        <div className="footer-inner">
          <p className="footer-brand">Israelita Pizza</p>
          <p className="footer-info">Forno a lenha · Entrega 35min · Aberto até 23h</p>
          <p className="footer-copy">© 2026</p>
        </div>
      </footer>

      {cartOpen && (
        <div className="cart-drawer-overlay">
          <div className="cart-drawer-backdrop" onClick={() => setCartOpen(false)} />
          <aside className="cart-drawer-panel">
            <div className="cart-drawer-header">
              <div>
                <p className="cart-drawer-subtitle">Seu carrinho</p>
                <p className="cart-drawer-title">{qtdCarrinho} {qtdCarrinho === 1 ? 'item' : 'itens'}</p>
              </div>
              <button className="cart-drawer-close" onClick={() => setCartOpen(false)}>✕</button>
            </div>

            {pedidoEnviado ? (
              <div className="cart-drawer-body cart-drawer-success">
                <div className="cart-drawer-success-icon">✅</div>
                <p className="cart-drawer-success-title">Pedido enviado!</p>
                <p className="cart-drawer-success-desc">Obrigado, {cliente.nome}! Seu pedido foi registrado.</p>
                {pedidoCriadoId && <p className="cart-drawer-success-id">Nº do pedido: <strong>#{pedidoCriadoId}</strong></p>}
              </div>
            ) : carrinho.length === 0 ? (
              <div className="cart-drawer-body cart-drawer-empty">
                <div className="cart-drawer-empty-icon">🛒</div>
                <p className="cart-drawer-empty-title">Carrinho vazio</p>
                <p className="cart-drawer-empty-desc">Que tal montar uma pizza?</p>
                <button className="cart-drawer-empty-btn" onClick={() => setCartOpen(false)}>Ver cardápio</button>
              </div>
            ) : (
              <>
                <div className="cart-drawer-items">
                  {carrinho.map(item => (
                    <div key={item.id} className="cart-drawer-item">
                      <div className="cart-drawer-item-top">
                        <div className="cart-drawer-item-info">
                          <p className="cart-drawer-item-name">{item.nome}</p>
                          {item.tipo === 'pizza' && (
                            <p className="cart-drawer-item-detail">
                              {item.tamanho} · {item.sabores?.join(', ')}
                            </p>
                          )}
                        </div>
                        <button className="cart-drawer-item-remove" onClick={() => removerDoCarrinho(item.id)}>✕</button>
                      </div>
                      <div className="cart-drawer-item-bottom">
                        <div className="cart-drawer-qty">
                          <button onClick={() => removerDoCarrinho(item.id)}>−</button>
                          <span>{item.qtd}</span>
                          <button onClick={() => adicionarAoCarrinho(item)}>+</button>
                        </div>
                        <p className="cart-drawer-item-price">R$ {(item.preco * item.qtd).toFixed(2)}</p>
                      </div>
                      {item.tipo === 'pizza' && (
                        <button className="cart-drawer-item-edit" onClick={() => { editarPizza(item); setCartOpen(false) }}>
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="cart-drawer-footer">
                  <div className="cart-drawer-total-row">
                    <span className="cart-drawer-total-label">Subtotal</span>
                    <span className="cart-drawer-total-value">R$ {totalCarrinho.toFixed(2)}</span>
                  </div>
                  <div className="cart-drawer-total-row">
                    <span className="cart-drawer-total-label">Entrega</span>
                    <span className="cart-drawer-total-free">Grátis</span>
                  </div>
                  <div className="cart-drawer-total-divider" />
                  <div className="cart-drawer-total-row cart-drawer-total-final">
                    <span className="cart-drawer-total-final-label">Total</span>
                    <span className="cart-drawer-total-final-value">R$ {totalCarrinho.toFixed(2)}</span>
                  </div>
                  <div className="cart-drawer-form">
                    <input className="cart-drawer-input" placeholder="Nome" value={cliente.nome} onChange={e => setCliente({ ...cliente, nome: e.target.value })} />
                    <input className="cart-drawer-input" placeholder="Telefone" value={cliente.telefone} onChange={e => setCliente({ ...cliente, telefone: e.target.value })} />
                    <input className="cart-drawer-input" placeholder="Endereço" value={cliente.endereco} onChange={e => setCliente({ ...cliente, endereco: e.target.value })} />
                  </div>
                  <button className="cart-drawer-checkout" onClick={finalizarPedido}>Finalizar Pedido →</button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function AuthModal({ onLogin, onClose }) {
  const [modo, setModo] = useState('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const GOOGLE_CLIENT_ID = '433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com'

  const handleGoogleLogin = () => {
    if (!window.google?.accounts?.oauth2) return
    setErro('')
    google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.error) { setErro('Autenticação Google cancelada'); return }
        if (!response.id_token) { setErro('Token não recebido'); return }
        setLoading(true)
        try {
          const res = await fetch(`${API}/auth/google`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.id_token })
          })
          const data = await res.json()
          if (!res.ok) { setErro(data.erro || 'Erro Google'); return }
          onLogin(data.user, data.token)
        } catch (_) { setErro('Erro de conexão') }
        finally { setLoading(false) }
      },
    }).requestAccessToken()
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const endpoint = modo === 'login' ? '/auth/login' : '/auth/signup'
      const body = modo === 'login' ? { email, senha } : { nome, email, senha, telefone, endereco }
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Erro'); return }
      onLogin(data.user, data.token)
    } catch (_) { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-auth" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>{modo === 'login' ? 'Entrar' : 'Criar Conta'}</h3>
        <button className="google-btn" onClick={handleGoogleLogin} disabled={loading || !window.google?.accounts?.oauth2}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span>Entrar com Google</span>
        </button>
        <hr className="auth-divider" />
        <form onSubmit={handleSubmit}>
          {modo === 'signup' && (
            <input placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
          {modo === 'signup' && (
            <>
              <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} />
              <input placeholder="Endereço" value={endereco} onChange={e => setEndereco(e.target.value)} />
            </>
          )}
          {erro && <p className="erro">{erro}</p>}
          <button className="btn-add btn-full" disabled={loading}>{loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        <p className="auth-toggle">
          {modo === 'login' ? (
            <>Não tem conta? <button onClick={() => { setModo('signup'); setErro('') }}>Cadastre-se</button></>
          ) : (
            <>Já tem conta? <button onClick={() => { setModo('login'); setErro('') }}>Faça login</button></>
          )}
        </p>
        <hr className="auth-divider" />
        <p className="auth-info">Se preferir, faça o pedido sem cadastro. 
          Depois você pode <button onClick={() => { setModo('login'); setErro('') }}>vincular seu pedido</button> com o email usado na compra.</p>
      </div>
    </div>
  )
}

function MeusPedidos({ token, onVoltar }) {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscaId, setBuscaId] = useState('')
  const [pedidoBuscado, setPedidoBuscado] = useState(null)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${API}/orders/mine`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(data => { setPedidos(data); setLoading(false) }).catch(() => setLoading(false))
  }, [token])

  const buscarPorId = async () => {
    if (!buscaId) return
    try {
      const res = await fetch(`${API}/orders/${parseInt(buscaId)}`)
      if (!res.ok) return alert('Pedido não encontrado')
      const data = await res.json()
      setPedidoBuscado(data)
    } catch (_) { alert('Erro ao buscar pedido') }
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Aceito', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', entregue: 'status-entregue', recusado: 'status-recusado' }

  return (
    <div className="carrinho-page">
      <h2>Meus Pedidos</h2>

      {!token && (
        <div className="guest-tracking">
          <p>Faça login para ver seus pedidos, ou busque pelo número do pedido:</p>
          <div className="guest-tracking-row">
            <input placeholder="Nº do pedido" value={buscaId} onChange={e => setBuscaId(e.target.value)} />
            <button className="btn-add" onClick={buscarPorId}>Buscar</button>
          </div>
          {pedidoBuscado && (
            <div className={`pedido-card${pedidoBuscado.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
              <div className="pedido-header">
                <strong>Pedido #{pedidoBuscado.id}</strong>
                <span className={`status-badge ${statusClass[pedidoBuscado.status]}`}>{statusLabel[pedidoBuscado.status]}</span>
              </div>
              <div className="pedido-body">
                <p><strong>Cliente:</strong> {pedidoBuscado.cliente?.nome}</p>
                <p><strong>Data:</strong> {new Date(pedidoBuscado.data).toLocaleString('pt-BR')}</p>
                <div className="pedido-itens">
                  <strong>Itens:</strong>
                  {pedidoBuscado.itens?.map(item => (
                    <span key={item.id} className="pedido-item">{item.qtd}x {item.nome} - R$ {(item.preco * item.qtd).toFixed(2)}</span>
                  ))}
                </div>
                <p className="pedido-total"><strong>Total: R$ {pedidoBuscado.total?.toFixed(2)}</strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {token && loading && <p>Carregando...</p>}

      {token && !loading && pedidos.length === 0 && (
        <div className="empty-state">
          <p>Nenhum pedido encontrado</p>
        </div>
      )}

      {token && pedidos.length > 0 && (
        <div className="pedidos-lista">
          {pedidos.map(pedido => (
            <div key={pedido.id} className={`pedido-card${pedido.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
              <div className="pedido-header">
                <strong>Pedido #{pedido.id}</strong>
                <span className={`status-badge ${statusClass[pedido.status]}`}>{statusLabel[pedido.status]}</span>
              </div>
              <div className="pedido-body">
                <p><strong>Cliente:</strong> {pedido.cliente?.nome}</p>
                <p><strong>Data:</strong> {new Date(pedido.data).toLocaleString('pt-BR')}</p>
                <div className="pedido-itens">
                  <strong>Itens:</strong>
                  {pedido.itens?.map(item => (
                    <span key={item.id} className="pedido-item">{item.qtd}x {item.nome} - R$ {(item.preco * item.qtd).toFixed(2)}</span>
                  ))}
                </div>
                <p className="pedido-total"><strong>Total: R$ {pedido.total?.toFixed(2)}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="carrinho-actions" style={{ marginTop: 24 }}>
        <button className="btn-add" onClick={onVoltar}>← Voltar ao Cardápio</button>
      </div>
    </div>
  )
}

function Cardapio({ onAdicionar, onBanner, pizzaEditando, onPizzaEditDone }) {
  const [menu, setMenu] = useState([])
  const [categoria, setCategoria] = useState('Todas')
  const [tamanhoSel, setTamanhoSel] = useState(null)
  const [saboresSel, setSaboresSel] = useState([])
  const [buscaSabor, setBuscaSabor] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!pizzaEditando || menu.length === 0) return
    const tamanhoMatch = menu.find(i => i.tipo === 'tamanho' && i.nome === pizzaEditando.tamanho)
    if (tamanhoMatch) {
      setTamanhoSel(tamanhoMatch)
      const saboresIds = pizzaEditando.sabores
        .map(nome => menu.find(i => i.tipo === 'sabor' && i.nome === nome)?.id)
        .filter(Boolean)
      setSaboresSel(saboresIds)
      setTimeout(() => {
        document.getElementById('sabores-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [pizzaEditando, menu])

  const settingsCover = localStorage.getItem('cardapioCoverUrl') || ''
  const settingsLogo = localStorage.getItem('cardapioLogoUrl') || ''
  const logoX = parseFloat(localStorage.getItem('cardapioLogoX')) || 50
  const logoY = parseFloat(localStorage.getItem('cardapioLogoY')) || 50
  const logoSize = parseFloat(localStorage.getItem('cardapioLogoSize')) || 100
  const settingsTitle = localStorage.getItem('cardapioTitle')
  const settingsSubtitle = localStorage.getItem('cardapioSubtitle')
  const layout = localStorage.getItem('cardapioLayout') || 'classic'
  const overlayRaw = parseFloat(localStorage.getItem('cardapioOverlay'))
  const overlayValue = isNaN(overlayRaw) ? 0 : overlayRaw

  let overlayBg = 'transparent'
  if (overlayValue > 0) overlayBg = `rgba(0,0,0,${overlayValue / 100})`
  else if (overlayValue < 0) overlayBg = `rgba(255,255,255,${Math.abs(overlayValue) / 100})`

  useEffect(() => {
    fetch(`${API}/menu`)
      .then(r => r.json())
      .then(data => {
        console.log("Dados do menu recebidos:", data)
        setMenu(data)
      })
      .catch(error => console.error("Erro ao buscar o menu:", error))
  }, [])

  const sabores = menu.filter(i => i.tipo === 'sabor')
  const tamanhos = menu.filter(i => i.tipo === 'tamanho')
  const produtos = menu.filter(i => i.tipo === 'produto')

  const categorias = ['Todas', ...new Set(produtos.map(i => i.categoria))]
  const filtrados = produtos.filter(i => {
    if (categoria !== 'Todas' && i.categoria !== categoria) return false
    return true
  })

  const fatiasMap = {
    'Broto': '4 fatias',
    'Média': '6 fatias',
    'Grande': '8 fatias',
    'Big': '10 fatias',
    'Gigante': '12 fatias',
  }

  const toggleSabor = (id) => {
    if (saboresSel.includes(id)) {
      setSaboresSel(saboresSel.filter(s => s !== id))
      setErro('')
      return
    }
    if (saboresSel.length >= tamanhoSel.maxSabores) {
      const tentou = saboresSel.length + 1
      const next = tamanhos
        .filter(t => t.maxSabores > tamanhoSel.maxSabores)
        .sort((a, b) => a.maxSabores - b.maxSabores)[0]
      let msg = `${tamanhoSel.nome}, máximo ${tamanhoSel.maxSabores} sabor${tamanhoSel.maxSabores > 1 ? 'es' : ''}.`
      if (next) msg += ` Se quiser ${tentou} sabores, escolha o tamanho ${next.nome}.`
      onBanner(msg)
      return
    }
    setErro('')
    setSaboresSel([...saboresSel, id])
  }

  const handleAdd = () => {
    if (saboresSel.length === 0) { setErro('Selecione pelo menos 1 sabor'); return }
    const saboresSelecionados = saboresSel.map(id => sabores.find(s => s.id === id)).filter(Boolean)
    const nomesSabores = saboresSelecionados.map(s => s?.nome).filter(Boolean)

    // Calcula preço conforme classificação dos sabores
    const precosPorQualidade = {
      tradicional: tamanhoSel.preco_tradicional || 0,
      especial: tamanhoSel.preco_especial || 0,
      nobre: tamanhoSel.preco_nobre || 0
    }
    const totalPrecos = saboresSelecionados.reduce((sum, s) => {
      const qual = s.classificacao || 'tradicional'
      return sum + (precosPorQualidade[qual] || 0)
    }, 0)
    const precoFinal = totalPrecos / saboresSelecionados.length

    onAdicionar({
      id: `pizza-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'pizza',
      nome: `Pizza ${tamanhoSel.nome} (${nomesSabores.join(', ')})`,
      tamanho: tamanhoSel.nome,
      sabores: nomesSabores,
      preco: precoFinal
    })
    setTamanhoSel(null)
    setSaboresSel([])
    setErro('')
    if (onPizzaEditDone) onPizzaEditDone()
  }

  return (
    <div className={`cardapio-page layout-${layout}`}>
      <div className="cardapio-hero">
        <div className="hero-bg">
          <img
            src={settingsCover || "/delicious-img/hero-pizza.jpg"}
            alt=""
            className="hero-bg-img"
          />
          <div className="hero-bg-gradient"></div>
        </div>
        <div className="hero-overlay" style={{ background: overlayBg }}></div>
        <div className="hero-content">
          <div className="hero-aberto-badge">
            <span className="hero-aberto-dot"></span>
            Aberto agora · 35min
          </div>
          <h2>{settingsTitle || 'Nosso Cardápio'}</h2>
          <p>{settingsSubtitle || 'As melhores pizzas artesanais da cidade'}</p>
        </div>
        {settingsLogo && (
          <img
            src={settingsLogo}
            alt="logo"
            className="hero-logo"
            style={{ left: `${logoX}%`, top: `${logoY}%`, '--logo-scale': logoSize / 100 }}
          />
        )}
        <div className="hero-decorative">
          <div className="hero-deco-glow"></div>
          <div className="hero-deco-image">
            <img src="/delicious-img/hero-pizza.jpg" alt="Pizza artesanal" />
            <div className="hero-deco-badge-hero">
              <span className="hero-deco-badge-label">desde 2008</span>
              <span className="hero-deco-badge-text">Receita da nonna</span>
            </div>
            <div className="hero-deco-price">R$ 48 · Margherita</div>
          </div>
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-n">48h</span>
          <span className="hero-stat-label">Fermentação natural</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-n">450°</span>
          <span className="hero-stat-label">Forno a lenha</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-n">4.9</span>
          <span className="hero-stat-label">★ avaliação</span>
        </div>
      </div>
      <div className="filtros">
          <div className="categorias">
            {categorias.map(c => (
              <button
                key={c}
                className={`cat-btn ${categoria === c ? 'active' : ''}`}
                onClick={() => setCategoria(c)}
              >{c}</button>
            ))}
          </div>
        </div>

      <div className="pizza-montar">
        <span className="neon-experiencia-label">Experiência Custom</span>
        <div className="montar-section-header classic-only">
          <p className="montar-section-label">A experiência</p>
          <h2 className="montar-section-title">Monte sua pizza</h2>
          <p className="montar-section-sub">Três passos. Mil combinações possíveis.</p>
        </div>
        <h3 className="montar-title">🍕 Monte sua Pizza</h3>
        <div className="step-indicator classic-only">
          <div className="step-circle">1</div>
          <h4 className="step-title">Escolha o tamanho</h4>
          <div className="step-line"></div>
          <div className={`step-circle ${tamanhoSel ? 'step-active' : ''}`}>2</div>
          <h4 className="step-title">Escolha os sabores</h4>
          <div className="step-line"></div>
          <div className={`step-circle ${saboresSel.length > 0 ? 'step-active' : ''}`}>3</div>
          <h4 className="step-title">Finalizar</h4>
        </div>
        <p className="sabores-label">Escolha o tamanho:</p>
        <div className="tamanhos-grid">
          {tamanhos.map(t => (
            <button
              key={t.id}
              className={`tamanho-btn ${tamanhoSel?.id === t.id ? 'active' : ''}`}
              onClick={() => { 
                setTamanhoSel(t); 
                setSaboresSel(prev => t.maxSabores >= prev.length ? prev : prev.slice(0, t.maxSabores))
                setBuscaSabor(''); 
                setErro('');
                setTimeout(() => {
                  document.getElementById('sabores-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }}
            >
              <strong>{t.nome}</strong>
              <span className="tamanho-fatias">{fatiasMap[t.nome] || ''}</span>
              <small>Até {t.maxSabores} sabor{t.maxSabores > 1 ? 'es' : ''}</small>
              <span className="tamanho-partir">a partir de</span>
              {t.preco_tradicional && <span className="tamanho-preco">R$ {t.preco_tradicional.toFixed(2)}</span>}
            </button>
          ))}
        </div>

        {tamanhoSel && (
          <div id="sabores-section">
            <p className="sabores-label">
              Selecione os sabores para {tamanhoSel.nome}
              <span className="sabores-count"> ({saboresSel.length}/{tamanhoSel.maxSabores})</span>
            </p>
            <input
              type="text"
              className="input-busca input-busca-sabor"
              placeholder="Buscar sabor por nome ou ingredientes..."
              value={buscaSabor}
              onChange={e => setBuscaSabor(e.target.value)}
            />
            <div className="sabores-grid">
              {sabores.filter(s => {
                if (!buscaSabor) return true
                const q = buscaSabor.toLowerCase()
                return s.nome.toLowerCase().includes(q) || (s.descricao || '').toLowerCase().includes(q)
              }).map(s => (
                <button
                  key={s.id}
                  className={`sabor-card ${saboresSel.includes(s.id) ? 'active' : ''}`}
                  onClick={() => toggleSabor(s.id)}
                >
                  <span className="sabor-card-nome">{s.nome}</span>
                  {s.descricao && <span className="sabor-card-desc">{s.descricao}</span>}
                  {s.classificacao && <span className={`sabor-qual tipo-badge tipo-${s.classificacao}`}>{s.classificacao}</span>}
                </button>
              ))}
            </div>
            {erro && <p className="erro">{erro}</p>}
            {(() => {
              const precosPorQualidade = {
                tradicional: tamanhoSel.preco_tradicional || 0,
                especial: tamanhoSel.preco_especial || 0,
                nobre: tamanhoSel.preco_nobre || 0
              }
              const saboresSelecionados = saboresSel.map(id => sabores.find(s => s.id === id)).filter(Boolean)
              const precoExibido = saboresSelecionados.length > 0
                ? saboresSelecionados.reduce((sum, s) => sum + (precosPorQualidade[s.classificacao || 'tradicional'] || 0), 0) / saboresSelecionados.length
                : 0
              return (
                <button
                  className="btn-add btn-montar-add"
                  onClick={handleAdd}
                  disabled={saboresSel.length === 0}
                >
                  Adicionar Pizza {tamanhoSel.nome}{precoExibido > 0 ? ` — R$ ${precoExibido.toFixed(2)}` : ''}
                </button>
              )
            })()}
          </div>
        )}
      </div>

      <div className="classic-summary-bar classic-only">
        <div className="summary-bar-inner">
          <div className="summary-icon">
            🍕
          </div>
          <div className="summary-info">
            <p className="summary-label">Sua pizza</p>
            <p className="summary-detail">
              {tamanhoSel ? tamanhoSel.nome : 'Escolha o tamanho'}
              {saboresSel.length > 0 && (
                <span className="summary-sabores">
                  {' · '}{saboresSel.map(id => sabores.find(s => s.id === id)?.nome).filter(Boolean).join(' + ')}
                </span>
              )}
            </p>
          </div>
          <div className="summary-price-area">
            <p className="summary-price-label">Total</p>
            <p className="summary-price">
              R$ {(() => {
                if (!tamanhoSel || saboresSel.length === 0) return '0,00'
                const precosPorQualidade = {
                  tradicional: tamanhoSel.preco_tradicional || 0,
                  especial: tamanhoSel.preco_especial || 0,
                  nobre: tamanhoSel.preco_nobre || 0
                }
                const tot = saboresSel.map(id => sabores.find(s => s.id === id)).filter(Boolean)
                  .reduce((sum, s) => sum + (precosPorQualidade[s.classificacao || 'tradicional'] || 0), 0)
                return (tot / saboresSel.length).toFixed(2)
              })()}
            </p>
          </div>
          <button
            className="summary-btn"
            onClick={handleAdd}
            disabled={saboresSel.length === 0}
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>

      {filtrados.length > 0 && (
        <>
          <h3 className="section-title">
            <span className="section-subtitle-label classic-only">Acompanha bem</span>
            Bebidas & extras
          </h3>
          <div className="menu-grid">
            {filtrados.map(item => (
              <div key={item.id} className="menu-card">
                <div className="card-img">
                  {item.imagem ? <img src={item.imagem} alt={item.nome} /> : <span className="emoji-placeholder">🥤</span>}
                </div>
                <div className="card-body">
                  <h3>{item.nome}</h3>
                  <p className="desc">{item.descricao}</p>
                  <p className="preco">R$ {item.preco.toFixed(2)}</p>
                  <button className="btn-add" onClick={() => onAdicionar(item)}>Adicionar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


function AdminPanel({ autenticado, onLogin, onThemeChange, onFontChange, pendentesCount }) {
  const [aba, setAba] = useState('cardapio')

  if (!autenticado) return <AdminLogin onLogin={onLogin} />

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        <button className={`tab-btn ${aba === 'cardapio' ? 'active' : ''}`} onClick={() => setAba('cardapio')}>Cardápio</button>
        <button className={`tab-btn ${aba === 'pedidos' ? 'active' : ''}`} onClick={() => setAba('pedidos')}>
          Pedidos
          {pendentesCount > 0 && <span className="tab-badge">{pendentesCount}</span>}
        </button>
        <button className={`tab-btn ${aba === 'financeiro' ? 'active' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
      </div>
      {aba === 'cardapio' && <AdminMenu onThemeChange={onThemeChange} onFontChange={onFontChange} />}
      {aba === 'pedidos' && <AdminOrders pendentesCount={pendentesCount} />}
      {aba === 'financeiro' && <AdminFinanceiro />}
    </div>
  )
}

function AdminMenu({ onThemeChange, onFontChange }) {
  const [menu, setMenu] = useState([])
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarConfig, setMostrarConfig] = useState(false)

  const carregar = () => fetch(`${API}/menu`).then(r => r.json()).then(setMenu)

  useEffect(() => { carregar() }, [])

  const deletar = async (id) => {
    if (!confirm('Deletar este item?')) return
    await fetch(`${API}/menu/${id}`, { method: 'DELETE' })
    carregar()
  }

  const handleConfigSaved = () => {
    setMostrarConfig(false)
  }

  return (
    <>
      <div className="admin-header">
        <h2>Gerenciar Cardápio</h2>
        <div className="admin-header-actions">
          <button className="btn-add btn-config" onClick={() => setMostrarConfig(true)}>⚙️ Configurações</button>
          <button className="btn-add" onClick={() => { setEditando(null); setMostrarForm(true) }}>+ Novo Item</button>
        </div>
      </div>
      {mostrarConfig && <CardapioSettings onClose={handleConfigSaved} onThemeChange={onThemeChange} onFontChange={onFontChange} />}
      {mostrarForm && (
        <MenuItemForm
          item={editando}
          onSalvar={async (dados) => {
            if (editando) {
              await fetch(`${API}/menu/${editando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
              })
            } else {
              await fetch(`${API}/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
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

function CardapioSettings({ onClose, onThemeChange, onFontChange }) {
  const [coverUrl, setCoverUrl] = useState(() => localStorage.getItem('cardapioCoverUrl') || '')
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('cardapioLogoUrl') || '')
  const [logoX, setLogoX] = useState(() => {
    const saved = localStorage.getItem('cardapioLogoX')
    return saved !== null ? parseFloat(saved) : 50
  })
  const [logoY, setLogoY] = useState(() => {
    const saved = localStorage.getItem('cardapioLogoY')
    return saved !== null ? parseFloat(saved) : 50
  })
  const [logoSize, setLogoSize] = useState(() => {
    const saved = localStorage.getItem('cardapioLogoSize')
    return saved !== null ? parseFloat(saved) : 100
  })
  const [title, setTitle] = useState(() => localStorage.getItem('cardapioTitle') ?? '')
  const [subtitle, setSubtitle] = useState(() => localStorage.getItem('cardapioSubtitle') ?? '')
  const [overlay, setOverlay] = useState(() => {
    const saved = localStorage.getItem('cardapioOverlay')
    return saved !== null ? parseFloat(saved) : 0
  })
  const [selTheme, setSelTheme] = useState(() => localStorage.getItem('appTheme') || 'classic')
  const [selFont, setSelFont] = useState(() => localStorage.getItem('appFont') || 'classico')
  const previewRef = useRef(null)
  const dragging = useRef(false)

  const handleMouseDown = (e) => {
    e.preventDefault()
    dragging.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e) => {
    if (!dragging.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setLogoX(Math.max(0, Math.min(100, x)))
    setLogoY(Math.max(0, Math.min(100, y)))
  }

  const handleMouseUp = () => {
    dragging.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleCoverFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCoverUrl(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleLogoFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoUrl(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = () => {
    localStorage.setItem('cardapioCoverUrl', coverUrl)
    localStorage.setItem('cardapioLogoUrl', logoUrl)
    localStorage.setItem('cardapioLogoX', logoX.toString())
    localStorage.setItem('cardapioLogoY', logoY.toString())
    localStorage.setItem('cardapioLogoSize', logoSize.toString())
    localStorage.setItem('cardapioTitle', title)
    localStorage.setItem('cardapioSubtitle', subtitle)
    localStorage.setItem('cardapioOverlay', overlay.toString())
    localStorage.setItem('appTheme', selTheme)
    localStorage.setItem('appFont', selFont)
    if (onThemeChange) onThemeChange(selTheme)
    if (onFontChange) onFontChange(selFont)
    onClose()
  }

  const overlayLabel = overlay === 0 ? 'Normal' : overlay > 0 ? `+${overlay}%` : `${overlay}%`

  const themes = [
    { id: 'classic', name: 'Clássico', desc: 'Vermelho e dourado', icon: '🔥', colors: ['#E53935', '#FF8F00'] },
    { id: 'elegance', name: 'Elegance', desc: 'Escuro com dourado', icon: '🌙', colors: ['#D4AF37', '#0A0A14'] },
    { id: 'vibrante', name: 'Vibrante', desc: 'Roxo e teal', icon: '✨', colors: ['#7B1FA2', '#00897B'] },
    { id: 'minimal', name: 'Minimal', desc: 'Limpo e sóbrio', icon: '○', colors: ['#546E7A', '#8D6E63'] },
    { id: 'noturno', name: 'Noturno', desc: 'Ciano e magenta', icon: '🌃', colors: ['#00BCD4', '#E040FB'] },
    { id: 'neon', name: 'Neon', desc: 'Roxo e teal elétrico', icon: '💜', colors: ['#BD00FF', '#00EEFC'] },
  ]

  const fonts = [
    { id: 'classico', name: 'Clássico', desc: 'Montserrat + Inter' },
    { id: 'serif', name: 'Serifado', desc: 'Playfair + Inter' },
    { id: 'moderno', name: 'Moderno', desc: 'Poppins + Inter' },
    { id: 'system', name: 'Sistema', desc: 'Nativas do sistema' },
  ]

  const overlayBg = overlay > 0 ? `rgba(0,0,0,${overlay / 100})` : overlay < 0 ? `rgba(255,255,255,${Math.abs(overlay) / 100})` : 'transparent'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-config" onClick={e => e.stopPropagation()}>
        <h3>⚙️ Configurações do Cardápio</h3>

        <div className="settings-two-cols">

          <div>
            <p className="settings-label">📷 Imagem de Capa</p>
            <div className="settings-file-row">
              <input className="settings-file-input" id="coverFile" type="file" accept="image/*" onChange={handleCoverFile} />
              <label className="settings-file-label" htmlFor="coverFile">📂 Escolher</label>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {coverUrl ? (coverUrl.startsWith('data:') ? 'Arquivo' : 'URL') : 'Nenhum'}
              </span>
            </div>
            <input placeholder="Ou cole uma URL..." value={coverUrl} onChange={e => setCoverUrl(e.target.value)} />

            <div className="settings-divider"></div>

            <p className="settings-label">🖼️ Logo</p>
            <div className="settings-file-row">
              <input className="settings-file-input" id="logoFile" type="file" accept="image/*" onChange={handleLogoFile} />
              <label className="settings-file-label" htmlFor="logoFile">📂 Escolher</label>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {logoUrl ? (logoUrl.startsWith('data:') ? 'Arquivo' : 'URL') : 'Nenhum'}
              </span>
            </div>
            <input placeholder="Ou cole uma URL..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />

            <div className="settings-range-row">
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Tamanho:</span>
              <input type="range" className="settings-range" min="30" max="200" value={logoSize} onChange={e => setLogoSize(parseFloat(e.target.value))} />
              <span className="settings-range-value">{logoSize}%</span>
            </div>

            <div className="settings-divider"></div>

            <p className="settings-label">✏️ Texto</p>
            <input placeholder="Título (vazio = ocultar)" value={title} onChange={e => setTitle(e.target.value)} />
            <input placeholder="Subtítulo" value={subtitle} onChange={e => setSubtitle(e.target.value)} />

            <div className="settings-divider"></div>

            <p className="settings-label">🎚️ Escurecimento</p>
            <div className="settings-range-row">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Claro</span>
              <input type="range" className="settings-range" min="-100" max="100" value={overlay} onChange={e => setOverlay(parseFloat(e.target.value))} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Escuro</span>
              <span className="settings-range-value">{overlayLabel}</span>
            </div>
          </div>

          <div>
            <p className="settings-label">🎨 Tema</p>
            <div className="settings-selector-grid">
              {themes.map(t => (
                <div
                  key={t.id}
                  className={`settings-selector-card ${selTheme === t.id ? 'active' : ''}`}
                  onClick={() => setSelTheme(t.id)}
                >
                  <div className="theme-swatch">
                    <span>{t.icon}</span>
                    <span style={{ background: t.colors[0] }}></span>
                    <span style={{ background: t.colors[1] }}></span>
                  </div>
                  <span className="selector-name">{t.name}</span>
                  <span className="selector-desc">{t.desc}</span>
                </div>
              ))}
            </div>

            <p className="settings-label">🔤 Fonte</p>
            <div className="settings-selector-grid">
              {fonts.map(f => (
                <div
                  key={f.id}
                  className={`settings-selector-card ${selFont === f.id ? 'active' : ''}`}
                  onClick={() => setSelFont(f.id)}
                >
                  <span className="selector-icon" style={{ fontSize: '1rem', fontFamily: f.id === 'classico' ? 'Montserrat' : f.id === 'serif' ? 'Playfair Display' : f.id === 'moderno' ? 'Poppins' : 'sans-serif' }}>
                    Aa
                  </span>
                  <span className="selector-name">{f.name}</span>
                  <span className="selector-desc">{f.desc}</span>
                </div>
              ))}
            </div>

            <div className="settings-divider"></div>

            <p className="settings-label">👁️ Prévia ao Vivo</p>
            <div className={`settings-preview theme-${selTheme} font-${selFont}`} ref={previewRef} style={{ height: '260px', position: 'relative' }}>
              <div className="cardapio-hero" style={{ margin: 0, minHeight: '260px', height: '100%', backgroundImage: coverUrl ? `url("${coverUrl}")` : undefined }}>
                <div className="hero-overlay" style={{ background: overlayBg }}></div>
                {title !== '' && (
                  <div className="hero-content" style={{ padding: '20px 16px' }}>
                    <h2 style={{ fontSize: '1.4rem' }}>{title || 'Título'}</h2>
                    {subtitle !== '' && <p style={{ fontSize: '0.8rem' }}>{subtitle || 'Subtítulo'}</p>}
                  </div>
                )}
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="logo"
                    className="hero-logo"
                    style={{ left: `${logoX}%`, top: `${logoY}%`, '--logo-scale': logoSize / 100, pointerEvents: 'auto', cursor: 'grab' }}
                    onMouseDown={handleMouseDown}
                    draggable={false}
                  />
                )}
              </div>
              <div className="settings-preview-hint">↕ Arraste a logo para posicionar</div>
            </div>
          </div>

        </div>

        <div className="form-actions">
          <button className="btn-add" onClick={handleSave}>Salvar</button>
          <button className="btn-del" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function AdminOrders({ pendentesCount }) {
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
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'recusado' })
          }).then(() => carregar()).catch(() => {})
        }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [pedidos])

  const atualizarStatus = async (id, status) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    carregar()
  }

  const ordenados = [...pedidos].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
  const filtrados = (filtro === 'todos' ? ordenados : ordenados.filter(p => p.status === filtro))

  const tempoRestante = (data) => {
    if (!data) return ''
    const restante = 300000 - (Date.now() - new Date(data).getTime())
    if (restante <= 0) return 'Cancelado'
    const min = Math.floor(restante / 60000)
    const seg = Math.floor((restante % 60000) / 1000)
    return `${min}:${seg.toString().padStart(2, '0')}`
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Aceito', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', entregue: 'status-entregue', recusado: 'status-recusado' }

  return (
    <>
      <div className="admin-header">
        <h2>Pedidos Recebidos</h2>
        <div className="filtro-status">
          {['todos', 'pendente', 'aceito', 'entregue', 'recusado'].map(s => (
            <button key={s} className={`cat-btn ${filtro === s ? 'active' : ''}`} onClick={() => setFiltro(s)}>
              {s === 'todos' ? 'Todos' : statusLabel[s]}
            </button>
          ))}
        </div>
      </div>
      {filtrados.length === 0 ? (
        <div className="empty-state"><p>Nenhum pedido encontrado</p></div>
      ) : (
        <div className="pedidos-lista">
          {filtrados.map(pedido => (
            <div key={pedido.id} className={`pedido-card${pedido.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
              <div className="pedido-header">
                <strong>Pedido #{pedido.id}</strong>
                <span className={`status-badge ${statusClass[pedido.status]}`}>{statusLabel[pedido.status]}</span>
              </div>
              <div className="pedido-body">
                <p><strong>Cliente:</strong> {pedido.cliente?.nome}</p>
                <p><strong>Telefone:</strong> {pedido.cliente?.telefone}</p>
                <p><strong>Endereço:</strong> {pedido.cliente?.endereco || 'Não informado'}</p>
                <p><strong>Data:</strong> {new Date(pedido.data).toLocaleString('pt-BR')}</p>
                {pedido.status === 'pendente' && pedido.data && (
                  <p className="pedido-timer"><strong>⏱ Cancela em:</strong> <span className={`pedido-timer-value${tempoRestante(pedido.data) === 'Cancelado' ? ' timer-expirado' : ''}`}>{tempoRestante(pedido.data)}</span></p>
                )}
                <div className="pedido-itens">
                  <strong>Itens:</strong>
                  {pedido.itens?.map(item => (
                    <span key={item.id} className="pedido-item">{item.qtd}x {item.nome} - R$ {(item.preco * item.qtd).toFixed(2)}</span>
                  ))}
                </div>
                <p className="pedido-total"><strong>Total: R$ {pedido.total?.toFixed(2)}</strong></p>
              </div>
              {pedido.status === 'pendente' && (
                <div className="pedido-actions">
                  <button className="btn-aceitar" onClick={() => atualizarStatus(pedido.id, 'aceito')}>Aceitar</button>
                  <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}>Recusar</button>
                </div>
              )}
              {pedido.status === 'aceito' && (
                <div className="pedido-actions">
                  <button className="btn-aceitar" onClick={() => atualizarStatus(pedido.id, 'entregue')}>Marcar como Entregue</button>
                  <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}>Recusar</button>
                </div>
              )}
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

function MenuItemForm({ item, onSalvar, onCancelar }) {
  const [form, setForm] = useState(
    item || { nome: '', descricao: '', preco: '', categoria: 'Pizzas Salgadas', imagem: '', tipo: 'produto', maxSabores: '', classificacao: '', preco_tradicional: '', preco_especial: '', preco_nobre: '' }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const dados = { ...form }
    if (dados.tipo === 'produto') {
      dados.preco = parseFloat(dados.preco)
    } else {
      delete dados.preco
    }
    if (dados.tipo !== 'tamanho') {
      delete dados.maxSabores
      delete dados.preco_tradicional
      delete dados.preco_especial
      delete dados.preco_nobre
    }
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

function AdminLogin({ onLogin }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha })
    })
    const data = await res.json()
    if (data.autenticado) {
      onLogin()
    } else {
      setErro('Senha incorreta')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>🔐 Área Administrativa</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => { setSenha(e.target.value); setErro('') }}
            autoFocus
          />
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" className="btn-add">Entrar</button>
        </form>
      </div>
    </div>
  )
}

export default App

