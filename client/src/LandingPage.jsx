import React, { useState } from 'react'
import { getIsraelitaLoginUrl, getStoreUrl } from './config'

const API = '/api'

const features = [
  {
    icon: '📱',
    title: 'Cardápio Digital',
    desc: 'Seu cliente monta a pizza do jeito dele. Escolhe tamanho, sabores, bebidas — tudo visual e rápido.'
  },
  {
    icon: '⚡',
    title: 'Gestão de Pedidos',
    desc: 'Pedidos chegam em tempo real no painel admin. Aceita, prepara, libera pro motoboy. Tudo em um clique.'
  },
  {
    icon: '🛵',
    title: 'App do Entregador',
    desc: 'Motoboy vê pedidos disponíveis, pega rota otimizada, navega com GPS e confirma entrega.'
  },
  {
    icon: '📊',
    title: 'Financeiro',
    desc: 'Acompanhe receitas, pedidos por período, ticket médio e muito mais. Toda conta em dia.'
  },
  {
    icon: '🔗',
    title: 'Integração iFood',
    desc: 'Pedidos do iFood caem direto no seu painel. Um lugar só pra gerenciar tudo.'
  },
  {
    icon: '📠',
    title: 'Impressão Automática',
    desc: 'Impressora térmica dispara o pedido assim que chega. Cozinha na mão sem perder tempo.'
  }
]

export default function LandingPage() {
  const [form, setForm] = useState({ nome: '', adminNome: '', adminEmail: '', adminSenha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'minhapizzaria'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const slug = generateSlug(form.nome)
      const res = await fetch(`${API}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form })
      })
      const data = await res.json()
      if (!res.ok) return setErro(data.erro || 'Erro ao criar')
      setSuccess(data)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="landing">
        <div className="landing-hero" style={{ minHeight: '60vh' }}>
          <div className="landing-hero-bg" />
          <div className="landing-hero-content">
            <div className="landing-hero-badge">✅ Sua loja foi criada!</div>
            <h1 className="landing-hero-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>
              {success.store.nome} já está no ar
            </h1>
            <p className="landing-hero-sub">
              Seu sistema está pronto nos links abaixo. Guarde-os com cuidado.
            </p>
            <div className="landing-success-links">
              <a href={success.urls.site} className="landing-btn landing-btn-hero">🍕 Site de pedidos</a>
              <a href={success.urls.admin} className="landing-btn landing-btn-outline">⚙️ Painel admin</a>
              <a href={success.urls.motoboy} className="landing-btn landing-btn-outline">🛵 App motoboy</a>
            </div>
            <p className="landing-hero-meta" style={{ marginTop: 16 }}>
              Seu login: {success.user.email} · já está autenticado no admin
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="landing-logo-icon">🍕</span>
            <span className="landing-logo-text">QueroPizza</span>
          </div>
          <div className="landing-nav-links">
            <button onClick={() => scrollTo('features')} className="landing-nav-link">Recursos</button>
            <button onClick={() => scrollTo('signup')} className="landing-nav-link">Criar loja</button>
            <button onClick={() => scrollTo('contact')} className="landing-nav-link">Contato</button>
          </div>
          <a href={getIsraelitaLoginUrl()} className="landing-btn landing-btn-primary">Entrar na Israelita</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-hero-badge">🔥 Sistema completo para sua pizzaria</div>
          <h1 className="landing-hero-title">
            Venda mais pizza<br />
            <span className="landing-hero-highlight">sem complicação</span>
          </h1>
          <p className="landing-hero-sub">
            Cardápio online, gestão de pedidos, app do motoboy e integração com iFood.
            Tudo que sua pizzaria precisa em um só lugar.
          </p>
          <div className="landing-hero-actions">
            <button onClick={() => scrollTo('signup')} className="landing-btn landing-btn-hero">
              Criar minha loja grátis
            </button>
            <button onClick={() => scrollTo('features')} className="landing-btn landing-btn-outline">
              Ver recursos
            </button>
          </div>
          <p className="landing-hero-meta">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="landing-proof">
        <div className="landing-proof-inner">
          <p className="landing-proof-label">Usado por</p>
          <div className="landing-proof-logos">
            <span className="landing-proof-logo">🍕 Pizzaria Israelita</span>
            <span className="landing-proof-sep">·</span>
            <span className="landing-proof-logo">🍕 Sua pizzaria aqui</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <span className="landing-section-badge">Recursos</span>
          <h2 className="landing-section-title">Tudo que você precisa pra crescer</h2>
          <p className="landing-section-sub">
            Das pizzas artesanais às grandes redes — o QueroPizza acompanha seu negócio.
          </p>
        </div>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="landing-signup">
        <div className="landing-section-header">
          <span className="landing-section-badge">Começar</span>
          <h2 className="landing-section-title">Crie sua loja grátis</h2>
          <p className="landing-section-sub">
            Em menos de 1 minuto sua pizzaria está no ar. Teste grátis por 15 dias.
          </p>
        </div>
        <form className="landing-signup-form" onSubmit={handleSubmit}>
          <div className="landing-form-row">
            <div className="landing-form-field">
              <label className="landing-form-label">Nome da pizzaria</label>
              <input
                type="text" placeholder="Ex: Dalle Pizza"
                className="landing-form-input"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                required
              />
              {form.nome && (
                <p className="landing-form-hint">
                  Seu link: <strong>{generateSlug(form.nome) || '...'}.queropizza.com</strong>
                </p>
              )}
            </div>
            <div className="landing-form-field">
              <label className="landing-form-label">Seu nome</label>
              <input
                type="text" placeholder="Seu nome"
                className="landing-form-input"
                value={form.adminNome}
                onChange={e => setForm(f => ({ ...f, adminNome: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="landing-form-row">
            <div className="landing-form-field">
              <label className="landing-form-label">Seu email</label>
              <input
                type="email" placeholder="email@exemplo.com"
                className="landing-form-input"
                value={form.adminEmail}
                onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                required
              />
            </div>
            <div className="landing-form-field">
              <label className="landing-form-label">Senha</label>
              <input
                type="password" placeholder="Mínimo 6 caracteres"
                className="landing-form-input"
                value={form.adminSenha}
                onChange={e => setForm(f => ({ ...f, adminSenha: e.target.value }))}
                minLength={6}
                required
              />
            </div>
          </div>
          {erro && <p className="landing-form-erro">{erro}</p>}
          <button className="landing-btn landing-btn-hero" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Criando sua loja...' : 'Criar loja grátis'}
          </button>
        </form>
      </section>

      {/* CONTACT */}
      <section id="contact" className="landing-contact">
        <div className="landing-section-header">
          <span className="landing-section-badge">Contato</span>
          <h2 className="landing-section-title">Quer saber mais?</h2>
          <p className="landing-section-sub">
            Mande uma mensagem e a gente te ajuda a montar o plano ideal pra sua pizzaria.
          </p>
        </div>
        <form className="landing-form" onSubmit={(e) => e.preventDefault()}>
          <div className="landing-form-row">
            <input type="text" placeholder="Seu nome" className="landing-form-input" />
            <input type="email" placeholder="Seu email" className="landing-form-input" />
          </div>
          <textarea placeholder="Sua mensagem" className="landing-form-textarea" rows={4} />
          <button className="landing-btn landing-btn-hero">Enviar</button>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-footer-logo">🍕 QueroPizza</span>
            <p className="landing-footer-desc">Sistema de pedidos online para pizzarias.</p>
          </div>
          <div className="landing-footer-links">
            <a href={getIsraelitaLoginUrl()} className="landing-footer-link">Israelita — Fazer pedido</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2026 QueroPizza. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
