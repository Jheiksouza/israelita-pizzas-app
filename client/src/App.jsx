import React, { useState, useEffect, useRef, useMemo } from 'react'
import { buscarCEP, formatCEP, formatEndereco } from './cepHelper'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { registerFCMToken } from './firebase'

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
  if (window.location.pathname.startsWith('/motoboy')) {
    return <MotoboyStandalone />
  }
  const [pagina, setPagina] = useState(() => localStorage.getItem('appPagina') || 'cardapio')
  const [carrinho, setCarrinho] = useState(() => {
    const saved = localStorage.getItem('carrinho_guest')
    return saved ? JSON.parse(saved) : []
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'classic')
  const [font, setFont] = useState(() => localStorage.getItem('appFont') || 'classico')
  const isMobile = window.innerWidth <= 768
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
  const [completarCadastro, setCompletarCadastro] = useState(false)
  const [cadastroForm, setCadastroForm] = useState({ nome: '', telefone: '', endereco: '' })
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  const [mostrarEnderecoForm, setMostrarEnderecoForm] = useState(false)
  useEffect(() => {
    localStorage.setItem('appPagina', pagina)
  }, [pagina])
  const carrinhoSyncTimer = useRef(null)
  const sharedAudioRef = useRef(null)
  window.__authSetters = window.__authSetters || {}

  /* Acorda AudioContext no primeiro clique (iOS precisa) */
  useEffect(() => {
    const acordar = () => {
      if (!sharedAudioRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctx.resume().catch(() => {})
        sharedAudioRef.current = ctx
      }
    }
    document.addEventListener('click', acordar, { once: true })
    document.addEventListener('touchstart', acordar, { once: true })
    return () => {
      document.removeEventListener('click', acordar)
      document.removeEventListener('touchstart', acordar)
    }
  }, [])

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
    if (user?.id) registerFCMToken(user.id, user?.role)
  }, [user?.id])

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

  const tocarNotificacao = () => {
    try {
      const ctx = sharedAudioRef.current || new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return }
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
    const addrSelected = user?.nome && user?.telefone ? getSelectedAddress(user) : null
    const enderecoFinal = addrSelected
      ? formatEndereco(addrSelected) || user.endereco || ''
      : ''
    const dadosCliente = addrSelected
      ? { nome: user.nome, telefone: user.telefone, endereco: enderecoFinal, lat: addrSelected.lat, lng: addrSelected.lng }
      : cliente
    if (!dadosCliente.nome || !dadosCliente.telefone) return alert('Preencha nome e telefone')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const entrega_lat = dadosCliente.lat || dadosCliente.endereco_lat || null
      const entrega_lng = dadosCliente.lng || dadosCliente.endereco_lng || null
      console.log('[DEBUG finalizarPedido] dadosCliente:', JSON.stringify(dadosCliente), 'entrega_lat:', entrega_lat, 'entrega_lng:', entrega_lng)
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cliente: dadosCliente, itens: carrinho, total: totalCarrinho, entrega_lat, entrega_lng })
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
      {pagina !== 'motoboy' && !(pagina === 'meus-pedidos' && isMobile) && (
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
            </nav>
          </div>
        </header>
      )}

      <main className="main">
        {pagina === 'cardapio' && <Cardapio onAdicionar={adicionarAoCarrinho} onBanner={(msg) => { setBannerApp({ texto: msg, key: Date.now() }); tocarNotificacao() }} pizzaEditando={pizzaEditando} onPizzaEditDone={() => setPizzaEditando(null)} />}
        {pagina === 'meus-pedidos' && <MeusPedidos token={token} onVoltar={() => setPagina('cardapio')} qtdCarrinho={qtdCarrinho} onCartOpen={() => setCartOpen(true)} onPagina={setPagina} />}
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
          onSave={(addr, lat, lng) => { setCliente(c => ({ ...c, endereco: addr, lat, lng })); setMostrarEnderecoForm(false) }}
          onClose={() => setMostrarEnderecoForm(false)}
        />
      )}
      
      {pagina !== 'motoboy' && !(pagina === 'meus-pedidos' && isMobile) && (
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
  const [enderecoForm, setEnderecoForm] = useState(null)
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
      const body = modo === 'login' ? { email, senha } : {
        nome, email, senha, telefone, endereco,
        endereco_lat: enderecoLat, endereco_lng: enderecoLng,
        enderecos: enderecoForm ? [{
          id: 'addr1', cep: enderecoForm.cep, rua: enderecoForm.rua,
          numero: enderecoForm.numero, referencia: enderecoForm.referencia,
          bairro: enderecoForm.bairro, cidade: enderecoForm.cidade,
          estado: enderecoForm.estado, lat: enderecoLat, lng: enderecoLng
        }] : endereco ? [{ id: 'addr1', rua: endereco, lat: enderecoLat, lng: enderecoLng }] : []
      }
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
            onSave={(addr, lat, lng, formData) => { setEndereco(addr); setEnderecoLat(lat); setEnderecoLng(lng); setEnderecoForm(formData); setMostrarEnderecoModal(false); }}
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
          <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
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

const pedidoSteps = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'aceito', label: 'Preparo' },
  { key: 'liberado', label: 'Pronto' },
  { key: 'em_rota', label: 'Saiu' },
  { key: 'entregador_proximo', label: 'Chegou!' },
  { key: 'entregue', label: 'Entregue' },
]
const stepIndexPedido = s => pedidoSteps.findIndex(st => st.key === s)

function PedidoProgresso({ status }) {
  if (!status) return null
  let idx = stepIndexPedido(status)
  if (status === 'recusado') idx = -2
  if (idx === -1) return null
  const isRecusado = idx === -2
  const pct = isRecusado ? 0 : (idx / (pedidoSteps.length - 1)) * 100
  const circleIdx = isRecusado ? 0 : idx
  return (
    <div className="pedido-steps">
      <div className={`pedido-steps-track${isRecusado ? ' recusado' : ''}`}>
        <div className="pedido-steps-fill" style={{ width: `${pct}%` }} />
        {pedidoSteps.map((st, i) => (
          <span key={`l${st.key}`} className={`pedido-step-label${isRecusado && i === 0 ? ' active recusado' : ''}${!isRecusado && i < idx ? ' done' : ''}${!isRecusado && i === idx ? ' active' : ''}`} style={{ left: `${(i / (pedidoSteps.length - 1)) * 100}%` }}>
            {isRecusado && i === 0 ? 'Cancelado' : st.label}
          </span>
        ))}
        <div className="pedido-step-circle active" style={{ left: `${(circleIdx / (pedidoSteps.length - 1)) * 100}%` }} />
      </div>
    </div>
  )
}

