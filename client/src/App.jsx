import React, { useState, useEffect, useRef } from 'react'
import { buscarCEP, formatCEP, formatEndereco } from './cepHelper'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const API = '/api'

function getSelectedAddress(user) {
  if (!user?.enderecos?.length) {
    return user?.endereco ? { rua: user.endereco } : null
  }
  return user.enderecos.find(a => a.id === user.enderecoSelecionado) || user.enderecos[0]
}

window.__googleCallback = (response) => {
  const s = window.__authSetters
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
        s.setUser && s.setUser(data.user);
        s.setToken && s.setToken(data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', data.token)
        s.setMostrarAuth && s.setMostrarAuth(false)
        if (!data.user.telefone || !data.user.endereco) {
          s.setCadastroForm && s.setCadastroForm({ nome: data.user.nome || '', telefone: data.user.telefone || '', endereco: data.user.endereco || '' })
          s.setCompletarCadastro && s.setCompletarCadastro(true)
        }
      } else if (s.setErro) s.setErro(data.erro || 'Erro ao autenticar')
    } catch (_) { if (s.setErro) s.setErro('Erro de conexão') }
  })()
}

function App() {
  const [pagina, setPagina] = useState('cardapio')
  const [carrinho, setCarrinho] = useState(() => {
    const saved = localStorage.getItem('carrinho_guest')
    return saved ? JSON.parse(saved) : []
  })
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
  const [completarCadastro, setCompletarCadastro] = useState(false)
  const [cadastroForm, setCadastroForm] = useState({ nome: '', telefone: '', endereco: '' })
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  const [mostrarEnderecoForm, setMostrarEnderecoForm] = useState(false)
  const pendentesRef = useRef(0)
  const alarmTimer = useRef(null)
  const alarmCtx = useRef(null)
  const carrinhoSyncTimer = useRef(null)
  window.__authSetters = window.__authSetters || {}

  useEffect(() => {
    if (!bannerApp.key) return
    const t = setTimeout(() => setBannerApp({ texto: '', key: 0 }), 3000)
    return () => clearTimeout(t)
  }, [bannerApp.key])

  useEffect(() => {
    if (!user || !token) return
    fetch(`${API}/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { 
        if (Array.isArray(data) && data.length) {
          setCarrinho(data)
        }
      })
      .catch(() => {})
  }, [user?.id])

  // Salvar carrinho no localStorage para usuários não logados
  useEffect(() => {
    if (!user || !token) {
      localStorage.setItem('carrinho_guest', JSON.stringify(carrinho))
    }
  }, [carrinho, user?.id])

  useEffect(() => {
    if (!user || !token) return
    if (carrinhoSyncTimer.current) clearTimeout(carrinhoSyncTimer.current)
    carrinhoSyncTimer.current = setTimeout(() => {
      fetch(`${API}/cart`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itens: carrinho })
      }).catch(() => {})
    }, 1000)
    return () => { if (carrinhoSyncTimer.current) clearTimeout(carrinhoSyncTimer.current) }
  }, [carrinho, user?.id])

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type !== 'google-login' || !event.data.accessToken) return
      fetch(`${API}/auth/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: event.data.accessToken })
      }).then(r => r.json()).then(data => {
        if (data.token && data.user) {
          setUser(data.user); setToken(data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
          localStorage.setItem('token', data.token)
          setMostrarAuth(false)
          if (!data.user.telefone || !data.user.endereco) {
            setCadastroForm({ nome: data.user.nome || '', telefone: data.user.telefone || '', endereco: data.user.endereco || '' })
            setCompletarCadastro(true)
          }
        }
      }).catch(() => {})
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

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
    const enderecoFinal = user?.nome && user?.telefone
      ? formatEndereco(getSelectedAddress(user)) || user.endereco || ''
      : ''
    const dadosCliente = user?.nome && user?.telefone
      ? { nome: user.nome, telefone: user.telefone, endereco: enderecoFinal }
      : cliente
    if (!dadosCliente.nome || !dadosCliente.telefone) return alert('Preencha nome e telefone')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cliente: dadosCliente, itens: carrinho, total: totalCarrinho })
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
    const guestCart = JSON.parse(localStorage.getItem('carrinho_guest') || '[]')
    setUser(userData)
    setToken(userToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', userToken)
    setMostrarAuth(false)
    // Carregar carrinho do servidor após login
    fetch(`${API}/cart`, { headers: { Authorization: `Bearer ${userToken}` } })
      .then(r => r.json())
      .then(serverCart => {
        if (Array.isArray(serverCart) && serverCart.length) {
          // Mesclar: prioriza carrinho do servidor, adiciona itens do guest que não existem
          const merged = [...serverCart]
          guestCart.forEach(gItem => {
            const exists = merged.find(sItem => sItem.id === gItem.id && sItem.tipo === gItem.tipo)
            if (!exists) merged.push(gItem)
            else exists.qtd += gItem.qtd
          })
          setCarrinho(merged)
          // Sincar carrinho mesclado no servidor
          fetch(`${API}/cart`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
            body: JSON.stringify({ itens: merged })
          }).catch(() => {})
        } else if (guestCart.length) {
          // Sem carrinho no servidor, enviar o do guest
          setCarrinho(guestCart)
          fetch(`${API}/cart`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
            body: JSON.stringify({ itens: guestCart })
          }).catch(() => {})
        }
      })
      .catch(() => { if (guestCart.length) setCarrinho(guestCart) })
    localStorage.removeItem('carrinho_guest')
  }

  const handleLogout = () => {
    setUser(null)
    setToken('')
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setMostrarAuth(false)
    // Manter carrinho no servidor, limpar local
    setCarrinho([])
  }

  Object.assign(window.__authSetters, { setUser, setToken, setMostrarAuth, setCadastroForm, setCompletarCadastro })

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
      {pagina !== 'motoboy' && (
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
              {adminAutenticado && (
                <button className={`nav-btn nav-btn-motoboy ${pagina === 'motoboy' ? 'active' : ''}`} onClick={() => setPagina('motoboy')}>
                  🏍️ Motoboy
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

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
        {pagina === 'motoboy' && <MotoboyPage onVoltar={() => setPagina('admin')} />}
      </main>

      {mostrarAuth && (
        <AuthModal
          onLogin={handleLogin}
          onClose={() => setMostrarAuth(false)}
        />
      )}
      {completarCadastro && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal modal-auth" onClick={e => e.stopPropagation()}>
            <h3>Complete seu cadastro</h3>
            <p style={{fontSize:'0.85rem',color:'var(--text-muted)',marginBottom:16}}>Preencha os dados que estão faltando para finalizar.</p>
            <input placeholder="Nome" value={cadastroForm.nome} onChange={e => setCadastroForm(f => ({...f, nome: e.target.value}))} required />
            <input placeholder="Telefone" value={cadastroForm.telefone} onChange={e => setCadastroForm(f => ({...f, telefone: e.target.value}))} required />
            <input placeholder="Endereço" value={cadastroForm.endereco} onChange={e => setCadastroForm(f => ({...f, endereco: e.target.value}))} required />
            <button className="btn-add btn-full" onClick={async () => {
              if (!cadastroForm.nome || !cadastroForm.telefone) return alert('Preencha nome e telefone')
              try {
                const res = await fetch(`${API}/auth/me`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(cadastroForm)
                })
                const data = await res.json()
                if (!res.ok) return alert(data.erro || 'Erro ao salvar')
                setUser(data.user); localStorage.setItem('user', JSON.stringify(data.user)); setToken(data.token); localStorage.setItem('token', data.token)
                setCompletarCadastro(false)
              } catch { alert('Erro de conexão') }
            }}>Salvar</button>
          </div>
        </div>
      )}
      {editandoEndereco && user && token && (
        <AddressModal
          user={user}
          token={token}
          onClose={() => setEditandoEndereco(false)}
          onSave={(update) => {
            const u = { ...user, ...update }
            setUser(u)
            localStorage.setItem('user', JSON.stringify(u))
          }}
        />
      )}
      {mostrarEnderecoForm && (
        <EnderecoFormModal
          onSave={(addr) => { setCliente(c => ({ ...c, endereco: addr })); setMostrarEnderecoForm(false) }}
          onClose={() => setMostrarEnderecoForm(false)}
        />
      )}
      
      {pagina !== 'motoboy' && (
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
          {adminAutenticado && (
            <button className={`bottom-nav-btn ${pagina === 'motoboy' ? 'active' : ''}`} onClick={() => setPagina('motoboy')}>
              <span className="bottom-nav-icon">🏍️</span>
              <span className="bottom-nav-label">Motoboy</span>
            </button>
          )}
        </nav>
      )}
      {pagina !== 'motoboy' && (
        <footer className="classic-footer">
          <div className="footer-inner">
            <p className="footer-brand">Israelita Pizza</p>
            <p className="footer-info">Forno a lenha · Entrega 35min · Aberto até 23h</p>
            <p className="footer-copy">© 2026</p>
          </div>
        </footer>
      )}

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
                  {(!user || !user.nome || !user.telefone) && (
                  <div className="cart-drawer-form">
                    <input className="cart-drawer-input" placeholder="Nome" value={cliente.nome} onChange={e => setCliente({ ...cliente, nome: e.target.value })} />
                    <input className="cart-drawer-input" placeholder="Telefone" value={cliente.telefone} onChange={e => setCliente({ ...cliente, telefone: e.target.value })} />
                    <button className="cart-drawer-address-btn" onClick={() => setMostrarEnderecoForm(true)}>
                      {cliente.endereco ? `📍 ${cliente.endereco}` : '+ Adicionar endereço'}
                    </button>
                  </div>
                  )}
                  {user?.nome && user?.telefone && (
                    <div className="cart-drawer-user-info">
                      <p className="cart-drawer-user-info-name">{user.nome}</p>
                      <p className="cart-drawer-user-info-phone">
                        {user.telefone}
                        {(() => {
                          const addr = getSelectedAddress(user)
                          return addr ? ` — ${formatEndereco(addr)}` : ''
                        })()}
                      </p>
                      <button className="cart-drawer-edit-address" onClick={() => setEditandoEndereco(true)}>Alterar endereço</button>
                    </div>
                  )}
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
  const [enderecoLat, setEnderecoLat] = useState(null)
  const [enderecoLng, setEnderecoLng] = useState(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarEnderecoModal, setMostrarEnderecoModal] = useState(false)
  const GOOGLE_CLIENT_ID = '433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com'
  window.__authSetters.setErro = setErro

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: window.__googleCallback
      })
      client.requestAccessToken()
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const endpoint = modo === 'login' ? '/auth/login' : '/auth/signup'
      const body = modo === 'login' ? { email, senha } : { nome, email, senha, telefone, endereco, endereco_lat: enderecoLat, endereco_lng: enderecoLng }
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
        <form onSubmit={handleSubmit}>
          {modo === 'signup' && (
            <input placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
          {modo === 'signup' && (
            <>
              <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} />
              {!mostrarEnderecoModal ? (
                <button
                  type="button"
                  className="cart-drawer-address-btn"
                  onClick={() => setMostrarEnderecoModal(true)}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {endereco ? `📍 ${endereco}` : '+ Adicionar endereço'}
                </button>
              ) : null}
            </>
          )}
          {erro && <p className="erro">{erro}</p>}
          <button className="btn-add btn-full" disabled={loading}>{loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        {mostrarEnderecoModal && (
          <EnderecoFormModal
            enderecoInicial={endereco}
            onSave={(addr, lat, lng) => { setEndereco(addr); setEnderecoLat(lat); setEnderecoLng(lng); setMostrarEnderecoModal(false); }}
            onClose={() => setMostrarEnderecoModal(false)}
          />
        )}
        <p className="auth-toggle">
          {modo === 'login' ? (
            <>Não tem conta? <button onClick={() => { setModo('signup'); setErro('') }}>Cadastre-se</button></>
          ) : (
            <>Já tem conta? <button onClick={() => { setModo('login'); setErro('') }}>Faça login</button></>
          )}
        </p>
        <button className="google-btn" onClick={handleGoogleLogin} disabled={loading || !window.google?.accounts?.oauth2}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span>Entrar com Google</span>
        </button>
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
  const [notificacaoLiberado, setNotificacaoLiberado] = useState(null)
  const prevStatusRef = useRef({})

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${API}/orders/mine`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(data => {
        setPedidos(data)
        setLoading(false)
        data.forEach(p => {
          const prevStatus = prevStatusRef.current[p.id]
          if (prevStatus && prevStatus !== 'liberado' && p.status === 'liberado') {
            tocarSomLiberado()
            setNotificacaoLiberado(p)
          }
          prevStatusRef.current[p.id] = p.status
        })
      }).catch(() => setLoading(false))
  }, [token])

  const tocarSomLiberado = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let toques = 0
      const tocar = () => {
        if (toques >= 5 || !ctx || ctx.state === 'closed') return
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 660 + i * 110
          gain.gain.setValueAtTime(0.2, t + i * 0.1)
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.3)
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.3)
        }
        toques++
        if (toques < 5) setTimeout(tocar, 1200)
      }
      tocar()
    } catch (_) {}
  }

  const buscarPorId = async () => {
    if (!buscaId) return
    try {
      const res = await fetch(`${API}/orders/${parseInt(buscaId)}`)
      if (!res.ok) return alert('Pedido não encontrado')
      const data = await res.json()
      setPedidoBuscado(data)
    } catch (_) { alert('Erro ao buscar pedido') }
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Aceito', liberado: 'Liberado p/ Entrega', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', liberado: 'status-liberado', entregue: 'status-entregue', recusado: 'status-recusado' }

  return (
    <div className="carrinho-page">
      <h2>Meus Pedidos</h2>

      {notificacaoLiberado && (
        <div className="liberado-notificacao">
          <div className="liberado-notificacao-conteudo">
            <span className="liberado-notificacao-icone">🛵</span>
            <div>
              <strong>Pedido #{notificacaoLiberado.id} saiu para entrega!</strong>
              <p>{notificacaoLiberado.cliente?.endereco}</p>
            </div>
            <button className="liberado-notificacao-fechar" onClick={() => setNotificacaoLiberado(null)}>✕</button>
          </div>
        </div>
      )}

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

  const statusLabel = { pendente: 'Pendente', aceito: 'Aceito', liberado: 'Liberado p/ Entrega', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', liberado: 'status-liberado', entregue: 'status-entregue', recusado: 'status-recusado' }

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
                  <button className="btn-liberar" onClick={() => atualizarStatus(pedido.id, 'liberado')}>Liberar para Entrega</button>
                  <button className="btn-recusar" onClick={() => atualizarStatus(pedido.id, 'recusado')}>Recusar</button>
                </div>
              )}
              {pedido.status === 'liberado' && (
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

function AddressModal({ user, token, onClose, onSave }) {
  const [enderecos, setEnderecos] = useState(() => {
    const enderecosList = user?.enderecos?.length ? user.enderecos
      : user?.endereco ? [{ id: 'addr1', rua: user.endereco }]
      : []
    console.log('[AddressModal] Endereços carregados:', JSON.stringify(enderecosList))
    return enderecosList
  })
  const [selecionado, setSelecionado] = useState(user?.enderecoSelecionado || enderecos[0]?.id || '')
  const [form, setForm] = useState({ cep: '', rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '' })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formErro, setFormErro] = useState('')
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [enderecoParaMapa, setEnderecoParaMapa] = useState('')
  const cepTimer = useRef(null)

  const handleCepChange = (value) => {
    const fmt = formatCEP(value)
    setForm(f => ({ ...f, cep: fmt }))
    const digits = fmt.replace(/\D/g, '')
    if (digits.length === 8) {
      if (cepTimer.current) clearTimeout(cepTimer.current)
      cepTimer.current = setTimeout(async () => {
        setBuscandoCep(true)
        const result = await buscarCEP(digits)
        if (result) setForm(f => ({ ...f, ...result }))
        setBuscandoCep(false)
      }, 300)
    }
  }

  const handleSelect = async (id) => {
    try {
      const res = await fetch(`${API}/auth/enderecos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enderecos, enderecoSelecionado: id })
      })
      const data = await res.json()
      if (res.ok) { setSelecionado(id); onSave({ enderecos: data.enderecos, endereco: data.endereco, enderecoSelecionado: id }) }
    } catch {}
  }

  const handleAdd = async () => {
    setFormErro('')
    if (!form.cep) { setFormErro('Preencha o CEP'); return }
    if (!form.rua) { setFormErro('Preencha a Rua'); return }
    if (!form.numero) { setFormErro('Preencha o Número'); return }
    const id = editandoId || 'addr' + Date.now()
    const addr = { id, ...form }
    const novos = editandoId
      ? enderecos.map(a => a.id === editandoId ? addr : a)
      : [...enderecos, addr]
    const novoSelecionado = editandoId ? selecionado : id
    try {
      const res = await fetch(`${API}/auth/enderecos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enderecos: novos, enderecoSelecionado: novoSelecionado })
      })
      const data = await res.json()
      if (res.ok) {
        setEnderecos(novos)
        setSelecionado(novoSelecionado)
        setForm({ cep: '', rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '' })
        setMostrarForm(false)
        setEditandoId(null)
        onSave({ enderecos: data.enderecos, endereco: data.endereco, enderecoSelecionado: novoSelecionado })
      }
    } catch {}
  }

  const handleAbrirMapa = (enderecoCompleto) => {
    console.log('[Mapa] handleAbrirMapa chamado com endereco:', enderecoCompleto)
    setEnderecoParaMapa(enderecoCompleto)
    setMostrarMapa(true)
  }

  const handleMapaConfirm = ({ lat, lng }) => {
    console.log('[Mapa] Confirmado:', { lat, lng })
    // Atualiza o endereço atual (form ou item da lista) com lat/lng
    if (editandoId) {
      setEnderecos(prev => prev.map(a => a.id === editandoId ? { ...a, lat, lng } : a))
    } else {
      setForm(f => ({ ...f, lat, lng }))
    }
  }

  const handleDelete = async (id) => {
    if (enderecos.length <= 1) return
    const novos = enderecos.filter(a => a.id !== id)
    const novoId = selecionado === id ? novos[0].id : selecionado
    try {
      const res = await fetch(`${API}/auth/enderecos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enderecos: novos, enderecoSelecionado: novoId })
      })
      const data = await res.json()
      if (res.ok) { setEnderecos(novos); setSelecionado(novoId); onSave({ enderecos: data.enderecos, endereco: data.endereco, enderecoSelecionado: novoId }) }
    } catch {}
  }

  const handleEdit = (addr) => {
    // Se o endereço está no formato legado (apenas rua com endereço completo), tenta parsear
    let cep = addr.cep || ''
    let rua = addr.rua || ''
    let numero = addr.numero || ''
    let referencia = addr.referencia || ''
    let bairro = addr.bairro || ''
    let cidade = addr.cidade || ''
    let estado = addr.estado || ''

    // Se tem apenas rua preenchida e parece ser endereço completo, tenta extrair partes
    if (rua && !numero && !bairro && !cidade && !estado) {
      // Tenta extrair número do final da rua (ex: "Rua das Flores, 123")
      const numMatch = rua.match(/^(.+?),\s*(\d+[a-zA-Z]?)\s*$/)
      if (numMatch) {
        rua = numMatch[1].trim()
        numero = numMatch[2].trim()
      }
    }

    setForm({ cep, rua, numero, referencia, bairro, cidade, estado })
    setEditandoId(addr.id)
    setMostrarForm(true)
    console.log('[AddressModal] handleEdit - dados extraídos do endereço:', { cep, rua, numero, referencia, bairro, cidade, estado, id: addr.id, lat: addr.lat, lng: addr.lng })
  }

  const cancelForm = () => {
    setForm({ cep: '', rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '' })
    setMostrarForm(false)
    setEditandoId(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-auth modal-endereco" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>Meus Endereços</h3>
        {enderecos.map((addr, i) => (
          <div key={addr.id || i} className="endereco-option" onClick={() => handleSelect(addr.id)}>
            <input type="radio" name="endereco-modal" checked={selecionado === addr.id} onChange={() => {}} />
            <span className="endereco-text">{formatEndereco(addr)}</span>
            <button className="endereco-edit" onClick={e => { e.stopPropagation(); handleEdit(addr) }}>✏️</button>
            <button className="endereco-mapa" onClick={e => { e.stopPropagation(); handleAbrirMapa(formatEndereco(addr)) }}>📍</button>
            {enderecos.length > 1 && <button className="endereco-remove" onClick={e => { e.stopPropagation(); handleDelete(addr.id) }}>✕</button>}
          </div>
        ))}
        {!mostrarForm ? (
          <button className="endereco-add-btn" onClick={() => setMostrarForm(true)}>+ Adicionar novo endereço</button>
        ) : (
          <div className="endereco-form">
            <p className="endereco-form-title">{editandoId ? 'Editar endereço' : 'Novo endereço'}</p>
            {formErro && <p className="endereco-erro">{formErro}</p>}
            <div className="endereco-form-cep-row">
              <input className="endereco-input endereco-input-cep" placeholder="CEP *" value={form.cep} onChange={e => { setFormErro(''); handleCepChange(e.target.value) }} />
              {buscandoCep && <span className="endereco-loading">Consultando...</span>}
            </div>
            <div className="endereco-form-row">
              <input className="endereco-input endereco-input-rua" placeholder="Rua *" value={form.rua} onChange={e => { setFormErro(''); setForm(f => ({ ...f, rua: e.target.value })) }} />
              <input className="endereco-input endereco-input-num" placeholder="Nº *" maxLength={6} value={form.numero} onChange={e => { setFormErro(''); setForm(f => ({ ...f, numero: e.target.value })) }} />
            </div>
            <input className="endereco-input" placeholder="Complemento" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
            <div className="endereco-form-row endereco-form-row-triple">
              <input className="endereco-input endereco-input-bairro" placeholder="Bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
              <input className="endereco-input endereco-input-cidade" placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              <input className="endereco-input endereco-input-estado" placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
            </div>
            <button className="endereco-mapa-btn" type="button" onClick={() => handleAbrirMapa(formatEndereco(form))}>📍 Marcar local exato no mapa</button>
            <div className="endereco-form-actions">
              <button className="btn-add" onClick={handleAdd}>{editandoId ? 'Salvar' : 'Adicionar'}</button>
              <button className="btn-del" onClick={cancelForm}>Cancelar</button>
            </div>
          </div>
        )}
        {!mostrarForm && <button className="btn-add" style={{marginTop:16}} onClick={onClose}>Concluído</button>}
        <MapaEntregaModal
          key={'mapa-addr-' + mostrarMapa}
          isOpen={mostrarMapa}
          onClose={() => setMostrarMapa(false)}
          onConfirm={handleMapaConfirm}
          enderecoInicial={enderecoParaMapa}
        />
      </div>
    </div>
  )
}

