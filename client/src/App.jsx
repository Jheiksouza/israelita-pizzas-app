import React, { useState, useEffect } from 'react'

const API = '/api'

function App() {
  const [pagina, setPagina] = useState('cardapio')
  const [carrinho, setCarrinho] = useState([])
  const [adminAutenticado, setAdminAutenticado] = useState(false)

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
      if (existente.qtd > 1) {
        return prev.map(i => i.id === itemId ? { ...i, qtd: i.qtd - 1 } : i)
      }
      return prev.filter(i => i.id !== itemId)
    })
  }

  const limparCarrinho = () => setCarrinho([])

  const totalCarrinho = carrinho.reduce((sum, i) => sum + i.preco * i.qtd, 0)
  const qtdCarrinho = carrinho.reduce((sum, i) => sum + i.qtd, 0)

  return (
    <div className="app">
      <div className="bg-decoration" aria-hidden="true">
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🍕</span>
        <span className="float-pizza">🧀</span>
        <span className="float-pizza">🌿</span>
        <span className="float-pizza">🍕</span>
      </div>
      <header className="header">
        <div className="header-content">
          <h1 className="logo" onClick={() => setPagina('cardapio')}>🍕 Pizzaria Israelita</h1>
          <nav className="nav">
            <button className={`nav-btn ${pagina === 'cardapio' ? 'active' : ''}`} onClick={() => setPagina('cardapio')}>Cardápio</button>
            <button className={`nav-btn ${pagina === 'carrinho' ? 'active' : ''}`} onClick={() => setPagina('carrinho')}>
              Carrinho {qtdCarrinho > 0 && <span className="badge">{qtdCarrinho}</span>}
            </button>
            <button className={`nav-btn ${pagina === 'admin' ? 'active' : ''}`} onClick={() => setPagina('admin')}>
              {adminAutenticado ? 'Admin' : 'Entrar'}
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {pagina === 'cardapio' && <Cardapio onAdicionar={adicionarAoCarrinho} />}
        {pagina === 'carrinho' && (
          <CarrinhoView
            itens={carrinho}
            onRemover={removerDoCarrinho}
            onAdicionar={adicionarAoCarrinho}
            onLimparCarrinho={limparCarrinho}
            total={totalCarrinho}
            onVoltar={() => setPagina('cardapio')}
          />
        )}
        {pagina === 'admin' && (
          <AdminPanel
            autenticado={adminAutenticado}
            onLogin={() => {
              setAdminAutenticado(true)
              sessionStorage.setItem('adminAuth', 'true')
            }}
          />
        )}
      </main>
    </div>
  )
}

