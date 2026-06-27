import React, { useState, useEffect, useRef } from 'react'

const API = '/api'

function App() {
  const [pagina, setPagina] = useState('cardapio')
  const [carrinho, setCarrinho] = useState([])
  const [adminAutenticado, setAdminAutenticado] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'classic')
  const [font, setFont] = useState(() => localStorage.getItem('appFont') || 'classico')
  const [pizzaEditando, setPizzaEditando] = useState(null)

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

  const totalCarrinho = carrinho.reduce((sum, i) => sum + i.preco * i.qtd, 0)
  const qtdCarrinho = carrinho.reduce((sum, i) => sum + i.qtd, 0)

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
        {pagina === 'cardapio' && <Cardapio onAdicionar={adicionarAoCarrinho} pizzaEditando={pizzaEditando} onPizzaEditDone={() => setPizzaEditando(null)} />}
        {pagina === 'carrinho' && (
          <CarrinhoView
            itens={carrinho}
            onRemover={removerDoCarrinho}
            onAdicionar={adicionarAoCarrinho}
            onLimparCarrinho={limparCarrinho}
            total={totalCarrinho}
            onVoltar={() => setPagina('cardapio')}
            onEditarPizza={editarPizza}
          />
        )}
        {pagina === 'admin' && (
          <AdminPanel
            autenticado={adminAutenticado}
            onLogin={() => {
              setAdminAutenticado(true)
              sessionStorage.setItem('adminAuth', 'true')
            }}
            onThemeChange={setTheme}
            onFontChange={setFont}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button className={`bottom-nav-btn ${pagina === 'cardapio' ? 'active' : ''}`} onClick={() => setPagina('cardapio')}>
          <span className="bottom-nav-icon">🍕</span>
          <span className="bottom-nav-label">Cardápio</span>
        </button>
        <button className={`bottom-nav-btn ${pagina === 'carrinho' ? 'active' : ''}`} onClick={() => setPagina('carrinho')}>
          <span className="bottom-nav-icon">🛒</span>
          <span className="bottom-nav-label">Carrinho</span>
          {qtdCarrinho > 0 && <span className="bottom-nav-badge">{qtdCarrinho}</span>}
        </button>
        <button className={`bottom-nav-btn ${pagina === 'admin' ? 'active' : ''}`} onClick={() => setPagina('admin')}>
          <span className="bottom-nav-icon">⚙️</span>
          <span className="bottom-nav-label">Admin</span>
        </button>
      </nav>
      <footer className="classic-footer">
        <div className="footer-inner">
          <p className="footer-brand">Israelita Pizza</p>
          <p className="footer-info">Forno a lenha · Entrega 35min · Aberto até 23h</p>
          <p className="footer-copy">© 2026</p>
        </div>
      </footer>
    </div>
  )
}

function Cardapio({ onAdicionar, pizzaEditando, onPizzaEditDone }) {
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
      <div className="cardapio-hero" style={settingsCover ? { backgroundImage: `url("${settingsCover}")` } : {}}>
        <div className="hero-overlay" style={{ background: overlayBg }}></div>
        {settingsTitle !== '' && (
          <div className="hero-content">
            <div className="hero-aberto-badge">
              <span className="hero-aberto-dot"></span>
              Aberto agora · 35min
            </div>
            <h2>{settingsTitle || 'Nosso Cardápio'}</h2>
            {settingsSubtitle !== '' && <p>{settingsSubtitle || 'As melhores pizzas artesanais da cidade'}</p>}
          </div>
        )}
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
              onClick={() => { setTamanhoSel(t); setSaboresSel([]); setBuscaSabor(''); setErro('') }}
            >
              <strong>{t.nome}</strong>
              {t.preco_tradicional && <span className="tamanho-preco">Trad. R$ {t.preco_tradicional.toFixed(2)}</span>}
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
          </>
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
            Bebidas e Produtos
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

function CarrinhoView({ itens, onRemover, onAdicionar, onLimparCarrinho, total, onVoltar, onEditarPizza }) {
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
      <div id="carrinho-content">
        <div className="carrinho-itens">
          <div className="carrinho-itens-header">
            <h2>Seu Carrinho</h2>
            <span className="carrinho-count">{itens.length} {itens.length === 1 ? 'ITEM' : 'ITENS'}</span>
          </div>
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
              {item.tipo === 'pizza' && (
                <button className="btn-edit-pizza" onClick={() => onEditarPizza(item)} title="Editar pizza">
                  ✏️ Editar
                </button>
              )}
            </div>
          ))}
          <div className="carrinho-total">
            <strong>Total: R$ {total.toFixed(2)}</strong>
          </div>
        </div>
        <div className="cliente-form">
          <h3>Dados para entrega</h3>
          <input placeholder="Nome" value={cliente.nome} onChange={e => setCliente({ ...cliente, nome: e.target.value })} />
          <input placeholder="Telefone" value={cliente.telefone} onChange={e => setCliente({ ...cliente, telefone: e.target.value })} />
          <input placeholder="Endereço" value={cliente.endereco} onChange={e => setCliente({ ...cliente, endereco: e.target.value })} />
          <button className="btn-add btn-finalizar" onClick={finalizar}>Finalizar Pedido</button>
        </div>
      </div>
    </div>
  )
}

function AdminPanel({ autenticado, onLogin, onThemeChange, onFontChange }) {
  const [aba, setAba] = useState('cardapio')

  if (!autenticado) return <AdminLogin onLogin={onLogin} />

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        <button className={`tab-btn ${aba === 'cardapio' ? 'active' : ''}`} onClick={() => setAba('cardapio')}>Cardápio</button>
        <button className={`tab-btn ${aba === 'pedidos' ? 'active' : ''}`} onClick={() => setAba('pedidos')}>Pedidos</button>
        <button className={`tab-btn ${aba === 'financeiro' ? 'active' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
      </div>
      {aba === 'cardapio' && <AdminMenu onThemeChange={onThemeChange} onFontChange={onFontChange} />}
      {aba === 'pedidos' && <AdminOrders />}
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