function EnderecoFormModal({ onSave, onClose, enderecoInicial }) {
  const [form, setForm] = useState(() => {
    if (enderecoInicial) {
      const cepMatch = enderecoInicial.match(/^(\d{5}-?\d{3})/)
      const cep = cepMatch ? cepMatch[1] : ''
      return { cep, rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '' }
    }
    return { cep: '', rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '' }
  })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [formErro, setFormErro] = useState('')
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [enderecoParaMapa, setEnderecoParaMapa] = useState('')
  const cepTimer = useRef(null)

  const handleCepChange = (value) => {
    const fmt = formatCEP(value)
    setForm(f => ({ ...f, cep: fmt }))
    const digits = fmt.replace(/\D/g, '')
    if (digits.length === 8) {
      if (cepTimer.current) clearTimeout(cepTimer.current)
      cepTimer.current = setTimeout(async () => {
        setBuscandoCep(true)
        const result = await buscarCEP(digits)
        if (result) setForm(f => ({ ...f, ...result }))
        setBuscandoCep(false)
      }, 300)
    }
  }

  const handleAbrirMapa = (enderecoCompleto) => {
    console.log('[EnderecoFormModal] handleAbrirMapa chamado com endereco:', enderecoCompleto)
    setEnderecoParaMapa(enderecoCompleto)
    setMostrarMapa(true)
  }

  const handleMapaConfirm = ({ lat, lng }) => {
    console.log('[EnderecoFormModal] Mapa confirmado:', { lat, lng })
    setForm(f => ({ ...f, lat, lng }))
  }

  const handleSave = () => {
    setFormErro('')
    if (!form.cep) { setFormErro('Preencha o CEP'); return }
    if (!form.rua) { setFormErro('Preencha a Rua'); return }
    if (!form.numero) { setFormErro('Preencha o Número'); return }
    onSave(formatEndereco(form), form.lat, form.lng)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-auth modal-endereco" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>Endereço de entrega</h3>
        <p className="endereco-subtitle">Insira o CEP e parte do seu endereço será preenchido automaticamente</p>
        <div className="endereco-form">
          {formErro && <p className="endereco-erro">{formErro}</p>}
          <div className="endereco-form-cep-row">
            <input className="endereco-input endereco-input-cep" placeholder="CEP *" value={form.cep} onChange={e => { setFormErro(''); handleCepChange(e.target.value) }} />
            {buscandoCep && <span className="endereco-loading">Consultando...</span>}
          </div>
          <div className="endereco-form-row">
            <input className="endereco-input endereco-input-rua" placeholder="Rua *" value={form.rua} onChange={e => { setFormErro(''); setForm(f => ({ ...f, rua: e.target.value })) }} />
            <input className="endereco-input endereco-input-num" placeholder="Nº *" maxLength={6} value={form.numero} onChange={e => { setFormErro(''); setForm(f => ({ ...f, numero: e.target.value })) }} />
          </div>
          <input className="endereco-input" placeholder="Complemento" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
          <div className="endereco-form-row endereco-form-row-triple">
            <input className="endereco-input endereco-input-bairro" placeholder="Bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
            <input className="endereco-input endereco-input-cidade" placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            <input className="endereco-input endereco-input-estado" placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
          </div>
          <button className="endereco-mapa-btn" type="button" onClick={() => handleAbrirMapa(formatEndereco(form))}>📍 Marcar local exato no mapa</button>
          <div className="endereco-form-actions">
            <button className="btn-add" onClick={handleSave}>Salvar endereço</button>
          </div>
        </div>
        <MapaEntregaModal
          key={'mapa-end-' + mostrarMapa}
          isOpen={mostrarMapa}
          onClose={() => setMostrarMapa(false)}
          onConfirm={handleMapaConfirm}
          enderecoInicial={enderecoParaMapa}
        />
      </div>
    </div>
  )
}