function Cardapio({ onAdicionar }) {
  const [menu, setMenu] = useState([])
  const [categoria, setCategoria] = useState('Todas')
  const [busca, setBusca] = useState('')
  const [tamanhoSel, setTamanhoSel] = useState(null)
  const [saboresSel, setSaboresSel] = useState([])
  const [erro, setErro] = useState('')

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
    if (busca && !i.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const toggleSabor = (id) => {
    if (saboresSel.includes(id)) {
      setSaboresSel(saboresSel.filter(s => s !== id))
      setErro('')
      return
    }
    if (saboresSel.length >= tamanhoSel.maxSabores) {
      setErro(`Máximo de ${tamanhoSel.maxSabores} sabor${tamanhoSel.maxSabores > 1 ? 'es' : ''}`)
      return
    }
    setErro('')
    setSaboresSel([...saboresSel, id])
  }

  const handleAdd = () => {
    if (saboresSel.length === 0) { setErro('Selecione pelo menos 1 sabor'); return }
    const nomesSabores = saboresSel.map(id => sabores.find(s => s.id === id)?.nome).filter(Boolean)
    onAdicionar({
      id: `pizza-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'pizza',
      nome: `Pizza ${tamanhoSel.nome} (${nomesSabores.join(', ')})`,
      tamanho: tamanhoSel.nome,
      sabores: nomesSabores,
      preco: tamanhoSel.preco
    })
    setSaboresSel([])
    setErro('')
  }

  return (
    <div className="cardapio-page">
      <div className="cardapio-hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h2>Nosso Cardápio</h2>
          <p>As melhores pizzas artesanais da cidade</p>
        </div>
      </div>
      <div className="filtros">
          <input
            type="text"
            placeholder="Buscar item..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input-busca"
          />
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
        <h3 className="montar-title">🍕 Monte sua Pizza</h3>
        <p className="sabores-label">Escolha o tamanho:</p>
        <div className="tamanhos-grid">
          {tamanhos.map(t => (
            <button
              key={t.id}
              className={`tamanho-btn ${tamanhoSel?.id === t.id ? 'active' : ''}`}
              onClick={() => { setTamanhoSel(t); setSaboresSel([]); setErro('') }}
            >
              <strong>{t.nome}</strong>
              <span className="tamanho-preco">R$ {t.preco.toFixed(2)}</span>
              <small>Até {t.maxSabores} sabor{t.maxSabores > 1 ? 'es' : ''}</small>
            </button>
          ))}
        </div>

        {tamanhoSel && (
          <>
            <p className="sabores-label">
              Selecione os sabores para {tamanhoSel.nome}
              <span className="sabores-count"> ({saboresSel.length}/{tamanhoSel.maxSabores})</span>
            </p>
            <div className="sabores-grid">
              {sabores.map(s => (
                <button
                  key={s.id}
                  className={`sabor-btn ${saboresSel.includes(s.id) ? 'active' : ''}`}
                  onClick={() => toggleSabor(s.id)}
                >
                  {s.nome}
                </button>
              ))}
            </div>
            {erro && <p className="erro">{erro}</p>}
            <button
              className="btn-add btn-montar-add"
              onClick={handleAdd}
              disabled={saboresSel.length === 0}
            >
              Adicionar Pizza {tamanhoSel.nome} — R$ {tamanhoSel.preco.toFixed(2)}
            </button>
          </>
        )}
      </div>

      {filtrados.length > 0 && (
        <>
          <h3 className="section-title">Bebidas e Produtos</h3>
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

function CarrinhoView({ itens, onRemover, onAdicionar, onLimparCarrinho, total, onVoltar }) {
  const [cliente, setCliente] = useState({ nome: '', telefone: '', endereco: '' })
  const [enviado, setEnviado] = useState(false)

  const finalizar = async () => {
    if (!cliente.nome || !cliente.telefone) return alert('Preencha nome e telefone')
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, itens, total })
    })
    if (!res.ok) return alert('Erro ao enviar pedido. Tente novamente.')
    onLimparCarrinho()
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="carrinho-page">
        <div className="empty-state">
          <h2>✅ Pedido enviado!</h2>
          <p>Obrigado, {cliente.nome}! Seu pedido foi registrado.</p>
          <button className="btn-add" onClick={onVoltar}>Voltar ao Cardápio</button>
        </div>
      </div>
    )
  }

  if (itens.length === 0) {
    return (
      <div className="carrinho-page">
        <div className="empty-state">
          <h2>🛒 Carrinho vazio</h2>
          <p>Adicione itens do cardápio</p>
          <button className="btn-add" onClick={onVoltar}>Ver Cardápio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="carrinho-page">
      <h2>Seu Carrinho</h2>
      <div className="carrinho-itens">
        {itens.map(item => (
          <div key={item.id} className="carrinho-item">
            <div className="item-info">
              <strong>{item.nome}</strong>
              {item.tipo === 'pizza' && (
                <div className="pizza-detalhes">
                  <span className="pizza-tamanho">{item.tamanho}</span>
                  <span className="pizza-sabores">Sabores: {item.sabores?.join(', ')}</span>
                </div>
              )}
              <span>R$ {item.preco.toFixed(2)}</span>
            </div>
            <div className="item-qtd">
              <button onClick={() => onRemover(item.id)}>-</button>
              <span>{item.qtd}</span>
              <button onClick={() => onAdicionar(item)}>+</button>
              <span className="item-subtotal">R$ {(item.preco * item.qtd).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="carrinho-total">
        <strong>Total: R$ {total.toFixed(2)}</strong>
      </div>
      <div className="cliente-form">
        <h3>Dados para entrega</h3>
        <input placeholder="Nome" value={cliente.nome} onChange={e => setCliente({ ...cliente, nome: e.target.value })} />
        <input placeholder="Telefone" value={cliente.telefone} onChange={e => setCliente({ ...cliente, telefone: e.target.value })} />
        <input placeholder="Endereço" value={cliente.endereco} onChange={e => setCliente({ ...cliente, endereco: e.target.value })} />
        <button className="btn-add btn-finalizar" onClick={finalizar}>Finalizar Pedido</button>
      </div>
    </div>
  )
}

function AdminPanel({ autenticado, onLogin }) {
  const [aba, setAba] = useState('cardapio')

  if (!autenticado) return <AdminLogin onLogin={onLogin} />

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        <button className={`tab-btn ${aba === 'cardapio' ? 'active' : ''}`} onClick={() => setAba('cardapio')}>Cardápio</button>
        <button className={`tab-btn ${aba === 'pedidos' ? 'active' : ''}`} onClick={() => setAba('pedidos')}>Pedidos</button>
        <button className={`tab-btn ${aba === 'financeiro' ? 'active' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
      </div>
      {aba === 'cardapio' && <AdminMenu />}
      {aba === 'pedidos' && <AdminOrders />}
      {aba === 'financeiro' && <AdminFinanceiro />}
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
        <button className="btn-add" onClick={() => { setEditando(null); setMostrarForm(true) }}>+ Novo Item</button>
      </div>
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
          <tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Categoria</th><th>Preço</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {menu.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.nome}</td>
              <td><span className={`tipo-badge tipo-${item.tipo || 'produto'}`}>{item.tipo === 'sabor' ? 'Sabor' : item.tipo === 'tamanho' ? 'Tamanho' : 'Produto'}</span></td>
              <td>{item.categoria}</td>
              <td>R$ {item.preco.toFixed(2)}</td>
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

function playNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.3
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      osc2.connect(gain)
      osc2.frequency.value = 1100
      gain.gain.value = 0.2
      osc2.start()
      osc2.stop(ctx.currentTime + 0.2)
    }, 150)
  } catch (e) {}
}

function AdminOrders() {
  const [pedidos, setPedidos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const pendentesRef = React.useRef(0)

  const carregar = () => fetch(`${API}/orders`).then(r => r.json()).then(data => {
    const pendentes = data.filter(p => p.status === 'pendente').length
    if (pendentes > pendentesRef.current) playNotificacao()
    pendentesRef.current = pendentes
    setPedidos(data)
  })

  useEffect(() => { carregar(); const id = setInterval(carregar, 10000); return () => clearInterval(id) }, [])

  const atualizarStatus = async (id, status) => {
    await fetch(`${API}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    carregar()
  }

  const filtrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro)

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
            <div key={pedido.id} className="pedido-card">
              <div className="pedido-header">
                <strong>Pedido #{pedido.id}</strong>
                <span className={`status-badge ${statusClass[pedido.status]}`}>{statusLabel[pedido.status]}</span>
              </div>
              <div className="pedido-body">
                <p><strong>Cliente:</strong> {pedido.cliente?.nome}</p>
                <p><strong>Telefone:</strong> {pedido.cliente?.telefone}</p>
                <p><strong>Endereço:</strong> {pedido.cliente?.endereco || 'Não informado'}</p>
                <p><strong>Data:</strong> {new Date(pedido.data).toLocaleString('pt-BR')}</p>
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
    item || { nome: '', descricao: '', preco: '', categoria: 'Pizzas Salgadas', imagem: '', tipo: 'produto', maxSabores: '' }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const dados = { ...form, preco: parseFloat(form.preco) }
    if (dados.tipo !== 'tamanho') delete dados.maxSabores
    onSalvar(dados)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{item ? 'Editar Item' : 'Novo Item'}</h3>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          <input type="number" step="0.01" placeholder="Preço" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} required />
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="produto">Produto</option>
            <option value="sabor">Sabor de Pizza</option>
            <option value="tamanho">Tamanho de Pizza</option>
          </select>
          {form.tipo === 'tamanho' && (
            <input type="number" min="1" max="4" placeholder="Máx. de sabores" value={form.maxSabores} onChange={e => setForm({ ...form, maxSabores: parseInt(e.target.value) || '' })} required />
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
