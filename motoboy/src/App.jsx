import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Bike, MapPin, Clock, CheckCircle, X, Navigation, Phone, Pizza, LogOut, User } from 'lucide-react'

const API = '/api'

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
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/motoboy/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, senha })
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
            <input type="tel" placeholder="Celular" value={telefone} onChange={e => { setTelefone(e.target.value); setErro('') }} autoFocus />
            <input type="password" placeholder="Senha" value={senha} onChange={e => { setSenha(e.target.value); setErro('') }} />
            {erro && <p className="erro">{erro}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function MotoboyDashboard({ user, token, onLogout }) {
  const [online, setOnline] = useState(() => localStorage.getItem('motoboyOnline') === 'true')
  const [pos, setPos] = useState(null)
  const [watchId, setWatchId] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [pedidoAtivo, setPedidoAtivo] = useState(null)
  const [timer, setTimer] = useState(0)
  const [permissaoGps, setPermissaoGps] = useState(true)
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

  useEffect(() => {
    if (online) {
      localStorage.setItem('motoboyOnline', 'true')
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
    if (!online || !pos) return
    const id = setInterval(() => {
      if (posRef.current) enviarPosicao(posRef.current.lat, posRef.current.lng)
    }, 10000)
    return () => clearInterval(id)
  }, [online, pos])

  const carregarPedidos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/orders`)
      const data = await res.json()
      if (Array.isArray(data)) setPedidos(data)
    } catch {}
  }, [])

  useEffect(() => { carregarPedidos(); const id = setInterval(carregarPedidos, 15000); return () => clearInterval(id) }, [carregarPedidos])

  useEffect(() => {
    const hoje = new Date().toLocaleDateString('pt-BR')
    const pedidosHoje = pedidos.filter(p => {
      if (!p.data) return false
      const dataPedido = new Date(p.data).toLocaleDateString('pt-BR')
      return dataPedido === hoje
    })
    const ativo = pedidosHoje.find(p => ['aceito', 'liberado', 'em_rota', 'entregador_proximo'].includes(p.status))
    setPedidoAtivo(ativo || null)
  }, [pedidos])

  const atualizarStatus = async (id, status) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    carregarPedidos()
  }

  const formatTimer = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const statusLabel = { pendente: 'Pendente', aceito: 'Em preparo', liberado: 'Saiu p/ entrega', em_rota: 'Em rota', entregador_proximo: 'Chegando!', entregue: 'Entregue', recusado: 'Recusado' }
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

          {pedidoAtivo ? (
            <div className="card motoboy-pedido-ativo">
              <div className="motoboy-pedido-header">
                <strong>Pedido #{pedidoAtivo.id}</strong>
                <span className={badgeClass[pedidoAtivo.status] || 'badge'}>{statusLabel[pedidoAtivo.status] || pedidoAtivo.status}</span>
              </div>
              <div className="motoboy-pedido-info">
                <div className="motoboy-pedido-row">
                  <User size={16} />
                  <span>{pedidoAtivo.cliente?.nome}{pedidoAtivo.cliente?.telefone ? ` · ${pedidoAtivo.cliente.telefone}` : ''}</span>
                </div>
                <div className="motoboy-pedido-row">
                  <MapPin size={16} />
                  <span>{pedidoAtivo.cliente?.endereco || 'Endereço não informado'}</span>
                </div>
                {pedidoAtivo.itens?.length > 0 && (
                  <div className="motoboy-pedido-row">
                    <Pizza size={16} />
                    <div className="motoboy-pedido-itens">
                      {pedidoAtivo.itens.map(item => (
                        <span key={item.id} className="motoboy-pedido-item-chip">{item.qtd}x {item.nome}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="motoboy-pedido-total"><strong>Total: R$ {pedidoAtivo.total?.toFixed(2)}</strong></p>
              </div>
              <div className="motoboy-pedido-actions">
                {(pedidoAtivo.status === 'liberado' || pedidoAtivo.status === 'em_rota') && (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => atualizarStatus(pedidoAtivo.id, 'entregador_proximo')}>
                      <Navigation size={16} /> Estou Chegando
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => atualizarStatus(pedidoAtivo.id, 'entregue')}>
                      <CheckCircle size={16} /> Entregue
                    </button>
                  </>
                )}
                {pedidoAtivo.status === 'entregador_proximo' && (
                  <button className="btn btn-approve btn-sm" onClick={() => atualizarStatus(pedidoAtivo.id, 'entregue')}>
                    <CheckCircle size={16} /> Confirmar Entrega
                  </button>
                )}
                {pedidoAtivo.status === 'aceito' && (
                  <span className="motoboy-pedido-aguardando-label">Aguardando liberação</span>
                )}
              </div>
            </div>
          ) : (
            <div className="card motoboy-aguardando">
              <div className="empty-state">
                <Bike size={40} />
                <p>Nenhum pedido no momento</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
                  {online ? 'Aguardando novas entregas...' : 'Fique online para receber pedidos'}
                </p>
              </div>
            </div>
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

function MapCenterer({ lat, lng }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 0.5 }) }, [lat, lng])
  return null
}

export default App