function MapaEntregaModal({
  isOpen,
  onClose,
  onConfirm,
  enderecoInicial,
}) {
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
    console.log('[MapaEntregaModal] Abrindo modal. enderecoInicial:', enderecoInicial)
    mountedRef.current = true
    setPronto(false)
    setLat(null)
    setLng(null)
    setBuscando(true)
    setBuscaEndereco('')
    setErroBusca('')

    if (!enderecoInicial) {
      console.log('[MapaEntregaModal] Sem enderecoInicial, fallback SP')
      setLat(-23.5505)
      setLng(-46.6333)
      setBuscando(false)
      setPronto(true)
      return
    }

    const geocode = async () => {
      try {
        const enderecoLimpo = enderecoInicial.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
        console.log('[MapaEntregaModal] Endereço limpo para geocoding:', enderecoLimpo)
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoLimpo)}&limit=1`
        console.log('[MapaEntregaModal] Geocoding URL:', url)
        const res = await fetch(url, { headers: { 'User-Agent': 'IsraelitaPizzasApp/1.0' } })
        const data = await res.json()
        console.log('[MapaEntregaModal] Geocoding resposta:', data)
        if (!mountedRef.current) return
        if (data[0]) {
          const newLat = parseFloat(data[0].lat)
          const newLng = parseFloat(data[0].lon)
          console.log('[MapaEntregaModal] Coordenadas obtidas:', { lat: newLat, lng: newLng })
          setLat(newLat)
          setLng(newLng)
        } else {
          console.log('[MapaEntregaModal] Nenhum resultado, fallback SP')
          setLat(-23.5505)
          setLng(-46.6333)
        }
      } catch (e) {
        console.error('[MapaEntregaModal] Erro geocoding:', e)
        if (!mountedRef.current) return
        setLat(-23.5505)
        setLng(-46.6333)
      } finally {
        if (mountedRef.current) {
          setBuscando(false)
          setPronto(true)
        }
      }
    }
    geocode()

    return () => { mountedRef.current = false }
  }, [isOpen])

  useEffect(() => {
    if (pronto && mapRef.current) {
      mapRef.current.flyTo([lat, lng], 16)
    }
  }, [pronto])

  const handleMapClick = (newLat, newLng) => {
    setLat(newLat)
    setLng(newLng)
  }

  const handleConfirm = () => {
    onConfirm({ lat, lng, endereco: enderecoInicial })
    onClose()
  }

  const handleSearch = async () => {
    if (!buscaEndereco.trim()) return
    setBuscandoEndereco(true)
    setErroBusca('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(buscaEndereco)}&limit=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'IsraelitaPizzasApp/1.0' } })
      const data = await res.json()
      if (!mountedRef.current) return
      if (data[0]) {
        const newLat = parseFloat(data[0].lat)
        const newLng = parseFloat(data[0].lon)
        setLat(newLat)
        setLng(newLng)
        if (mapRef.current) {
          mapRef.current.flyTo([newLat, newLng], 17)
        }
      } else {
        setErroBusca('Endereço não encontrado. Tente ser mais específico.')
      }
    } catch (e) {
      console.error('[MapaEntregaModal] Erro na busca:', e)
      setErroBusca('Erro ao buscar endereço. Tente novamente.')
    } finally {
      if (mountedRef.current) {
        setBuscandoEndereco(false)
      }
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const pinIcon = L.divIcon({
    className: '',
    html: `<div class="mapa-marker-blue"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="44"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#2196F3"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg></div>`,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-mapa" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📍 Marcar Local Exato de Entrega</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {buscando ? (
          <div className="mapa-loading">
            <div className="mapa-loading-icon">🔍</div>
            <p>Localizando o endereço no mapa...</p>
            <p className="mapa-loading-endereco">{enderecoInicial}</p>
          </div>
        ) : !pronto ? null : (
          <>
            <div className="mapa-search">
              <input
                type="text"
                placeholder="Buscar rua, bairro ou ponto de referência..."
                value={buscaEndereco}
                onChange={e => { setBuscaEndereco(e.target.value); setErroBusca('') }}
                onKeyDown={handleSearchKeyDown}
              />
              <button onClick={handleSearch} disabled={buscandoEndereco}>
                {buscandoEndereco ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {erroBusca && <p className="mapa-search-erro">{erroBusca}</p>}
            <p className="mapa-instrucao">
              O mapa abriu no local aproximado do endereço. <strong>Clique no mapa</strong> para ajustar o ponto exato da entrega.
            </p>
            <div className="mapa-container">
              <MapContainer
                ref={mapRef}
                center={[lat, lng]}
                zoom={16}
                scrollWheelZoom={true}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={pinIcon}>
                </Marker>
                <MapClickHandler onClick={handleMapClick} />
              </MapContainer>
            </div>
            <p className="mapa-dica">💡 Dica: use a busca acima para encontrar uma rua próxima caso não localize a sua</p>
            <div className="mapa-coords">
              Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
            </div>
            <div className="form-actions">
              <button className="btn-del" onClick={onClose}>Cancelar</button>
              <button className="btn-add" onClick={handleConfirm}>
                ✅ Confirmar Local Exato
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MapClickHandler({ onClick }) {
  const map = useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

const PIZZARIA_ADDR = 'Rua Eloir Dide Maria, 283 - Tatuquara, Curitiba - PR'

function MotoboyPage({ onVoltar }) {
  const [pedidos, setPedidos] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [etapa, setEtapa] = useState('selecao')
  const [ordemOtimizada, setOrdemOtimizada] = useState([])
  const [voltaPizzaria, setVoltaPizzaria] = useState(null)
  const [otimizando, setOtimizando] = useState(false)
  const [motoboyPos, setMotoboyPos] = useState(null)
  const [pizzariaCoords, setPizzariaCoords] = useState(null)
  const prevCountRef = useRef(0)
  const mountedRef = useRef(true)
  const primeiraCarga = useRef(true)
  const watchIdRef = useRef(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    }
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })
    // Geocode pizzaria address
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(PIZZARIA_ADDR)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data?.length && mountedRef.current) {
          setPizzariaCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    mountedRef.current = true
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => { if (mountedRef.current) setMotoboyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const carregar = () => {
      fetch(`${API}/orders`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(data => {
          if (!mountedRef.current) return
          if (!Array.isArray(data)) return
          const liberados = data.filter(p => p.status === 'liberado')
          if (liberados.length > prevCountRef.current && !primeiraCarga.current) {
            tocarSomMotoboy()
          }
          prevCountRef.current = liberados.length
          primeiraCarga.current = false
          setPedidos(liberados)
        })
        .catch(() => {})
    }
    carregar()
    const id = setInterval(carregar, 10000)
    return () => { clearInterval(id); mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (etapa === 'organizar' && ordemOtimizada.length === 0) {
      setEtapa('selecao')
    }
  }, [ordemOtimizada.length, etapa])

  const tocarSomMotoboy = () => {
    try { navigator.vibrate?.([200, 100, 200, 100, 200]) } catch (_) {}
    try {
      let ctx = audioCtxRef.current
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)()
        audioCtxRef.current = ctx
      }
      if (ctx.state === 'suspended') ctx.resume()
      let toques = 0
      const tocar = () => {
        if (toques >= 2 || !ctx || ctx.state === 'closed') return
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 660 + i * 110
          gain.gain.setValueAtTime(0.2, t + i * 0.1)
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.3)
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.3)
        }
        toques++
        if (toques < 2) setTimeout(tocar, 1200)
      }
      tocar()
    } catch (_) {}
  }

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const toggleSelecionado = (id) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const organizar = async () => {
    setOtimizando(true)
    const selec = pedidos.filter(p => selecionados.includes(p.id))

    if (motoboyPos && pizzariaCoords && selec.some(p => p.entrega_lat && p.entrega_lng)) {
      const comCoords = selec.filter(p => p.entrega_lat && p.entrega_lng)
      const semCoords = selec.filter(p => !p.entrega_lat || !p.entrega_lng)

      if (comCoords.length >= 1) {
        const coordsStr = [
          `${motoboyPos.lng},${motoboyPos.lat}`,
          ...comCoords.map(p => `${p.entrega_lng},${p.entrega_lat}`),
          `${pizzariaCoords.lng},${pizzariaCoords.lat}`
        ].join(';')
        try {
          const r = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordsStr}?source=first&destination=last&overview=false`)
          if (r.ok) {
            const data = await r.json()
            if (data.code === 'Ok') {
              const waypoints = data.trips[0].waypoints
              const legs = data.trips[0].legs
              const rotaOtimizada = waypoints.slice(1, -1).map((wp, i) => ({
                ...comCoords[wp.waypoint_index - 1],
                distKm: legs[i].distance / 1000,
                durMin: Math.round(legs[i].duration / 60)
              }))
              const voltaDist = legs[legs.length - 1].distance / 1000
              const voltaDur = Math.round(legs[legs.length - 1].duration / 60)
              const semCoordsOrd = [...semCoords].sort((a, b) => new Date(a.data) - new Date(b.data))
              setOrdemOtimizada([...rotaOtimizada, ...semCoordsOrd])
              setVoltaPizzaria({ distKm: voltaDist, durMin: voltaDur })
              setEtapa('organizar')
              setOtimizando(false)
              return
            }
          }
        } catch (_) {}
      }

      const ordenados = [...selec].sort((a, b) => {
        const da = a.entrega_lat && motoboyPos ? haversineKm(motoboyPos.lat, motoboyPos.lng, a.entrega_lat, a.entrega_lng) : Infinity
        const db = b.entrega_lat && motoboyPos ? haversineKm(motoboyPos.lat, motoboyPos.lng, b.entrega_lat, b.entrega_lng) : Infinity
        if (da !== db) return da - db
        return new Date(a.data) - new Date(b.data)
      })
      const ultimo = ordenados[ordenados.length - 1]
      if (ultimo?.entrega_lat && pizzariaCoords) {
        const d = haversineKm(ultimo.entrega_lat, ultimo.entrega_lng, pizzariaCoords.lat, pizzariaCoords.lng)
        const t = Math.round(d / 0.4)
        setVoltaPizzaria({ distKm: d, durMin: t })
      }
      setOrdemOtimizada(ordenados)
      setEtapa('organizar')
      setOtimizando(false)
    } else if (pizzariaCoords) {
      const ordenados = [...selec].sort((a, b) => new Date(a.data) - new Date(b.data))
      const ultimo = ordenados[ordenados.length - 1]
      if (ultimo?.entrega_lat && pizzariaCoords) {
        const d = haversineKm(ultimo.entrega_lat, ultimo.entrega_lng, pizzariaCoords.lat, pizzariaCoords.lng)
        const t = Math.round(d / 0.4)
        setVoltaPizzaria({ distKm: d, durMin: t })
      }
      setOrdemOtimizada(ordenados)
      setEtapa('organizar')
      setOtimizando(false)
    } else {
      const ordenados = [...selec].sort((a, b) => new Date(a.data) - new Date(b.data))
      setOrdemOtimizada(ordenados)
      setEtapa('organizar')
      setOtimizando(false)
    }
  }

  const marcarEntregue = async (id) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'entregue' })
    })
    setSelecionados(prev => prev.filter(x => x !== id))
    setOrdemOtimizada(prev => prev.filter(p => p.id !== id))
  }

  const abrirNoMapsRota = () => {
    const destinos = ordemOtimizada.filter(p => p.entrega_lat || p.cliente?.endereco)
    const enc = a => a.cliente?.endereco || `${a.entrega_lat},${a.entrega_lng}`
    const params = new URLSearchParams({ api: 1, travelmode: 'driving', dir_action: 'navigate' })
    params.set('destination', PIZZARIA_ADDR)
    if (destinos.length > 0) {
      params.set('waypoints', destinos.map(enc).join('|'))
    }
    window.location.href = `https://www.google.com/maps/dir/?${params}`
  }

  const formatTel = (t) => {
    if (!t) return ''
    const s = t.replace(/\D/g, '')
    if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`
    if (s.length === 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`
    return t
  }

  const selecionadosData = pedidos.filter(p => selecionados.includes(p.id))
  const disponiveis = pedidos.filter(p => !selecionados.includes(p.id))

  return (
    <div className="motoboy-page">
      <div className="motoboy-topo">
        <button className="motoboy-voltar" onClick={onVoltar}>←</button>
        <h1 className="motoboy-titulo">🛵 Entregas</h1>
        <span className="motoboy-qtd">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</span>
      </div>

      {pedidos.length === 0 && (
        <div className="motoboy-vazio">
          <div className="motoboy-vazio-icone">🛵</div>
          <p className="motoboy-vazio-texto">Nenhuma entrega pendente</p>
          <p className="motoboy-vazio-sub">Aguardando novos pedidos...</p>
        </div>
      )}

      {etapa === 'selecao' && pedidos.length > 0 && (
        <div className="motoboy-selecao">
          <div className="motoboy-instrucao">
            Selecione os pedidos que vai levar e depois organize a caixa
          </div>

          {selecionadosData.map(p => (
            <div key={p.id} className="motoboy-card motoboy-card-checked" onClick={() => toggleSelecionado(p.id)}>
              <div className="motoboy-check"><div className="cb on">✓</div></div>
              <div className="motoboy-card-corpo">
                <div className="motoboy-card-linha">
                  <strong className="motoboy-card-nome">{p.cliente?.nome}</strong>
                  <span className="motoboy-card-valor">R$ {p.total?.toFixed(2)}</span>
                </div>
                <span className="motoboy-card-end">📍 {p.cliente?.endereco}</span>
                <span className="motoboy-card-tel">📞 {formatTel(p.cliente?.telefone)}</span>
                <div className="motoboy-card-itens">
                  {p.itens?.map(item => (
                    <span key={item.id} className="motoboy-card-item">{item.qtd}x {item.nome}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {disponiveis.map(p => (
            <div key={p.id} className="motoboy-card" onClick={() => toggleSelecionado(p.id)}>
              <div className="motoboy-check"><div className="cb"></div></div>
              <div className="motoboy-card-corpo">
                <div className="motoboy-card-linha">
                  <strong className="motoboy-card-nome">{p.cliente?.nome}</strong>
                  <span className="motoboy-card-valor">R$ {p.total?.toFixed(2)}</span>
                </div>
                <span className="motoboy-card-end">📍 {p.cliente?.endereco}</span>
                <span className="motoboy-card-tel">📞 {formatTel(p.cliente?.telefone)}</span>
                <div className="motoboy-card-itens">
                  {p.itens?.map(item => (
                    <span key={item.id} className="motoboy-card-item">{item.qtd}x {item.nome}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="motoboy-rodape">
            <button className="motoboy-btn-primario" disabled={selecionados.length === 0 || otimizando} onClick={organizar}>
              {otimizando ? '🔄 Organizando...' : (selecionados.length > 0 ? `📦 Organizar mercadoria (${selecionados.length})` : '📦 Organizar mercadoria')}
            </button>
          </div>
        </div>
      )}

      {etapa === 'organizar' && ordemOtimizada.length > 0 && (
        <div className="motoboy-rota">
          <div className="motoboy-box">
            <div className="motoboy-box-label">
              <span>🏍️ Caixa da Moto</span>
              <span className="motoboy-box-info">1º entrega no topo</span>
            </div>
            <div className="motoboy-box-pilha">
              {ordemOtimizada.map((p, idx) => (
                <div key={p.id} className={`motoboy-box-item ${idx === 0 ? 'first' : ''}`}>
                  <div className="motoboy-box-ordem">{idx + 1}º</div>
                  <div className="motoboy-box-conteudo">
                    <strong>{p.cliente?.nome}</strong>
                    <span>{p.cliente?.endereco}</span>
                    <div className="motoboy-box-itens">
                      {p.itens?.map(i => <span key={i.id}>{i.qtd}x {i.nome}</span>)}
                    </div>
                    {p.distKm && <span className="motoboy-box-dist">📏 {p.distKm.toFixed(1)} km · ≈ {p.durMin} min</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="motoboy-entregas">
            {ordemOtimizada.map((p, idx) => (
              <div key={p.id} className="motoboy-entrega-card">
                <div className="motoboy-entrega-num">{idx + 1}</div>
                <div className="motoboy-entrega-corpo">
                  <strong>{p.cliente?.nome}</strong>
                  <span>📍 {p.cliente?.endereco}</span>
                  <span>📞 {formatTel(p.cliente?.telefone)}</span>
                  {p.distKm && <span className="motoboy-entrega-dist">📏 {p.distKm.toFixed(1)} km · ≈ {p.durMin} min</span>}
                  <div className="motoboy-entrega-itens">
                    {p.itens?.map(i => <span key={i.id}>{i.qtd}x {i.nome}</span>)}
                  </div>
                  <span className="motoboy-entrega-total">R$ {p.total?.toFixed(2)}</span>
                </div>
                <button className="motoboy-btn-entregue" onClick={() => marcarEntregue(p.id)}>✅</button>
              </div>
            ))}
            {voltaPizzaria && (
              <div className="motoboy-entrega-card motoboy-retorno">
                <div className="motoboy-entrega-num motoboy-retorno-num">🏠</div>
                <div className="motoboy-entrega-corpo">
                  <strong>🔄 Retorno à Pizzaria</strong>
                  <span>📍 {PIZZARIA_ADDR}</span>
                  <span className="motoboy-entrega-dist">📏 {voltaPizzaria.distKm.toFixed(1)} km · ≈ {voltaPizzaria.durMin} min</span>
                </div>
              </div>
            )}
          </div>

          <div className="motoboy-rodape">
            <button className="motoboy-btn-primario" onClick={abrirNoMapsRota}>
              🗺️ Abrir navegação
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