function MeusPedidos({ token, onVoltar, qtdCarrinho, onCartOpen, onPagina }) {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscaId, setBuscaId] = useState('')
  const [pedidoBuscado, setPedidoBuscado] = useState(null)
  const [notificacaoLiberado, setNotificacaoLiberado] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [headerShow, setHeaderShow] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const prevStatusRef = useRef({})
  const wrapperRef = useRef(null)
  const touchRef = useRef({ startY: 0, startIdx: 0 })
  const headerTimer = useRef(null)
  const pedidosLenRef = useRef(0)
  const MOBILE = window.innerWidth <= 768

  useEffect(() => { pedidosLenRef.current = pedidos.length }, [pedidos])

  /* ----- header auto-hide ----- */
  useEffect(() => {
    if (!MOBILE) return
    headerTimer.current = setTimeout(() => setHeaderShow(false), 1000)
    return () => clearTimeout(headerTimer.current)
  }, [])

  const showHeaderTemp = () => {
    setHeaderShow(true)
    clearTimeout(headerTimer.current)
    headerTimer.current = setTimeout(() => setHeaderShow(false), 3000)
  }

  /* ----- refs for closure safety ----- */
  const activeIdxRef = useRef(0)
  const headerShowRef = useRef(true)
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])
  useEffect(() => { headerShowRef.current = headerShow }, [headerShow])

  /* ----- lock body scroll on mobile ----- */
  useEffect(() => {
    if (!MOBILE || pedidos.length === 0) return
    document.body.classList.add('pedidos-open')
    document.documentElement.classList.add('pedidos-open')
    return () => {
      document.body.classList.remove('pedidos-open')
      document.documentElement.classList.remove('pedidos-open')
    }
  }, [MOBILE, pedidos.length > 0])

  /* ----- native touch listeners (passive:false for preventDefault) ----- */
  useEffect(() => {
    if (!MOBILE || pedidos.length === 0) return
    const el = document.querySelector('.pedidos-lista')
    if (!el) return

    const onStart = e => {
      if (e.touches.length !== 1) return
      touchRef.current = { startY: e.touches[0].clientY, startIdx: activeIdxRef.current }
    }

    const onMove = e => {
      if (!touchRef.current) return
      const dy = e.touches[0].clientY - touchRef.current.startY
      /* if touch is in scrollable area and it has room to scroll, let browser handle it */
      const scrollEl = e.target.closest('.pedido-card-scroll')
      if (scrollEl) {
        const canScrollDown = dy < 0 && scrollEl.scrollTop < scrollEl.scrollHeight - scrollEl.clientHeight - 1
        const canScrollUp = dy > 0 && scrollEl.scrollTop > 1
        if (canScrollDown || canScrollUp) return
      }
      e.preventDefault()
      const pct = -touchRef.current.startIdx * 100 + dy / window.innerHeight * 100
      if (wrapperRef.current) {
        wrapperRef.current.classList.add('dragging')
        wrapperRef.current.style.transform = `translateY(${pct}%)`
      }
      if (dy > 40 && touchRef.current.startIdx === 0 && !headerShowRef.current) showHeaderTemp()
    }

    const onEnd = e => {
      if (!touchRef.current) return
      const dy = e.changedTouches[0].clientY - touchRef.current.startY
      touchRef.current = null
      if (wrapperRef.current) wrapperRef.current.classList.remove('dragging')
      if (Math.abs(dy) >= 60) {
        setActiveIdx(prev => {
          if (dy < 0 && prev < pedidosLenRef.current - 1) return prev + 1
          if (dy > 0 && prev > 0) return prev - 1
          return prev
        })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [MOBILE, pedidos.length])

  /* ----- polling ----- */
  useEffect(() => {
    if (!token) { setLoading(false); return }
    const carregar = () => {
      fetch(`${API}/orders/mine`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(data => {
          setPedidos(data)
          setLoading(false)
          data.forEach(p => {
            const prev = prevStatusRef.current[p.id]
            if (!prev) { prevStatusRef.current[p.id] = p.status; return }
            if (prev !== p.status) {
              if (p.status === 'liberado' && prev !== 'entregador_proximo') {
                tocarSomLiberado()
                setNotificacaoLiberado(p)
              }
    if (p.status === 'entregador_proximo') {
      try { navigator.vibrate?.([200, 100, 200]) } catch (_) {}
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Entregador chegou!', {
            body: 'Pedido #' + p.id + ' - O entregador chegou!'
          })
        }
      } catch (_) {}
    }
              if (p.status === 'entregue' && prev === 'entregador_proximo') {
                try { navigator.vibrate?.([300, 200, 300, 200, 300]) } catch (_) {}
                try {
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('✅ Pedido #' + p.id + ' entregue!', {
                      body: 'Seu pedido chegou! Bom apetite! 🍕'
                    })
                  }
                } catch (_) {}
                try {
                  const ctx = sharedAudioRef.current || new (window.AudioContext || window.webkitAudioContext)()
                  if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return }
                  const t = ctx.currentTime
                  for (let i = 0; i < 4; i++) {
                    const o = ctx.createOscillator()
                    const g = ctx.createGain()
                    o.type = 'sine'; o.frequency.value = 880
                    g.gain.setValueAtTime(0.3, t + i * 0.3)
                    g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.3 + 0.2)
                    o.connect(g); g.connect(ctx.destination)
                    o.start(t + i * 0.3); o.stop(t + i * 0.3 + 0.2)
                  }
                } catch (_) {}
              }
            }
            prevStatusRef.current[p.id] = p.status
          })
        }).catch(() => setLoading(false))
    }
    carregar()
    const id = setInterval(carregar, 10000)
    return () => clearInterval(id)
  }, [token])

  const tocarSomLiberado = () => {
    try {
      const ctx = sharedAudioRef.current || new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return }
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 660
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.4)
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

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'À caminho', entregador_proximo: 'Entregador chegou!', entregue: 'Entregue', recusado: 'Recusado' }
  const statusClass = { pendente: 'status-pendente', aceito: 'status-aceito', liberado: 'status-liberado', entregador_proximo: 'status-entregador_proximo', entregue: 'status-entregue', recusado: 'status-recusado' }

  const fecharMenu = () => setMenuOpen(false)

  return (
    <div className="carrinho-page">
      {/* ----- mobile header ----- */}
      {MOBILE && (
        <>
          <div className="mobile-pedido-header" style={{ transform: `translateY(${headerShow ? '0' : '-100%'})` }}>
            <span className="mobile-pedido-logo">🍕 Pizzaria Israelita</span>
            <div className="mobile-pedido-header-right">
              <button className="mobile-pedido-cart" onClick={onCartOpen}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                {qtdCarrinho > 0 && <span className="mobile-pedido-cart-badge">{qtdCarrinho}</span>}
              </button>
              <button className="mobile-pedido-hamburger" onClick={() => setMenuOpen(o => !o)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="mobile-pedido-menu-overlay" onClick={fecharMenu}>
              <div className="mobile-pedido-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { fecharMenu(); onPagina('cardapio') }}>🍕 Cardápio</button>
                <button onClick={() => { fecharMenu(); onPagina('meus-pedidos') }}>📋 Meus Pedidos</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ----- notificação liberado ----- */}
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

      {/* ----- guest tracking ----- */}
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
              </div>
              {pedidoBuscado.status === 'entregador_proximo' && (
                <div className="entregador-proximo-aviso">O entregador chegou! Por favor, dirija-se ao local da entrega para receber o pedido.</div>
              )}
              <div className="pedido-body">
                <div className="pedido-field">
                  <span className="pedido-field-label">Cliente</span>
                  <span className="pedido-field-value">{pedidoBuscado.cliente?.nome}</span>
                </div>
                <div className="pedido-field">
                  <span className="pedido-field-label">Data</span>
                  <span className="pedido-field-value">{new Date(pedidoBuscado.data).toLocaleString('pt-BR')}</span>
                </div>
                <div className="pedido-itens">
                  <span className="pedido-field-label">Itens</span>
                  <div className="pedido-itens-tags">
                    {pedidoBuscado.itens?.map(item => (
                      <span key={item.id} className="pedido-item">{item.qtd}x {item.nome}</span>
                    ))}
                  </div>
                </div>
                <PedidoProgresso status={pedidoBuscado.status} />
                <div className="pedido-total">
                  <span className="pedido-field-label">Total</span>
                  <span className="pedido-total-valor">R$ {pedidoBuscado.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----- loading / empty ----- */}
      {token && loading && <p>Carregando...</p>}
      {token && !loading && pedidos.length === 0 && (
        <div className="empty-state">
          <p>Nenhum pedido encontrado</p>
        </div>
      )}

      {/* ----- card list ----- */}
      {token && pedidos.length > 0 && (
        <div className="pedidos-lista">
          <div className="pedidos-cards-wrapper" ref={wrapperRef} style={MOBILE ? { transform: `translateY(${-activeIdx * 100}%)` } : {}}>
            {pedidos.map((pedido, i) => (
              <div key={pedido.id} className={`pedido-card${pedido.status === 'pendente' ? ' pedido-pendente-destaque' : ''}`}>
                <div className="pedido-card-scroll">
                  <div className="pedido-header">
                    <strong>Pedido #{pedido.id}</strong>
                  </div>
                  {pedido.status === 'entregador_proximo' && (
                    <div className="entregador-proximo-aviso">O entregador chegou! Por favor, dirija-se ao local da entrega para receber o pedido.</div>
                  )}
                  <div className="pedido-field">
                    <span className="pedido-field-label">Cliente</span>
                    <span className="pedido-field-value">{pedido.cliente?.nome}</span>
                  </div>
                  <div className="pedido-field">
                    <span className="pedido-field-label">Data</span>
                    <span className="pedido-field-value">{new Date(pedido.data).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="pedido-itens">
                    <span className="pedido-field-label">Itens</span>
                    <div className="pedido-itens-tags">
                      {pedido.itens?.map(item => (
                        <span key={item.id} className="pedido-item">{item.qtd}x {item.nome}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pedido-card-fixo">
                  <PedidoProgresso status={pedido.status} />
                  <div className="pedido-total">
                    <span className="pedido-field-label">Total</span>
                    <span className="pedido-total-valor">R$ {pedido.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* ----- right side pagination ----- */}
          {MOBILE && (
            <div className="pedido-nav-lateral">
              {pedidos.map((_, i) => (
                <div key={i} className={`pedido-nav-lateral-dot${i === activeIdx ? ' active' : ''}`} />
              ))}
              <div className="pedido-nav-lateral-count">{activeIdx + 1}/{pedidos.length}</div>
            </div>
          )}
        </div>
      )}

      {/* ----- back button (desktop only) ----- */}
      {!MOBILE && (
        <div className="carrinho-actions" style={{ marginTop: 24 }}>
          <button className="btn-add" onClick={onVoltar}>← Voltar ao Cardápio</button>
        </div>
      )}
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


function AddressModal({ user, token, onClose, onSave }) {
  const [enderecos, setEnderecos] = useState(() => {
    const enderecosList = user?.enderecos?.length ? user.enderecos
      : user?.endereco ? [{ id: 'addr1', rua: user.endereco }]
      : []
    console.log('[AddressModal] Endereços carregados:', JSON.stringify(enderecosList))
    return enderecosList
  })
  const [selecionado, setSelecionado] = useState(user?.enderecoSelecionado || enderecos[0]?.id || '')
  const [mostrarEnderecoForm, setMostrarEnderecoForm] = useState(false)
  const [enderecoEditando, setEnderecoEditando] = useState(null)

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

  const handleEnderecoFormSave = async (addrStr, lat, lng, formData) => {
    const id = enderecoEditando ? enderecoEditando.id : 'addr' + Date.now()
    const addr = { id, ...formData, lat, lng }
    const novos = enderecoEditando
      ? enderecos.map(a => a.id === id ? addr : a)
      : [...enderecos, addr]
    const novoSelecionado = enderecoEditando ? selecionado : id
    try {
      const res = await fetch(`${API}/auth/enderecos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enderecos: novos, enderecoSelecionado: novoSelecionado })
      })
      const data = await res.json()
      if (res.ok) {
        setEnderecos(novos)
        setSelecionado(novoSelecionado)
        onSave({ enderecos: data.enderecos, endereco: data.endereco, enderecoSelecionado: novoSelecionado })
      }
    } catch {}
    setMostrarEnderecoForm(false)
    setEnderecoEditando(null)
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
    setEnderecoEditando(addr)
    setMostrarEnderecoForm(true)
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
            {enderecos.length > 1 && <button className="endereco-remove" onClick={e => { e.stopPropagation(); handleDelete(addr.id) }}>✕</button>}
          </div>
        ))}
        <button className="endereco-add-btn" onClick={() => { setEnderecoEditando(null); setMostrarEnderecoForm(true) }}>+ Adicionar novo endereço</button>
        <button className="btn-add" style={{marginTop:8}} onClick={onClose}>Concluído</button>
      </div>
      {mostrarEnderecoForm && (
        <EnderecoFormModal
          enderecoInicial={enderecoEditando}
          onSave={handleEnderecoFormSave}
          onClose={() => { setMostrarEnderecoForm(false); setEnderecoEditando(null) }}
        />
      )}
    </div>
  )
}

function EnderecoFormModal({ onSave, onClose, enderecoInicial }) {
  const [form, setForm] = useState(() => {
    if (!enderecoInicial) {
      return { cep: '', rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '', lat: null, lng: null }
    }
    if (typeof enderecoInicial === 'object') {
      return {
        cep: enderecoInicial.cep || '',
        rua: enderecoInicial.rua || '',
        numero: enderecoInicial.numero || '',
        referencia: enderecoInicial.referencia || '',
        bairro: enderecoInicial.bairro || '',
        cidade: enderecoInicial.cidade || '',
        estado: enderecoInicial.estado || '',
        lat: enderecoInicial.lat || null,
        lng: enderecoInicial.lng || null
      }
    }
    const cepMatch = enderecoInicial.match(/^(\d{5}-?\d{3})/)
    return {
      cep: cepMatch ? cepMatch[1] : '',
      rua: '', numero: '', referencia: '', bairro: '', cidade: '', estado: '', lat: null, lng: null
    }
  })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [formErro, setFormErro] = useState('')
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [enderecoParaMapa, setEnderecoParaMapa] = useState('')
  const [coordsIniciais, setCoordsIniciais] = useState(null)
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

  const handleAbrirMapa = (enderecoCompleto, coords = null) => {
    console.log('[EnderecoFormModal] handleAbrirMapa chamado com endereco:', enderecoCompleto, 'coords:', coords)
    setEnderecoParaMapa(enderecoCompleto)
    setCoordsIniciais(coords)
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
    onSave(formatEndereco(form), form.lat, form.lng, {
      cep: form.cep, rua: form.rua, numero: form.numero,
      referencia: form.referencia || '', bairro: form.bairro || '',
      cidade: form.cidade || '', estado: form.estado || ''
    })
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
          <button className="endereco-mapa-btn" type="button" onClick={() => handleAbrirMapa(formatEndereco(form), form.lat && form.lng ? { lat: form.lat, lng: form.lng } : null)}>📍 Marcar local exato no mapa</button>
          <div className="endereco-form-actions">
            <button className="btn-add" onClick={handleSave}>Salvar endereço</button>
          </div>
        </div>
        <MapaEntregaModal
          key={'mapa-end-' + mostrarMapa}
          isOpen={mostrarMapa}
          onClose={() => { setMostrarMapa(false); setCoordsIniciais(null) }}
          onConfirm={handleMapaConfirm}
          enderecoInicial={enderecoParaMapa}
          initialCoords={coordsIniciais}
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
  initialCoords,
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
    console.log('[MapaEntregaModal] Abrindo modal. enderecoInicial:', enderecoInicial, 'initialCoords:', initialCoords)
    mountedRef.current = true
    setPronto(false)
    setLat(null)
    setLng(null)
    setBuscando(true)
    setBuscaEndereco('')
    setErroBusca('')

    if (initialCoords?.lat && initialCoords?.lng) {
      console.log('[MapaEntregaModal] Usando coordenadas iniciais:', initialCoords)
      setLat(initialCoords.lat)
      setLng(initialCoords.lng)
      setBuscando(false)
      setPronto(true)
      return
    }

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
        // Remove CEP e parenteses do endereço para melhorar a busca no Nominatim
        const enderecoLimpo = enderecoInicial
          .replace(/\s*\([^)]*\)\s*/g, ' ')
          .replace(/- CEP:\s*[\d-]+/gi, '')
          .replace(/\s+/g, ' ').trim()
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
  }, [pronto, lat, lng])

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
    <div className="modal-overlay">
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
                <MapController lat={lat} lng={lng} />
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

function MapController({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 16)
  }, [lat, lng])
  return null
}

function MapClickHandler({ onClick }) {
  const map = useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

const PIZZARIA_ADDR = ''

const getLat = p => parseFloat(p.entrega_lat) || parseFloat(p.cliente?.lat) || parseFloat(p.cliente?.endereco_lat) || null
const getLng = p => parseFloat(p.entrega_lng) || parseFloat(p.cliente?.lng) || parseFloat(p.cliente?.endereco_lng) || null

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

const getDirectionId = (bearing) => {
  if (bearing >= 315 || bearing < 45) return 'norte'
  if (bearing >= 45 && bearing < 135) return 'leste'
  if (bearing >= 135 && bearing < 225) return 'sul'
  return 'oeste'
}

const ROTA_GRUPOS = {
  norte: { nome: 'Norte', icon: '⬆️' },
  sul: { nome: 'Sul', icon: '⬇️' },
  leste: { nome: 'Leste', icon: '➡️' },
  oeste: { nome: 'Oeste', icon: '⬅️' },
  semLocal: { nome: 'Sem localização', icon: '📍' }
}

function MotoboyPage({ onVoltar, userNome }) {
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [etapa, setEtapa] = useState('selecao')
  const [ordemOtimizada, setOrdemOtimizada] = useState([])
  const [entregaAtual, setEntregaAtual] = useState(0)
  const [navegacaoIniciada, setNavegacaoIniciada] = useState(false)
  const [motoboyPos, setMotoboyPos] = useState(null)
  const [erroGps, setErroGps] = useState(null)
  const [chegou, setChegou] = useState(false)
  const [confirmarModal, setConfirmarModal] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pizzariaCoords, setPizzariaCoords] = useState(null)
  const [concluidos, setConcluidos] = useState([])
  const [otimizando, setOtimizando] = useState(false)
  const mountedRef = useRef(true)
  const watchIdRef = useRef(null)
  const motoboyPosRef = useRef(null)
  const proximityNotifiedRef = useRef({})
  const prevPedidosCount = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    fetch(`${API}/admin/config/pizzaria`)
      .then(r => r.json())
      .then(data => {
        if (!mountedRef.current) return
        if (data.lat && data.lng) setPizzariaCoords({ lat: data.lat, lng: data.lng })
      }).catch(() => {})
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const carregar = () => {
      fetch(`${API}/orders`)
        .then(r => r.json())
        .then(data => {
          if (!mountedRef.current || !Array.isArray(data)) return
          const disponiveis = data.filter(p => p.status === 'liberado')
          if (disponiveis.length > prevPedidosCount.current && prevPedidosCount.current > 0) {
            try { navigator.vibrate?.([200, 100, 200]) } catch {}
          }
          prevPedidosCount.current = disponiveis.length
          setPedidosDisponiveis(disponiveis)
        }).catch(() => {})
    }
    carregar()
    const id = setInterval(carregar, 10000)
    return () => { clearInterval(id); mountedRef.current = false }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    if (!navigator.geolocation) { setErroGps('indisponivel'); return }
    let wakeLock = null
    navigator.wakeLock?.request('screen').then(l => wakeLock = l).catch(() => {})
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        motoboyPosRef.current = p
        if (mountedRef.current) { setMotoboyPos(p); setErroGps(null) }
      },
      err => { if (mountedRef.current) setErroGps(err.code) },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    )
    const timeout = setTimeout(() => {
      if (mountedRef.current && !motoboyPos) setErroGps('timeout')
    }, 20000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => { if (mountedRef.current) { setMotoboyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setErroGps(null) } },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
        navigator.wakeLock?.request('screen').then(l => wakeLock = l).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLock?.release()
    }
  }, [])

  useEffect(() => {
    if (!motoboyPos || !userNome) return
    const enviar = () => {
      fetch(`${API}/motoboy/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...motoboyPos, nome: userNome })
      }).catch(() => {})
    }
    enviar()
    const id = setInterval(enviar, 15000)
    return () => clearInterval(id)
  }, [motoboyPos, userNome])

  // Proximity detection for current delivery
  useEffect(() => {
    if (!motoboyPos || etapa !== 'entrega') return
    const p = ordemOtimizada[entregaAtual]
    if (!p) return
    const pLat = getLat(p)
    const pLng = getLng(p)
    if (!pLat || !pLng) return
    const d = haversineKm(motoboyPos.lat, motoboyPos.lng, pLat, pLng) * 1000
    if (d < 400 && !proximityNotifiedRef.current[p.id]) {
      proximityNotifiedRef.current[p.id] = true
      try { navigator.vibrate?.([200, 100, 200]) } catch {}
      fetch(`${API}/orders/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'entregador_proximo' })
      }).catch(() => {})
    }
    setChegou(d < 100)
  }, [motoboyPos, etapa, entregaAtual])

  const toggleSelecionado = (id) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const organizarRota = async () => {
    const selec = pedidosDisponiveis.filter(p => selecionados.includes(p.id))
    if (selec.length === 0) return
    setOtimizando(true)

    // Mark orders as 'em_rota' so other motoboys don't see them
    await Promise.all(selec.map(p =>
      fetch(`${API}/orders/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'em_rota' })
      }).catch(() => {})
    ))

    const temCoords = selec.filter(p => getLat(p) && getLng(p))
    const semCoords = selec.filter(p => !getLat(p) || !getLng(p))

    if (motoboyPos && pizzariaCoords && temCoords.length >= 1) {
      try {
        const coordsStr = [
          `${motoboyPos.lng},${motoboyPos.lat}`,
          ...temCoords.map(p => `${getLng(p)},${getLat(p)}`),
          `${pizzariaCoords.lng},${pizzariaCoords.lat}`
        ].join(';')
        const r = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordsStr}?source=first&destination=last&overview=false`)
        if (r.ok) {
          const data = await r.json()
          if (data.code === 'Ok') {
            const waypoints = data.trips[0].waypoints
            const rotaOtimizada = waypoints.slice(1, -1).map((wp) => ({
              ...temCoords[wp.waypoint_index - 1],
            }))
            const semCoordsOrd = [...semCoords].sort((a, b) => new Date(a.data) - new Date(b.data))
            setOrdemOtimizada([...rotaOtimizada, ...semCoordsOrd])
            setEtapa('organizar')
            setOtimizando(false)
            setEntregaAtual(0)
            return
          }
        }
      } catch (_) {}
    }

    const ordenados = [...selec].sort((a, b) => {
      const aLat = getLat(a); const aLng = getLng(a)
      const bLat = getLat(b); const bLng = getLng(b)
      const da = aLat && motoboyPos ? haversineKm(motoboyPos.lat, motoboyPos.lng, aLat, aLng) : Infinity
      const db = bLat && motoboyPos ? haversineKm(motoboyPos.lat, motoboyPos.lng, bLat, bLng) : Infinity
      if (da !== db) return da - db
      return new Date(a.data) - new Date(b.data)
    })
    setOrdemOtimizada(ordenados)
    setEtapa('organizar')
    setOtimizando(false)
    setEntregaAtual(0)
  }

  const iniciarNavegacao = () => {
    setNavegacaoIniciada(true)
    const p = ordemOtimizada[entregaAtual]
    if (!p) return
    const lat = getLat(p)
    const lng = getLng(p)
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`, '_blank')
    } else if (p?.cliente?.endereco) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.cliente.endereco)}&travelmode=driving&dir_action=navigate`, '_blank')
    }
  }

  const reiniciarNavegacao = () => {
    const p = ordemOtimizada[entregaAtual]
    if (!p) return
    const lat = getLat(p)
    const lng = getLng(p)
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`, '_blank')
    }
  }

  const confirmarEntrega = async (id) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'entregue' })
    })
    setConfirmarModal(null)
    setNavegacaoIniciada(false)
    setChegou(false)
    setConcluidos(prev => [...prev, id])
    if (entregaAtual + 1 >= ordemOtimizada.length) {
      setEtapa('selecao')
      setOrdemOtimizada([])
      setSelecionados([])
      setEntregaAtual(0)
      return
    }
    setEntregaAtual(prev => prev + 1)
  }

  const formatTel = (t) => {
    if (!t) return ''
    const s = t.replace(/\D/g, '')
    if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`
    if (s.length === 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`
    return t
  }

  // ========== GROUP LOGIC (for selection screen) ==========
  const pedidosAgrupados = (() => {
    if (!pizzariaCoords) return []
    const mapa = {}
    pedidosDisponiveis.forEach(p => {
      const pLat = getLat(p); const pLng = getLng(p)
      let id = 'semLocal'
      if (pLat && pLng && pizzariaCoords) {
        const bearing = getBearing(pizzariaCoords.lat, pizzariaCoords.lng, pLat, pLng)
        id = getDirectionId(bearing)
      }
      if (!mapa[id]) mapa[id] = []
      let dist = Infinity
      if (pLat && pLng) {
        if (motoboyPos) dist = haversineKm(motoboyPos.lat, motoboyPos.lng, pLat, pLng)
        else dist = haversineKm(pizzariaCoords.lat, pizzariaCoords.lng, pLat, pLng)
      }
      mapa[id].push({ ...p, _dist: dist })
    })
    Object.values(mapa).forEach(g => g.sort((a, b) => a._dist - b._dist))
    const arr = Object.entries(mapa).map(([id, itens]) => ({
      id, itens,
      minDist: Math.min(...itens.map(i => i._dist))
    }))
    arr.sort((a, b) => {
      if (a.id === 'semLocal') return 1
      if (b.id === 'semLocal') return -1
      return a.minDist - b.minDist
    })
    let prio = 0
    arr.forEach(g => g.itens.forEach(i => { i._prio = ++prio }))
    return arr
  })()

  // ========== RENDER ==========
  if (erroGps === 'indisponivel') {
    return (
      <div className="motoboy-page" style={{display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
        <div><div style={{fontSize:48,marginBottom:16}}>📍</div><p style={{color:'#888',fontSize:14}}>GPS não suportado.</p></div>
      </div>
    )
  }

  const topBar = (titulo, children) => (
    <div className="motoboy-topo">
      <div className="motoboy-topo-titulo">{titulo}</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {children}
        <div className="motoboy-menu-container">
          <button className="motoboy-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          {menuOpen && (
            <div className="motoboy-menu-dropdown">
              <button onClick={onVoltar}>🚪 Sair</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ===== TELA 1: SELEÇÃO =====
  if (etapa === 'selecao') {
    return (
      <div className="motoboy-page">
        {topBar('🛵 Selecionar entregas')}
        {pedidosDisponiveis.length === 0 ? (
          <div className="motoboy-vazio" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
            <div className="motoboy-vazio-icone">🛵</div>
            <p className="motoboy-vazio-texto">Nenhuma entrega disponível</p>
            <p className="motoboy-vazio-sub">Aguardando novos pedidos...</p>
            {erroGps === 1 && <p className="motoboy-gps-aviso">⚠️ Permissão de localização negada.</p>}
            {erroGps === 2 && <p className="motoboy-gps-aviso">⚠️ GPS indisponível.</p>}
            {erroGps === 'timeout' && <p className="motoboy-gps-aviso">⏳ GPS não respondeu.</p>}
          </div>
        ) : (
          <div className="motoboy-selecao">
            {pedidosAgrupados.map(grupo => (
              <div key={grupo.id} className={`motoboy-grupo${grupo.id !== 'semLocal' ? ' ' + grupo.id : ''}`}>
                <div className="motoboy-grupo-header">
                  <span className="motoboy-grupo-nome">
                    {ROTA_GRUPOS[grupo.id]?.icon || ''} {ROTA_GRUPOS[grupo.id]?.nome || 'Indefinido'}
                  </span>
                  <span className="motoboy-grupo-qtd">{grupo.itens.length} entrega{grupo.itens.length !== 1 ? 's' : ''}</span>
                </div>
                {grupo.itens.map(p => {
                  const sel = selecionados.includes(p.id)
                  return (
                    <div key={p.id} className={`motoboy-card${sel ? ' motoboy-card-checked' : ''}`} onClick={() => toggleSelecionado(p.id)}>
                      <div className="motoboy-check"><div className={`cb${sel ? ' on' : ''}`}>{sel ? '✓' : ''}</div></div>
                      <div className="motoboy-card-corpo">
                        <div className="motoboy-card-linha">
                          <strong className="motoboy-card-nome">{p.cliente?.nome}</strong>
                          <span className="motoboy-card-valor">R$ {p.total?.toFixed(2)}</span>
                        </div>
                        <span className="motoboy-card-end">📍 {p.cliente?.endereco}</span>
                        <span className="motoboy-card-tel">📞 {formatTel(p.cliente?.telefone)}</span>
                        <div className="motoboy-card-info-rota">
                          {p._dist < Infinity && <span className="motoboy-card-dist">📏 {p._dist.toFixed(1)} km</span>}
                          <span className="motoboy-card-hora">🕐 {new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="motoboy-card-itens">
                          {p.itens?.map(item => (
                            <span key={item.id} className={`motoboy-card-item${item.tipo !== 'pizza' ? ' motoboy-item-badge-m' : ''}`}>
                              {item.qtd}x {item.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
        <div className="motoboy-rodape">
          <button className="motoboy-btn-primario" disabled={selecionados.length === 0 || otimizando} onClick={organizarRota}>
            {otimizando ? '🔄 Organizando...' : `📦 Pegar entregas (${selecionados.length})`}
          </button>
        </div>
      </div>
    )
  }

  // ===== TELA 2: ORGANIZAR =====
  if (etapa === 'organizar') {
    const total = ordemOtimizada.length
    return (
      <div className="motoboy-page">
        {topBar('📋 Organizar mercadoria')}
        <div className="motoboy-organizar">
          <div className="motoboy-progresso-indicator" style={{margin: '0 20px 12px'}}>
            <div className="motoboy-progresso-texto">{concluidos.length + 1} de {concluidos.length + total} entregas</div>
            <div className="motoboy-progresso-barra">
              <div className="motoboy-progresso-preenchido" style={{width: `${(concluidos.length / (concluidos.length + total)) * 100}%`}} />
            </div>
          </div>
          <div className="motoboy-organizar-lista">
            {ordemOtimizada.map((p, idx) => {
              const eAtual = idx === entregaAtual
              const temBebidas = p.itens?.filter(i => i.tipo !== 'pizza')?.length > 0
              return (
                <div key={p.id} className={`motoboy-org-card${eAtual ? ' motoboy-org-card-atual' : ''}${idx < entregaAtual ? ' motoboy-org-card-feito' : ''}`}>
                  <div className="motoboy-org-ordem">{idx + 1}</div>
                  <div className="motoboy-org-conteudo">
                    <div className="motoboy-org-header">
                      <strong className="motoboy-org-nome">{p.cliente?.nome}</strong>
                      <span className="motoboy-org-valor">R$ {p.total?.toFixed(2)}</span>
                    </div>
                    <span className="motoboy-org-endereco">📍 {p.cliente?.endereco}</span>
                    <span className="motoboy-org-tel">📞 {formatTel(p.cliente?.telefone)}</span>
                    <div className="motoboy-org-itens">
                      {p.itens?.map(item => (
                        <span key={item.id} className={`motoboy-org-item${item.tipo !== 'pizza' ? ' motoboy-org-item-bebida' : ''}`}>
                          {item.qtd}x {item.nome}
                          {item.tipo !== 'pizza' && <span className="motoboy-item-badge">🥤</span>}
                        </span>
                      ))}
                    </div>
                    {temBebidas && (
                      <div className="motoboy-org-aviso">📌 Não esqueça das bebidas!</div>
                    )}
                  </div>
                  {eAtual && (
                    <div className="motoboy-org-badge-atual">PRÓXIMO</div>
                  )}
                  {idx < entregaAtual && (
                    <div className="motoboy-org-check">✅</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="motoboy-rodape">
          <button className="motoboy-btn-primario" onClick={() => setEtapa('entrega')}>
            🗺️ Iniciar entregas
          </button>
        </div>
      </div>
    )
  }

  // ===== TELA 3: ENTREGA =====
  const p = ordemOtimizada[entregaAtual]
  if (!p) {
    return (
      <div className="motoboy-page">
        {topBar('🛵 Entregas')}
        <div className="motoboy-vazio" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
          <div className="motoboy-vazio-icone">✅</div>
          <p className="motoboy-vazio-texto">Todas concluídas!</p>
        </div>
      </div>
    )
  }

  const temBebidas = p.itens?.filter(i => i.tipo !== 'pizza')?.length > 0

  return (
    <div className="motoboy-page">
      <div className="motoboy-topo">
        <button className="motoboy-btn-voltar-lista" onClick={() => setEtapa('organizar')}>←</button>
        <div className="motoboy-progresso-indicator" style={{flex:1}}>
          <div className="motoboy-progresso-texto">{entregaAtual + 1} de {ordemOtimizada.length}</div>
          <div className="motoboy-progresso-barra">
            <div className="motoboy-progresso-preenchido" style={{width: `${((entregaAtual + 1) / ordemOtimizada.length) * 100}%`}} />
          </div>
        </div>
        <div className="motoboy-menu-container">
          <button className="motoboy-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          {menuOpen && (
            <div className="motoboy-menu-dropdown">
              <button onClick={onVoltar}>🚪 Sair</button>
            </div>
          )}
        </div>
      </div>

      <div className="motoboy-delivery-screen">
        <div className="motoboy-cliente-section">
          <div className="motoboy-cliente-avatar">{p.cliente?.nome?.charAt(0)?.toUpperCase() || '?'}</div>
          <div className="motoboy-cliente-info">
            <h2 className="motoboy-cliente-nome">{p.cliente?.nome || 'Cliente'}</h2>
            <div className="motoboy-cliente-detalhes">
              <span className="motoboy-cliente-endereco">📍 {p.cliente?.endereco || 'Endereço não informado'}</span>
              <a href={`tel:${p.cliente?.telefone}`} className="motoboy-cliente-telefone">📞 {formatTel(p.cliente?.telefone) || '---'}</a>
            </div>
          </div>
        </div>

        <div className="motoboy-pedido-section">
          <h3 className="motoboy-pedido-titulo">📋 Itens do pedido</h3>
          <div className="motoboy-pedido-itens">
            {p.itens?.map(item => (
              <div key={item.id} className={`motoboy-pedido-item ${item.tipo !== 'pizza' ? 'motoboy-item-bebida' : ''}`}>
                <span className="motoboy-pedido-qtd">{item.qtd}x</span>
                <span className="motoboy-pedido-nome">{item.nome}</span>
                {item.tipo !== 'pizza' && <span className="motoboy-item-badge">🥤</span>}
              </div>
            ))}
          </div>
          <div className="motoboy-pedido-total">
            <span>Total</span>
            <strong>R$ {p.total?.toFixed(2)}</strong>
          </div>
        </div>

        <div className="motoboy-actions-section">
          {!navegacaoIniciada ? (
            <button className="motoboy-btn-navegar-grande" onClick={iniciarNavegacao}>
              <span className="motoboy-btn-navegar-icone">🗺️</span>
              <span className="motoboy-btn-navegar-texto">
                <strong>Iniciar navegação</strong>
                <small>Abrir Google Maps para esta entrega</small>
              </span>
            </button>
          ) : (
            <div className="motoboy-actions-row">
              <button className="motoboy-btn-navegar-pequeno" onClick={reiniciarNavegacao}>
                🗺️ Navegar
              </button>
              {pizzariaCoords && (
                <button className="motoboy-btn-voltar-pizzaria" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${pizzariaCoords.lat},${pizzariaCoords.lng}&travelmode=driving&dir_action=navigate`, '_blank')}>
                  ↩ Voltar
                </button>
              )}
              <button
                className={`motoboy-btn-concluir ${chegou ? 'motoboy-btn-chamativo' : ''}`}
                onClick={() => { if (chegou) setConfirmarModal(p) }}
                disabled={!chegou}
              >
                {chegou ? '✅ Concluir entrega' : '📦 Entregar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmarModal && (
        <div className="modal-overlay" onClick={() => setConfirmarModal(null)}>
          <div className="motoboy-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="motoboy-confirm-header">
              <div className="motoboy-confirm-avatar">{p.cliente?.nome?.charAt(0)?.toUpperCase() || '?'}</div>
              <div>
                <h3>Confirmar entrega</h3>
                <p className="motoboy-confirm-cliente">{p.cliente?.nome}</p>
              </div>
            </div>
            <div className="motoboy-confirm-itens">
              {p.itens?.map(item => (
                <div key={item.id} className="motoboy-confirm-item">
                  <span>{item.qtd}x {item.nome}</span>
                  {item.tipo !== 'pizza' && <span className="motoboy-item-badge">🥤</span>}
                </div>
              ))}
            </div>
            {temBebidas && (
              <p className="motoboy-confirm-aviso">📌 Verifique se as bebidas foram entregues</p>
            )}
            <div className="motoboy-confirm-actions">
              <button className="motoboy-btn-cancelar" onClick={() => setConfirmarModal(null)}>Voltar</button>
              <button className="motoboy-btn-confirmar" onClick={() => confirmarEntrega(p.id)}>✅ Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MotoboyStandalone() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('motoboy_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('motoboy_token') || '')
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [semPermissao, setSemPermissao] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.style.background = '#0D0D0D'
    return () => {
      document.body.style.overflow = ''
      document.body.style.background = ''
    }
  }, [])

  useEffect(() => {
    if (!user || !token) { setVerificando(false); return }
    setVerificando(true)
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.role === 'motoboy' || data.role === 'admin') {
          if (data.status === 'ativo' || data.status === 'aprovado') {
            setUser(data)
            localStorage.setItem('motoboy_user', JSON.stringify(data))
            setSemPermissao(false)
          } else {
            setSemPermissao(true)
          }
        } else {
          setSemPermissao(true)
        }
      })
      .catch(() => { setUser(null); setToken(''); localStorage.removeItem('motoboy_user'); localStorage.removeItem('motoboy_token') })
      .finally(() => setVerificando(false))
  }, [])

  useEffect(() => {
    if (user?.id) registerFCMToken(user.id)
  }, [user?.id])

  const handleLogin = async (e) => {
    e?.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Email ou senha inválidos'); return }
      if (data.user.role !== 'motoboy' && data.user.role !== 'admin') {
        setErro('Você não tem permissão para acessar o painel do motoboy')
        return
      }
      if (data.user.status !== 'ativo' && data.user.status !== 'aprovado') {
        setSemPermissao(true)
        return
      }
      setUser(data.user)
      setToken(data.token)
      localStorage.setItem('motoboy_user', JSON.stringify(data.user))
      localStorage.setItem('motoboy_token', data.token)
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: '433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com',
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error) { setErro('Erro ao autenticar com Google'); return }
          try {
            setLoading(true)
            const r = await fetch(`${API}/auth/google`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: response.access_token })
            })
            const data = await r.json()
            if (data.token && data.user) {
              if (data.user.role !== 'motoboy' && data.user.role !== 'admin') {
                setErro('Você não tem permissão para acessar o painel do motoboy')
                return
              }
              if (data.user.status !== 'ativo' && data.user.status !== 'aprovado') {
                setSemPermissao(true)
                return
              }
              setUser(data.user)
              setToken(data.token)
              localStorage.setItem('motoboy_user', JSON.stringify(data.user))
              localStorage.setItem('motoboy_token', data.token)
            } else setErro(data.erro || 'Erro ao autenticar')
          } catch { setErro('Erro de conexão') }
          finally { setLoading(false) }
        }
      })
      client.requestAccessToken()
    } catch { setErro('Erro ao iniciar login Google') }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, telefone: '', endereco: '' })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Erro ao cadastrar'); return }
      setErro('Conta criada! Faça login para continuar.')
      setModo('login')
      setEmail(email)
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }

  const handleLogout = () => {
    setUser(null)
    setToken('')
    setSemPermissao(false)
    localStorage.removeItem('motoboy_user')
    localStorage.removeItem('motoboy_token')
  }

  if (verificando) {
    return (
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0D0D0D',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
        <div style={{fontSize:48}}>🛵</div>
        <p style={{color:'#888',fontSize:14,margin:0}}>Verificando...</p>
      </div>
    )
  }

  if (user && token && semPermissao) {
    return (
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0D0D0D',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:320}}>
          <div style={{fontSize:64,marginBottom:16}}>🔒</div>
          <h2 style={{color:'#fff',fontSize:22,margin:'0 0 8px'}}>Sem permissão</h2>
          <p style={{color:'#888',fontSize:14,lineHeight:1.5,margin:'0 0 24px'}}>
            Sua conta ainda não foi liberada para usar o painel do motoboy.
            Entre em contato com o administrador.
          </p>
          <button onClick={handleLogout}
            style={{width:'100%',padding:'14px',borderRadius:12,border:'none',fontSize:16,fontWeight:600,cursor:'pointer',background:'#E53935',color:'#fff'}}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  if (user && token) {
    return <MotoboyPage onVoltar={handleLogout} userNome={user.nome} />
  }

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0D0D0D',color:'#fff',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 24px 48px',gap:16}}>
        <div style={{fontSize:64,marginBottom:4}}>🛵</div>
        <h1 style={{fontSize:24,fontWeight:700,margin:0,textAlign:'center'}}>Israelita Entregas</h1>
        <p style={{fontSize:14,color:'#888',margin:0,textAlign:'center',marginBottom:8}}>Faça login para começar suas entregas</p>

        {erro && <p style={{color:'#FF5252',fontSize:13,margin:0}}>{erro}</p>}

        {modo === 'login' ? (
          <form onSubmit={handleLogin} style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:12}}>
            <input style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid #333',background:'#1A1A1A',color:'#fff',fontSize:16,outline:'none',boxSizing:'border-box'}} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid #333',background:'#1A1A1A',color:'#fff',fontSize:16,outline:'none',boxSizing:'border-box'}} type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
            <button style={{width:'100%',padding:'14px',borderRadius:12,border:'none',fontSize:16,fontWeight:600,cursor:'pointer',background:'linear-gradient(135deg,#FF8F00,#FF6D00)',color:'#fff'}} type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:12}}>
            <input style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid #333',background:'#1A1A1A',color:'#fff',fontSize:16,outline:'none',boxSizing:'border-box'}} placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} required />
            <input style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid #333',background:'#1A1A1A',color:'#fff',fontSize:16,outline:'none',boxSizing:'border-box'}} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'1px solid #333',background:'#1A1A1A',color:'#fff',fontSize:16,outline:'none',boxSizing:'border-box'}} type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
            <button style={{width:'100%',padding:'14px',borderRadius:12,border:'none',fontSize:16,fontWeight:600,cursor:'pointer',background:'linear-gradient(135deg,#FF8F00,#FF6D00)',color:'#fff'}} type="submit" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </button>
          </form>
        )}

        <div style={{width:'100%',maxWidth:320,display:'flex',alignItems:'center',gap:12,color:'#555',fontSize:13}}>
          <div style={{flex:1,height:1,background:'#333'}}></div>
          <span>ou</span>
          <div style={{flex:1,height:1,background:'#333'}}></div>
        </div>

        <button style={{width:'100%',maxWidth:320,padding:'14px',borderRadius:12,border:'1px solid #333',fontSize:16,fontWeight:600,cursor:'pointer',background:'#1A1A1A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:10}} onClick={handleGoogleLogin} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span>Entrar com Google</span>
        </button>

        <p style={{fontSize:13,color:'#888',margin:0}}>
          {modo === 'login' ? (
            <>Não tem conta? <button style={{color:'#FF8F00',cursor:'pointer',background:'none',border:'none',fontSize:13,fontWeight:600}} onClick={() => { setModo('signup'); setErro('') }}>Cadastre-se</button></>
          ) : (
            <>Já tem conta? <button style={{color:'#FF8F00',cursor:'pointer',background:'none',border:'none',fontSize:13,fontWeight:600}} onClick={() => { setModo('login'); setErro('') }}>Faça login</button></>
          )}
        </p>
      </div>
    </div>
  )
}

export default App

