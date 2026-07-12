import React from 'react'
import { getIsraelitaLoginUrl } from './config'

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

const plans = [
  {
    name: 'Começar',
    price: 'Grátis',
    period: '',
    features: ['Cardápio online ilimitado', 'Gestão de pedidos', '3 usuários', 'Painel admin completo', 'Suporte por email'],
    cta: 'Começar agora'
  },
  {
    name: 'Profissional',
    price: 'R$ 97',
    period: '/mês',
    features: ['Tudo do plano Grátis', 'Usuários ilimitados', 'App motoboy completo', 'Financeiro', 'Integração iFood', 'Impressão térmica', 'Suporte prioritário'],
    cta: 'Ver planos',
    popular: true
  },
  {
    name: 'Personalizado',
    price: 'Sob consulta',
    period: '',
    features: ['Tudo do Profissional', 'Domínio personalizado', 'API whitelabel', 'Migração de dados', 'Treinamento da equipe', 'Suporte 24h'],
    cta: 'Falar com time'
  }
]

export default function LandingPage() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
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
            <button onClick={() => scrollTo('plans')} className="landing-nav-link">Planos</button>
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
            <button onClick={() => scrollTo('plans')} className="landing-btn landing-btn-hero">
              Começar grátis
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

      {/* PLANS */}
      <section id="plans" className="landing-plans">
        <div className="landing-section-header">
          <span className="landing-section-badge">Planos</span>
          <h2 className="landing-section-title">Comece grátis. Escale quando quiser.</h2>
          <p className="landing-section-sub">Teste grátis por 15 dias. Sem compromisso.</p>
        </div>
        <div className="landing-plans-grid">
          {plans.map((p, i) => (
            <div key={i} className={`landing-plan-card${p.popular ? ' landing-plan-popular' : ''}`}>
              {p.popular && <span className="landing-plan-badge">Mais popular</span>}
              <h3 className="landing-plan-name">{p.name}</h3>
              <div className="landing-plan-price">
                <span className="landing-plan-value">{p.price}</span>
                {p.period && <span className="landing-plan-period">{p.period}</span>}
              </div>
              <ul className="landing-plan-features">
                {p.features.map((f, j) => (
                  <li key={j} className="landing-plan-feature">✓ {f}</li>
                ))}
              </ul>
              <button className={`landing-btn ${p.popular ? 'landing-btn-hero' : 'landing-btn-outline'}`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
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
