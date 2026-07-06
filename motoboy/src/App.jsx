import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Bike, MapPin, Clock, CheckCircle, X, Navigation, Phone, Pizza, LogOut, User, ArrowUp, ArrowDown, ShoppingBag, Package } from 'lucide-react'
import { registerFCMToken } from './firebase'

const API = '/api'

const GOOGLE_CLIENT_ID = '433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com'

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
        if (data.user.role !== 'motoboy') {
          if (s.setErro) s.setErro('Esta conta não é de um entregador')
          return
        }
        s.onLogin && s.onLogin(data.user, data.token)
      } else if (s.setErro) s.setErro(data.erro || 'Erro ao autenticar')
    } catch { if (s.setErro) s.setErro('Erro de conexão') }
  })()
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('motoboyToken') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('motoboyUser')
    return saved ? JSON.parse(saved) : null
  })
  const [autenticado, setAutenticado] = useState(false)

  useEffect(() => {
    if (token && user) setAutenticado(true)
  }, [token, user])

  const handleLogin = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
    localStorage.setItem('motoboyToken', userToken)
    localStorage.setItem('motoboyUser', JSON.stringify(userData))
    setAutenticado(true)
  }

  const handleLogout = () => {
    setUser(null)
    setToken('')
    setAutenticado(false)
    localStorage.removeItem('motoboyToken')
    localStorage.removeItem('motoboyUser')
    localStorage.removeItem('motoboyOnline')
  }

  if (!autenticado) return <MotoboyLogin onLogin={handleLogin} />

  return <MotoboyDashboard user={user} token={token} onLogout={handleLogout} />
}

function MotoboyLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  window.__authSetters = { onLogin, setErro }

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: window.__googleCallback
      })
      client.requestAccessToken()
    } catch {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/motoboy/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      })
      const data = await res.json()
      if (data.token && data.user) {
        onLogin(data.user, data.token)
      } else {
        setErro(data.erro || 'Credenciais inválidas')
      }
    } catch {
      setErro('Erro de conexão')
    }
    setLoading(false)
  }

  return (
    <div className="motoboy-app">
      <div className="motoboy-login">
        <div className="motoboy-login-card">
          <div className="motoboy-login-icon"><Bike size={52} /></div>
          <h2>Entregador</h2>
          <p className="motoboy-login-desc">Faça login para começar as entregas</p>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="Email" value={email} onChange={e => { setEmail(e.target.value); setErro('') }} autoFocus />
            <input type="password" placeholder="Senha" value={senha} onChange={e => { setSenha(e.target.value); setErro('') }} />
            {erro && <p className="erro">{erro}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <hr className="auth-divider" />
          <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>Entrar com Google</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getDirecao(pedido, origem) {
  if (!origem) return null
  const plat = parseFloat(pedido.entrega_lat) || parseFloat(pedido.cliente?.lat) || parseFloat(pedido.cliente?.endereco_lat)
  const plng = parseFloat(pedido.entrega_lng) || parseFloat(pedido.cliente?.lng) || parseFloat(pedido.cliente?.endereco_lng)
  if (!plat || !plng) return null
  const dLat = plat - origem.lat
  const dLng = plng - origem.lng
  const ang = Math.atan2(dLng, dLat) * 180 / Math.PI
  if (ang >= -45 && ang < 45) return 'N'
  if (ang >= 45 && ang < 135) return 'L'
  if (ang >= -135 && ang < -45) return 'O'
  return 'S'
}

const DIRECOES = { N: 'Norte', S: 'Sul', L: 'Leste', O: 'Oeste' }
const DIR_CORES = { N: '#2196F3', S: '#4CAF50', L: '#FF9800', O: '#9C27B0' }

function sugerirRota(pedidos, origem) {
  if (!pedidos.length) return pedidos
  const restantes = [...pedidos]
  const rota = []
  let atual = origem ? { lat: origem.lat, lng: origem.lng } : null
  while (restantes.length > 0) {
    let menorDist = Infinity
    let idx = 0
    restantes.forEach((p, i) => {
      const plat = parseFloat(p.entrega_lat) || parseFloat(p.cliente?.lat) || parseFloat(p.cliente?.endereco_lat) || 0
      const plng = parseFloat(p.entrega_lng) || parseFloat(p.cliente?.lng) || parseFloat(p.cliente?.endereco_lng) || 0
      if (atual) {
        const dist = haversineKm(atual.lat, atual.lng, plat, plng)
        if (dist < menorDist) { menorDist = dist; idx = i }
      }
    })
    rota.push(restantes[idx])
    const plat = parseFloat(restantes[idx].entrega_lat) || parseFloat(restantes[idx].cliente?.lat) || parseFloat(restantes[idx].cliente?.endereco_lat) || 0
    const plng = parseFloat(restantes[idx].entrega_lng) || parseFloat(restantes[idx].cliente?.lng) || parseFloat(restantes[idx].cliente?.endereco_lng) || 0
    atual = { lat: plat, lng: plng }
    restantes.splice(idx, 1)
  }
  return rota
}

function getLat(p) {
  return parseFloat(p.entrega_lat) || parseFloat(p.cliente?.lat) || parseFloat(p.cliente?.endereco_lat) || null
}
function getLng(p) {
  return parseFloat(p.entrega_lng) || parseFloat(p.cliente?.lng) || parseFloat(p.cliente?.endereco_lng) || null
}

function MotoboyDashboard({ user, token, onLogout }) {
  const [online, setOnline] = useState(() => {
    const saved = localStorage.getItem('motoboyOnline')
    return saved !== null ? saved === 'true' : true
  })
  const [pos, setPos] = useState(null)
  const [watchId, setWatchId] = useState(null)
  const [timer, setTimer] = useState(0)
  const [permissaoGps, setPermissaoGps] = useState(true)
  const [tela, setTela] = useState('disponiveis')
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState([])
  const [meusPedidos, setMeusPedidos] = useState([])
  const [rotaPlanejada, setRotaPlanejada] = useState([])
  const [indiceEntrega, setIndiceEntrega] = useState(0)
  const [selecionados, setSelecionados] = useState(new Set())
  const [pizzaria, setPizzaria] = useState(null)
  const [pegando, setPegando] = useState(false)
  const [erroPegar, setErroPegar] = useState('')
  const timerRef = useRef(null)
  const onlineRef = useRef(online)
  const posRef = useRef(pos)

  onlineRef.current = online
  posRef.current = pos

  const enviarPosicao = useCallback(async (lat, lng) => {
    if (!onlineRef.current) return
    try {
      await fetch(`${API}/motoboy/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, nome: user?.nome || 'Motoboy' })
      })
    } catch {}
  }, [user])

  const sendHeartbeat = useCallback(() => {
    fetch(`${API}/motoboy/position`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: posRef.current?.lat, lng: posRef.current?.lng, nome: user?.nome || 'Motoboy' })
    }).catch(() => {})
  }, [user])

  const sendOffline = useCallback(() => {
    fetch(`${API}/motoboy/offline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: user?.nome || 'Motoboy' })
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (online) {
      localStorage.setItem('motoboyOnline', 'true')
      sendHeartbeat()
      const id = navigator.geolocation.watchPosition(
        (p) => {
          const { latitude: lat, longitude: lng } = p.coords
          setPos({ lat, lng })
          enviarPosicao(lat, lng)
          setPermissaoGps(true)
        },
        () => setPermissaoGps(false),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      )
      setWatchId(id)
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      localStorage.setItem('motoboyOnline', 'false')
      sendOffline()
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
      clearInterval(timerRef.current)
    }
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearInterval(timerRef.current)
    }
  }, [online])

  useEffect(() => {
    ;(async () => {
      if (user?.id) {
        const fcmToken = await registerFCMToken(user.id)
        if (fcmToken) console.log('FCM registrado')
      }
    })()
  }, [user?.id])

  useEffect(() => {
    if (!online || !pos) return
    const id = setInterval(() => {
      if (posRef.current) enviarPosicao(posRef.current.lat, posRef.current.lng)
    }, 10000)
    return () => clearInterval(id)
  }, [online, pos])

  useEffect(() => {
    fetch(`${API}/admin/config/pizzaria`)
      .then(r => r.json())
      .then(data => { if (data.lat && data.lng) setPizzaria(data) })
      .catch(() => {})
  }, [])

  /* Cria/reusa AudioContext e tenta destravar */
  function getAudioCtx() {
    const ref = audioCtxUnlockRef
    if (!ref.current) {
      ref.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ref.current.state === 'suspended') {
      ref.current.resume().catch(() => {})
    }
    return ref.current
  }

  function tocarSom(vezes) {
    try {
      const ctx = audioCtxUnlockRef.current || getAudioCtx()
      for (let i = 0; i < vezes; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 660 + i * 110
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.3)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.3 + 0.2)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.3); osc.stop(ctx.currentTime + i * 0.3 + 0.2)
      }
    } catch {}
  }

  /* Som global de novos liberados (qualquer tela) */
  const notifLiberadosRef = useRef(0)
  useEffect(() => {
    let mounted = true
    const buscar = () => {
      fetch(`${API}/motoboy/pedidos-disponiveis`).then(r => r.json()).then(data => {
        if (!mounted || !Array.isArray(data)) return
        const lib = data.filter(p => p.status === 'liberado').length
        if (lib > notifLiberadosRef.current && notifLiberadosRef.current > 0) tocarSom(2)
        notifLiberadosRef.current = lib
      }).catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const carregarDisponiveis = useCallback(async () => {
    try {
      const res = await fetch(`${API}/motoboy/pedidos-disponiveis`)
      const data = await res.json()
      if (Array.isArray(data)) { setPedidosDisponiveis(data) }
      else console.error('Resposta inesperada:', data)
    } catch (e) { console.error('Erro carregarDisponiveis:', e) }
  }, [])

  const carregarMeusPedidos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/motoboy/pedidos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setMeusPedidos(data)
    } catch (e) { console.error('Erro meus pedidos:', e) }
  }, [token])

  useEffect(() => {
    if (tela === 'disponiveis') {
      carregarDisponiveis()
      const id = setInterval(carregarDisponiveis, 3000)
      return () => clearInterval(id)
    }
  }, [tela, carregarDisponiveis])

  useEffect(() => {
    if (tela === 'entrega' || tela === 'organizar') {
      carregarMeusPedidos()
      const id = setInterval(carregarMeusPedidos, 3000)
      return () => clearInterval(id)
    }
  }, [tela, carregarMeusPedidos])

  useEffect(() => {
    if (meusPedidos.length > 0 && rotaPlanejada.length > 0) {
      setRotaPlanejada(prev => prev.map(p => {
        const atualizado = meusPedidos.find(m => m.id === p.id)
        return atualizado || p
      }))
    }
  }, [meusPedidos])

  const toggleSelecionado = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const pegarPedidos = async () => {
    setPegando(true)
    setErroPegar('')
    const ids = [...selecionados]
    const pegos = []
    const nome = user?.nome || 'Motoboy'
    for (const id of ids) {
      try {
        const res = await fetch(`${API}/motoboy/pegar-pedido`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidoId: id, nome })
        })
        if (res.status === 409) {
          setErroPegar(`Pedido #${id} já foi pego por outro entregador`)
        } else if (res.status === 400) {
          setErroPegar(`Pedido #${id} não está mais disponível`)
        } else if (res.ok) {
          pegos.push(id)
        } else {
          console.error('Erro ao pegar pedido', id, res.status, await res.text().catch(() => ''))
        }
      } catch (e) { console.error('Erro fetch pegar pedido', e) }
    }
    setSelecionados(new Set())
    setPegando(false)
    if (pegos.length === 0) { carregarDisponiveis(); return }
    const pegosComDados = pedidosDisponiveis.filter(p => pegos.includes(p.id))
    const ordenados = sugerirRota(pegosComDados, pizzaria)
    setRotaPlanejada(ordenados)
    setIndiceEntrega(0)
    setTela('organizar')
  }

  const iniciarRota = async () => {
    for (const p of rotaPlanejada) {
      if (p.status === 'liberado') {
        await fetch(`${API}/orders/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'em_rota' })
        })
      }
    }
    setIndiceEntrega(0)
    setTela('entrega')
  }

  const finalizarEntrega = async (id) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'entregue' })
    })
    const novoIndice = indiceEntrega + 1
    if (novoIndice >= rotaPlanejada.length) {
      setRotaPlanejada([])
      setIndiceEntrega(0)
      setTela('disponiveis')
    } else {
      setIndiceEntrega(novoIndice)
    }
  }

  const moverItem = (idx, dir) => {
    const nova = [...rotaPlanejada]
    const target = idx + dir
    if (target < 0 || target >= nova.length) return
    const temp = nova[target]
    nova[target] = nova[idx]
    nova[idx] = temp
    setRotaPlanejada(nova)
  }

  const formatTimer = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const tempoDecorrido = (data) => {
    if (!data) return ''
    const diff = Date.now() - new Date(data).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return '<1 min'
    return `${min} min`
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'Saiu p/ entrega', em_rota: 'Em rota', entregador_proximo: 'Chegando!', entregue: 'Entregue', recusado: 'Cancelado' }
  const badgeClass = { pendente: 'badge badge-warning', aceito: 'badge badge-info', liberado: 'badge badge-liberate', em_rota: 'badge badge-amber', entregador_proximo: 'badge badge-amber', entregue: 'badge badge-success', recusado: 'badge badge-destructive' }

  return (
    <div className="motoboy-app">
      <div className="motoboy-dashboard">
        <header className="motoboy-header">
          <div className="motoboy-header-left">
            <strong className="motoboy-header-nome">{user?.nome || 'Entregador'}</strong>
            <span className={`motoboy-header-status ${online ? 'motoboy-status-online' : 'motoboy-status-offline'}`}>
              ● {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <button className="topbar-btn" onClick={onLogout} title="Sair"><LogOut size={16} /></button>
        </header>

        <div className="motoboy-content">
          {!permissaoGps && (
            <div className="motoboy-alerta">
              <Navigation size={16} />
              <span>Permissão de localização necessária para ficar online</span>
            </div>
          )}

          <div className={`motoboy-status-card ${online ? 'motoboy-online' : 'motoboy-offline'}`}>
            <div className="motoboy-status-info">
              <span className="motoboy-status-dot" />
              <span className="motoboy-status-text">
                {online ? 'Online — enviando posição' : 'Offline'}
              </span>
            </div>
            {online && <span className="motoboy-timer">{formatTimer(timer)}</span>}
            <button
              className={`btn ${online ? 'btn-destructive' : 'btn-primary'} btn-sm`}
              onClick={() => setOnline(!online)}
              disabled={!online && !permissaoGps}
            >
              {online ? 'Ficar Offline' : 'Ficar Online'}
            </button>
          </div>

          {erroPegar && (
            <div className="motoboy-alerta" style={{ color: 'var(--destructive)', borderColor: 'color-mix(in oklch, var(--destructive) 25%, transparent)', background: 'color-mix(in oklch, var(--destructive) 8%, transparent)' }}>
              <X size={16} />
              <span>{erroPegar}</span>
              <button className="topbar-btn" onClick={() => setErroPegar('')} style={{ marginLeft: 'auto', flexShrink: 0 }}><X size={14} /></button>
            </div>
          )}

          {tela === 'disponiveis' && (
            <TelaDisponiveis
              pedidos={pedidosDisponiveis}
              selecionados={selecionados}
              onToggle={toggleSelecionado}
              onPegar={pegarPedidos}
              pegando={pegando}
              tempoDecorrido={tempoDecorrido}
              badgeClass={badgeClass}
              statusLabel={statusLabel}
              pos={pos}
              pizzaria={pizzaria}
            />
          )}

          {tela === 'organizar' && (
            <TelaOrganizar
              pedidos={rotaPlanejada}
              onMover={moverItem}
              onIniciar={iniciarRota}
            />
          )}

          {tela === 'entrega' && rotaPlanejada[indiceEntrega] && (
            <TelaEntrega
              pedido={rotaPlanejada[indiceEntrega]}
              indice={indiceEntrega}
              total={rotaPlanejada.length}
              onFinalizar={finalizarEntrega}
              badgeClass={badgeClass}
              statusLabel={statusLabel}
              pos={pos}
            />
          )}

          {pos && online && (
            <div className="motoboy-mapa-mini">
              <MapContainer
                center={[pos.lat, pos.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ width: '100%', height: '100%' }}
                key={`${pos.lat}-${pos.lng}`}
              >
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker
                  position={[pos.lat, pos.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: '<div class="motoboy-marker-self"><svg viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="var(--motoboy-online, #43A047)"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg></div>',
                    iconSize: [24, 36],
                    iconAnchor: [12, 36],
                  })}
                />
                <MapCenterer lat={pos.lat} lng={pos.lng} />
              </MapContainer>
            </div>
          )}

          {online && (
            <div className="motoboy-info-footer">
              <Clock size={14} />
              <span>Online há {formatTimer(timer)}</span>
              <MapPin size={14} style={{ marginLeft: 12 }} />
              <span>{pos ? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}` : 'Aguardando GPS...'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TelaDisponiveis({ pedidos, selecionados, onToggle, onPegar, pegando, tempoDecorrido, badgeClass, statusLabel, pos, pizzaria }) {
  const [filtroDir, setFiltroDir] = useState(null)
  const liberados = pedidos.filter(p => p.status === 'liberado')
  const aguardando = pedidos.filter(p => p.status === 'aceito')

  const origem = pos || pizzaria
  const liberadosComDir = liberados.map(p => ({ ...p, direcao: getDirecao(p, origem) }))
  const filtrados = filtroDir ? liberadosComDir.filter(p => p.direcao === filtroDir) : liberadosComDir
  const aguardandoComDir = aguardando.map(p => ({ ...p, direcao: getDirecao(p, origem) }))

  const dirCounts = {}
  liberadosComDir.forEach(p => { if (p.direcao) dirCounts[p.direcao] = (dirCounts[p.direcao] || 0) + 1 })

  if (!pedidos || pedidos.length === 0) {
    return (
      <div className="card motoboy-aguardando">
        <div className="empty-state">
          <Package size={40} />
          <p>Nenhum pedido disponível</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
            Aguardando pedidos liberados para entrega...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card motoboy-disponiveis">
      <div className="motoboy-disponiveis-header">
        <h3>Pedidos para entrega</h3>
        <span className="badge badge-liberate">{liberados.length} prontos · {aguardando.length} em preparo</span>
      </div>

      {pizzaria && Object.keys(dirCounts).length > 0 && (
        <div className="motoboy-direcao-filtros">
          <button className={`motoboy-direcao-btn ${filtroDir === null ? 'active' : ''}`} onClick={() => setFiltroDir(null)}>
            Todas
          </button>
          {Object.entries(DIRECOES).map(([sigla, nome]) =>
            dirCounts[sigla] ? (
              <button
                key={sigla}
                className={`motoboy-direcao-btn ${filtroDir === sigla ? 'active' : ''}`}
                style={{ '--dir-cor': DIR_CORES[sigla] }}
                onClick={() => setFiltroDir(filtroDir === sigla ? null : sigla)}
              >
                {nome} ({dirCounts[sigla]})
              </button>
            ) : null
          )}
        </div>
      )}

      <div className="motoboy-disponiveis-lista">
        {filtrados.map(p => (
          <label key={p.id} className={`motoboy-disponivel-item ${selecionados.has(p.id) ? 'selected' : ''}`}>
            <input
              type="checkbox"
              checked={selecionados.has(p.id)}
              onChange={() => onToggle(p.id)}
              className="motoboy-disponivel-check"
            />
            <div className="motoboy-disponivel-info">
              <div className="motoboy-disponivel-top">
                <strong>#{p.id}</strong>
                {p.direcao && <span className="motoboy-direcao-badge" style={{ background: DIR_CORES[p.direcao] }}>{DIRECOES[p.direcao]}</span>}
                <span className={badgeClass[p.status] || 'badge'}>{statusLabel[p.status] || p.status}</span>
              </div>
              <div className="motoboy-disponivel-row">
                <User size={14} />
                <span>{p.cliente?.nome || 'Sem nome'}{p.cliente?.telefone ? ` · ${p.cliente.telefone}` : ''}</span>
              </div>
              <div className="motoboy-disponivel-row">
                <MapPin size={14} />
                <span>{p.cliente?.endereco || 'Endereço não informado'}</span>
              </div>
              {p.itens?.length > 0 && (
                <div className="motoboy-disponivel-itens">
                  {p.itens.slice(0, 3).map(item => (
                    <span key={item.id} className="motoboy-pedido-item-chip">{item.qtd}x {item.nome}</span>
                  ))}
                  {p.itens.length > 3 && <span className="motoboy-pedido-item-chip">+{p.itens.length - 3}</span>}
                </div>
              )}
              <div className="motoboy-disponivel-footer">
                <span className="motoboy-disponivel-tempo">Aguardando há {tempoDecorrido(p.data)}</span>
                <strong>R$ {p.total?.toFixed(2)}</strong>
              </div>
            </div>
          </label>
        ))}

        {aguardando.length > 0 && (!filtroDir || aguardandoComDir.some(a => a.direcao === filtroDir)) && (
          <div className="motoboy-aguardando-liberacao">
            <div className="motoboy-aguardando-liberacao-header">
              <Clock size={14} />
              <span>Em preparo — logo serão liberados</span>
            </div>
            {(filtroDir ? aguardandoComDir.filter(a => a.direcao === filtroDir) : aguardandoComDir).map(p => (
              <div key={p.id} className="motoboy-disponivel-item motoboy-disponivel-bloqueado">
                <div className="motoboy-disponivel-check-placeholder" />
                <div className="motoboy-disponivel-info">
                  <div className="motoboy-disponivel-top">
                    <strong>#{p.id}</strong>
                    {p.direcao && <span className="motoboy-direcao-badge" style={{ background: DIR_CORES[p.direcao] }}>{DIRECOES[p.direcao]}</span>}
                    <span className="badge badge-info">Aguardando liberação</span>
                  </div>
                  <div className="motoboy-disponivel-row">
                    <User size={14} />
                    <span>{p.cliente?.nome || 'Sem nome'}{p.cliente?.telefone ? ` · ${p.cliente.telefone}` : ''}</span>
                  </div>
                  <div className="motoboy-disponivel-row">
                    <MapPin size={14} />
                    <span>{p.cliente?.endereco || 'Endereço não informado'}</span>
                  </div>
                  {p.itens?.length > 0 && (
                    <div className="motoboy-disponivel-itens">
                      {p.itens.slice(0, 3).map(item => (
                        <span key={item.id} className="motoboy-pedido-item-chip">{item.qtd}x {item.nome}</span>
                      ))}
                      {p.itens.length > 3 && <span className="motoboy-pedido-item-chip">+{p.itens.length - 3}</span>}
                    </div>
                  )}
                  <div className="motoboy-disponivel-footer">
                    <span className="motoboy-disponivel-tempo">Aguardando há {tempoDecorrido(p.data)}</span>
                    <strong>R$ {p.total?.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {selecionados.size > 0 && (
        <div className="motoboy-disponiveis-actions">
          <button className="btn btn-approve btn-full" onClick={onPegar} disabled={pegando}>
            <ShoppingBag size={16} />
            {pegando ? 'Pegando...' : `Pegar ${selecionados.size} Pedido${selecionados.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

function TelaOrganizar({ pedidos, onMover, onIniciar }) {
  if (pedidos.length === 0) return null

  return (
    <div className="card motoboy-organizar">
      <div className="motoboy-organizar-header">
        <h3>Organizar Rota</h3>
        <span className="badge badge-amber">{pedidos.length} parada{pedidos.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="motoboy-organizar-desc">
        Rota sugerida por proximidade. Ajuste a ordem conforme necessário.
      </p>
      <div className="motoboy-organizar-lista">
        {pedidos.map((p, i) => (
          <div key={p.id} className="motoboy-organizar-item">
            <div className="motoboy-organizar-ordem">
              <span className="motoboy-organizar-num">{i + 1}</span>
            </div>
            <div className="motoboy-organizar-info">
              <strong>#{p.id} - {p.cliente?.nome || 'Sem nome'}</strong>
              <span className="motoboy-organizar-end">{p.cliente?.endereco || 'Endereço não informado'}</span>
              <div className="motoboy-organizar-meta">
                <span>R$ {p.total?.toFixed(2)}</span>
                <span>{p.itens?.length || 0} item(ns)</span>
              </div>
            </div>
            <div className="motoboy-organizar-actions">
              <button className="motoboy-organizar-btn" onClick={() => onMover(i, -1)} disabled={i === 0} title="Subir">
                <ArrowUp size={16} />
              </button>
              <button className="motoboy-organizar-btn" onClick={() => onMover(i, 1)} disabled={i === pedidos.length - 1} title="Descer">
                <ArrowDown size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="motoboy-organizar-footer">
        <button className="btn btn-approve btn-full" onClick={onIniciar}>
          <Navigation size={16} /> Iniciar Rota
        </button>
      </div>
    </div>
  )
}

function TelaEntrega({ pedido, indice, total, onFinalizar, badgeClass, statusLabel, pos }) {
  const abrirNavegacao = () => {
    const lat = getLat(pedido)
    const lng = getLng(pedido)
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/${pos?.lat || ''},${pos?.lng || ''}/${lat},${lng}`, '_blank')
    } else {
      const endereco = encodeURIComponent(pedido.cliente?.endereco || '')
      window.open(`https://www.google.com/maps/search/${endereco}`, '_blank')
    }
  }

  const cancelado = pedido.status === 'recusado'
  const lat = getLat(pedido)
  const lng = getLng(pedido)
  const podeIniciarNavegacao = lat && lng

  if (cancelado) {
    return (
      <div className="card motoboy-entrega">
        <div className="motoboy-entrega-header">
          <div className="motoboy-entrega-progresso">
            <span className="motoboy-entrega-passo">Entrega {indice + 1} de {total}</span>
            <div className="motoboy-entrega-bar">
              <div className="motoboy-entrega-fill" style={{ width: `${((indice + 1) / total) * 100}%` }} />
            </div>
          </div>
          <span className="badge badge-destructive">Cancelado</span>
        </div>
        <div className="motoboy-entrega-corpo" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <X size={48} style={{ color: 'var(--destructive)', marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>Este pedido foi cancelado pela loja</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Pedido #{pedido.id} — {pedido.cliente?.nome || 'Cliente'}</p>
        </div>
        <div className="motoboy-entrega-actions">
          <button className="btn btn-primary btn-full" onClick={() => onFinalizar(pedido.id)}>
            <CheckCircle size={16} /> Entendido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card motoboy-entrega">
      <div className="motoboy-entrega-header">
        <div className="motoboy-entrega-progresso">
          <span className="motoboy-entrega-passo">Entrega {indice + 1} de {total}</span>
          <div className="motoboy-entrega-bar">
            <div className="motoboy-entrega-fill" style={{ width: `${((indice + 1) / total) * 100}%` }} />
          </div>
        </div>
        <span className={badgeClass[pedido.status] || 'badge'}>{statusLabel[pedido.status] || pedido.status}</span>
      </div>

      <div className="motoboy-entrega-corpo">
        <div className="motoboy-entrega-destino">
          <MapPin size={20} />
          <div>
            <strong>{pedido.cliente?.nome || 'Cliente'}</strong>
            {pedido.cliente?.telefone && (
              <a href={`tel:${pedido.cliente.telefone}`} className="motoboy-entrega-tel">
                <Phone size={14} /> {pedido.cliente.telefone}
              </a>
            )}
          </div>
        </div>

        <div className="motoboy-entrega-endereco">
          <MapPin size={16} />
          <span>{pedido.cliente?.endereco || 'Endereço não informado'}</span>
        </div>

        {pedido.itens?.length > 0 && (
          <div className="motoboy-entrega-itens">
            <h4>Itens do Pedido #{pedido.id}</h4>
            {pedido.itens.map(item => (
              <div key={item.id} className="motoboy-entrega-item">
                <span className="motoboy-entrega-qtd">{item.qtd}x</span>
                <span className="motoboy-entrega-nome">{item.nome}</span>
                {item.preco && <span className="motoboy-entrega-preco">R$ {(item.qtd * item.preco).toFixed(2)}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="motoboy-entrega-total">
          <strong>Total: R$ {pedido.total?.toFixed(2)}</strong>
        </div>
      </div>

      <div className="motoboy-entrega-actions">
        <button className="btn btn-primary btn-full" onClick={abrirNavegacao} disabled={!podeIniciarNavegacao}>
          <Navigation size={16} /> Iniciar Navegação
        </button>
        <button className="btn btn-approve btn-full" onClick={() => onFinalizar(pedido.id)}>
          <CheckCircle size={16} /> Confirmar Entrega
        </button>
      </div>
    </div>
  )
}

function MapCenterer({ lat, lng }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 0.5 }) }, [lat, lng])
  return null
}

export default App
