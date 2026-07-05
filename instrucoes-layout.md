# Instruções para Redesign de Layout — Pizzaria Israelita

## ⚠️ REGRA ABSOLUTA

**NUNCA ALTERAR funcionalidades, lógica de negócio, estado (React state), fluxo de dados, APIs ou nomes de classes CSS existentes.**

Você só pode:
- Adicionar NOVAS classes CSS
- Modificar propriedades CSS de classes EXISTENTES (cores, padding, fontes, bordas, sombras, etc.)
- Adicionar NOVOS elementos HTML para fins de layout/design (containers, wrappers, decoração)
- Adicionar NOVAS animações CSS
- Reorganizar a estrutura HTML desde que **nenhuma classe seja removida ou renomeada**

---

## Arquitetura do Projeto

### Stack
- React 19 (single file: `client/src/App.jsx`)
- CSS puro em `client/src/App.css`
- Express backend em `server.js` (serverless no Vercel)
- Banco: Supabase PostgreSQL
- Deploy: Vercel (auto-deploy via GitHub push na `main`)

### Estrutura de Componentes

#### `client/src/App.jsx` — App do Cliente

```
App
├── Header (logo + navegação)
├── Cardapio (página principal do cliente)
│   ├── Hero (imagem de capa + logo + título)
│   ├── Categorias (filtro de produtos)
│   ├── Pizza Montar (monte sua pizza)
│   │   ├── Tamanhos Grid
│   │   ├── Busca Sabores
│   │   ├── Sabores Grid
│   │   └── Botão Adicionar
│   └── Menu Grid (bebidas/produtos)
├── CarrinhoView (carrinho + formulário)
│   ├── Lista de Itens
│   ├── Botão Editar Pizza
│   └── Formulário Cliente
└── AdminPanel
    ├── AdminMenu (tabela + form)
    ├── AdminOrders (pedidos + notificação sonora)
    ├── AdminFinanceiro (estatísticas)
    ├── CardapioSettings (modal configurações)
    ├── MenuItemForm (modal add/edit item)
    └── AdminLogin (tela de login)
```

#### `motoboy/src/App.jsx` — App do Entregador

```
MotoboyApp
├── MotoboyLogin (tela de login do entregador)
├── MotoboyDashboard (dashboard principal)
│   ├── StatusHeader (status online/offline + timer)
│   ├── PedidoAtual (card do pedido em andamento)
│   ├── ListaPedidos (histórico de entregas)
│   └── MapaRastreio (mini mapa com posição)
```

---

## Estados de Cada Componente

### App (raiz)
- **páginas**: 'cardapio' | 'carrinho' | 'admin'
- **carrinho**: array de itens (vazio por padrão)
- **adminAutenticado**: false (não autenticado) | true
- **pizzaEditando**: null (não editando) | objeto pizza

### Cardapio
- **Normal**: menu carregado, hero + categorias + pizza montar + produtos
- **Loading (implícito)**: menu ainda vazio enquanto fetch não retorna (nenhum indicador visual — pode adicionar)
- **Erro (implícito)**: fetch falha, loga no console (nenhum indicador visual — pode adicionar)
- **Sem sabores**: `sabores` array vazio (nenhuma pizza cadastrada)
- **Sem produtos**: `filtrados` array vazio (nenhuma bebida/produto na categoria)
- **Editando pizza**: `pizzaEditando` preenche automaticamente tamanhoSel e saboresSel
- **Erro validação**: `erro` string visível quando ultrapassa maxSabores ou nenhum sabor selecionado
- **Preço 0**: se nenhum tier price configurado, preço exibido como 0

### CarrinhoView
- **Vazio**: `itens.length === 0` → mostra "Carrinho vazio" + botão "Ver Cardápio"
- **Com itens**: lista + total + formulário
- **Pedido enviado**: `enviado === true` → mostra "Pedido enviado!" + botão "Voltar"
- **Erro no envio**: alert() nativo se fetch falhar
- **Validação**: alert() se nome ou telefone vazios
- **Item é pizza**: mostra detalhes (tamanho + sabores) + botão ✏️ Editar
- **Item é produto**: não mostra detalhes, sem botão editar

### AdminPanel
- **Não autenticado**: mostra AdminLogin
- **Autenticado**: 3 abas (Cardápio, Pedidos, Financeiro)

### AdminMenu
- **Normal**: tabela com todos itens do menu
- **Config modal aberto**: sobreposição de configurações
- **Form modal aberto**: sobreposição de cadastro/edição
- **Vazio**: tabela sem linhas

### AdminOrders
- **Normal**: lista de pedidos com filtros
- **Vazio**: "Nenhum pedido encontrado"
- **Novo pedido**: notificação sonora (AudioContext) a cada 10s

### AdminFinanceiro
- **Loading**: stats === null → "Carregando..."
- **Normal**: grid com 7 cards de indicadores

### MenuItemForm
- **Criando**: form vazio
- **Editando**: form preenchido com dados do item
- **Tipo Produto**: mostra campo Preço
- **Tipo Sabor**: mostra select Classificação
- **Tipo Tamanho**: mostra maxSabores + 3 campos de preço por qualidade

### CardapioSettings
- **Normal**: modal com 2 colunas (imagem/logo/texto + tema/fonte/prévia)
- **Com imagem/logo**: preview com overlay e logo arrastável
- **Sem imagem/logo**: preview sem hero background

### MotoboyApp
- **Não autenticado**: mostra MotoboyLogin
- **Autenticado**: mostra MotoboyDashboard
- **Sem permissão de GPS**: alerta solicitando permissão de localização

### MotoboyLogin
- **Normal**: campo de telefone + botão ENTRAR
- **Erro**: "Entregador não encontrado" ou "Senha incorreta"
- **Loading**: estado de carregamento ao buscar

### MotoboyDashboard
- **Online**: tracking GPS ativo, posição enviada a cada 10s
- **Offline**: tracking pausado, botão "Ficar Online"
- **Com pedido ativo**: card destacado com dados do pedido + ações
- **Sem pedido**: "Nenhum pedido no momento — aguardando..."
- **Erro de localização**: GPS indisponível ou permissão negada
- **Timer**: tempo decorrido desde que ficou online

---

## CSS Architecture

### CSS Custom Properties (variáveis)

Usar **OBRIGATORIAMENTE** estas variáveis no lugar de valores fixos:

```
Cores:
--primary, --primary-dark, --primary-light, --primary-soft
--secondary, --accent, --accent-soft
--bg, --bg-card, --bg-surface, --bg-elevated
--text-primary, --text-secondary, --text-muted
--border, --border-light

Sombras:
--shadow-sm, --shadow-md, --shadow-lg, --shadow-glow

Bordas:
--radius (20px), --radius-lg (24px), --radius-md (14px)
--radius-sm (10px), --radius-xs (8px)

Transição:
--transition (all 0.3s cubic-bezier(0.4, 0, 0.2, 1))

Fontes:
--font-heading, --font-body
```

### Sistema de Temas

5 temas aplicados via classe no `.app`:
- `.theme-classic` — Vermelho/dourado, fundo claro
- `.theme-elegance` — Dourado/escuro, glassmorphism
- `.theme-vibrante` — Roxo/teal, gradientes fortes
- `.theme-minimal` — Cinza/marrom, sem bordas
- `.theme-noturno` — Ciano/magenta, neon glow

Cada tema redefine APENAS as variáveis CSS. **NÃO** adicionar estilos específicos de tema fora dos blocos de tema.

### Fontes

4 opções aplicadas via classe no `.app`:
- `.font-classico` — Montserrat + Inter
- `.font-serif` — Playfair Display + Inter
- `.font-moderno` — Poppins + Inter
- `.font-system` — Nativas do sistema

### Classes de Layout do Cardápio (hero)

3 opções aplicadas via classe em `.cardapio-page`:
- `.layout-classic` — hero no topo, logo livre, texto centralizado
- `.layout-modern` — hero com sobreposição, logo e texto sobrepostos
- `.layout-compact` — hero compacto no topo com conteúdo enxuto

---

## Estrutura HTML Detalhada (NÃO RENOMEAR CLASSES)

### Cardápio Page
```html
<div class="cardapio-page layout-{layout}">
  <div class="cardapio-hero" style="backgroundImage: url(...)">
    <div class="hero-overlay" style="background: rgba(...)"></div>
    <div class="hero-content">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
    <img class="hero-logo" style="left: X%; top: Y%; --logo-scale: N" />
  </div>

  <div class="filtros">
    <div class="categorias">
      <button class="cat-btn active">Todas</button>
      <button class="cat-btn">Bebidas</button>
      ...
    </div>
  </div>

  <div class="pizza-montar">
    <h3 class="montar-title">🍕 Monte sua Pizza</h3>
    <p class="sabores-label">Escolha o tamanho:</p>
    <div class="tamanhos-grid">
      <button class="tamanho-btn active">
        <strong>Grande</strong>
        <span class="tamanho-preco">Trad. R$ 48.00</span>
        <small>Até 2 sabores</small>
      </button>
    </div>

    <!-- Só aparece após selecionar tamanho -->
    <p class="sabores-label">
      Selecione os sabores...
      <span class="sabores-count">(1/3)</span>
    </p>
    <input class="input-busca input-busca-sabor" />
    <div class="sabores-grid">
      <button class="sabor-card active">
        <span class="sabor-card-nome">Mussarela</span>
        <span class="sabor-card-desc">Molho de tomate, mussarela...</span>
        <span class="sabor-qual tipo-badge tipo-tradicional">tradicional</span>
      </button>
    </div>
    <p class="erro">Máximo de...</p>
    <button class="btn-add btn-montar-add">Adicionar...</button>
  </div>

  <h3 class="section-title">Bebidas e Produtos</h3>
  <div class="menu-grid">
    <div class="menu-card">
      <div class="card-img">
        <img src="..." />
        <!-- ou --> <span class="emoji-placeholder">🥤</span>
      </div>
      <div class="card-body">
        <h3>Nome</h3>
        <p class="desc">Descrição</p>
        <p class="preco">R$ XX.XX</p>
        <button class="btn-add">Adicionar</button>
      </div>
    </div>
  </div>
</div>
```

### Carrinho Page
```html
<div class="carrinho-page">
  <!-- Vazio -->
  <div class="empty-state">
    <h2>🛒 Carrinho vazio</h2>
    <p>...</p>
    <button class="btn-add">Ver Cardápio</button>
  </div>

  <!-- Pedido enviado -->
  <div class="empty-state">
    <h2>✅ Pedido enviado!</h2>
    <p>...</p>
    <button class="btn-add">Voltar ao Cardápio</button>
  </div>

  <!-- Com itens -->
  <h2>Seu Carrinho</h2>
  <div class="carrinho-itens">
    <div class="carrinho-item">
      <div class="item-info">
        <strong>Nome</strong>
        <div class="pizza-detalhes">
          <span class="pizza-tamanho">Grande</span>
          <span class="pizza-sabores">Sabores: Mussarela, Calabresa</span>
        </div>
        <span>R$ XX.XX</span>
      </div>
      <div class="item-qtd">
        <button>-</button>
        <span>1</span>
        <button>+</button>
        <span class="item-subtotal">R$ XX.XX</span>
      </div>
      <!-- Só pizza tem -->
      <button class="btn-edit-pizza">✏️ Editar</button>
    </div>
  </div>
  <div class="carrinho-total">
    <strong>Total: R$ XX.XX</strong>
  </div>
  <div class="cliente-form">
    <h3>Dados para entrega</h3>
    <input placeholder="Nome" />
    <input placeholder="Telefone" />
    <input placeholder="Endereço" />
    <button class="btn-add btn-finalizar">Finalizar Pedido</button>
  </div>
</div>
```

### Admin Page
```html
<div class="admin-page">
  <div class="admin-tabs">
    <button class="tab-btn active">Cardápio</button>
    <button class="tab-btn">Pedidos</button>
    <button class="tab-btn">Financeiro</button>
  </div>

  <!-- AdminMenu -->
  <div class="admin-header">
    <h2>Gerenciar Cardápio</h2>
    <div class="admin-header-actions">
      <button class="btn-add btn-config">⚙️ Configurações</button>
      <button class="btn-add">+ Novo Item</button>
    </div>
  </div>
  <table class="admin-table">
    <thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Qualidade</th><th>Categoria</th><th>Preço</th><th>Ações</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td><td>Nome</td>
        <td><span class="tipo-badge tipo-sabor">Sabor</span></td>
        <td><span class="tipo-badge tipo-tradicional">Tradicional</span></td>
        <td>Pizzas Salgadas</td>
        <td>R$ XX.XX (ou "-" para sabores, "T: R$ / E: R$..." para tamanhos)</td>
        <td class="acoes">
          <button class="btn-edit">Editar</button>
          <button class="btn-del">Excluir</button>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- AdminOrders -->
  <div class="filtro-status">
    <button class="cat-btn active">Todos</button>
    <button class="cat-btn">Pendente</button>
    ...
  </div>
  <div class="pedidos-lista">
    <div class="pedido-card">
      <div class="pedido-header">
        <strong>Pedido #1</strong>
        <span class="status-badge status-pendente">Pendente</span>
      </div>
      <div class="pedido-body">
        <p><strong>Cliente:</strong> Nome</p>
        ...
        <div class="pedido-itens">
          <strong>Itens:</strong>
          <span class="pedido-item">2x Pizza Grande - R$ 00.00</span>
        </div>
        <p class="pedido-total"><strong>Total: R$ 00.00</strong></p>
      </div>
      <div class="pedido-actions">
        <button class="btn-aceitar">Aceitar</button>
        <button class="btn-recusar">Recusar</button>
      </div>
    </div>
  </div>

  <!-- AdminFinanceiro -->
  <div class="financeiro-grid">
    <div class="fin-card">
      <span class="fin-label">Total de Pedidos</span>
      <span class="fin-value">10</span>
    </div>
    ...
  </div>
</div>
```

### Modals
```html
<div class="modal-overlay"><!-- fundo escuro, onClick fecha -->
  <div class="modal" onclick stopPropagation>
    <h3>Título</h3>
    <!-- conteúdo -->
    <div class="form-actions">
      <button class="btn-add">Salvar</button>
      <button class="btn-del">Cancelar</button>
    </div>
  </div>
</div>
```

### Login Page
```html
<div class="login-page">
  <div class="login-card">
    <h2>🔐 Área Administrativa</h2>
    <form>
      <input type="password" placeholder="Senha" />
      <p class="erro">Senha incorreta</p>
      <button class="btn-add">Entrar</button>
    </form>
  </div>
</div>
```

### Motoboy Page

```html
<div class="motoboy-app">
  <!-- Login -->
  <div class="motoboy-login">
    <div class="motoboy-login-card">
      <svg class="motoboy-login-icon">...</svg>
      <h2>Entregador</h2>
      <p class="motoboy-login-desc">Faça login para começar as entregas</p>
      <form>
        <input type="tel" placeholder="Celular" />
        <input type="password" placeholder="Senha" />
        <p class="erro">Credenciais inválidas</p>
        <button class="btn btn-primary btn-full">Entrar</button>
      </form>
    </div>
  </div>

  <!-- Dashboard -->
  <div class="motoboy-dashboard">
    <header class="motoboy-header">
      <div class="motoboy-header-left">
        <strong class="motoboy-header-nome">João</strong>
        <span class="motoboy-header-status motoboy-status-online">● Online</span>
      </div>
      <button class="topbar-btn" title="Sair">⏻</button>
    </header>

    <div class="motoboy-content">

      <!-- Online/Offline toggle -->
      <div class="motoboy-status-card motoboy-online">
        <div class="motoboy-status-info">
          <span class="motoboy-status-dot"></span>
          <span class="motoboy-status-text">Online — enviando posição</span>
        </div>
        <span class="motoboy-timer">00:12:34</span>
        <button class="btn btn-destructive btn-sm">Ficar Offline</button>
      </div>
      <div class="motoboy-status-card motoboy-offline">
        <div class="motoboy-status-info">
          <span class="motoboy-status-dot"></span>
          <span class="motoboy-status-text">Offline</span>
        </div>
        <button class="btn btn-primary btn-sm">Ficar Online</button>
      </div>

      <!-- Pedido ativo -->
      <div class="card motoboy-pedido-ativo">
        <div class="motoboy-pedido-header">
          <strong>Pedido #42</strong>
          <span class="badge badge-warning">Pendente</span>
        </div>
        <div class="motoboy-pedido-info">
          <p><strong>Cliente:</strong> Maria · (41) 99999-9999</p>
          <p><strong>Endereço:</strong> Rua X, 123</p>
          <p><strong>Itens:</strong> 1x Pizza Grande, 2x Coca-Cola</p>
          <p class="pedido-total"><strong>Total: R$ 58,00</strong></p>
        </div>
        <div class="motoboy-pedido-actions">
          <button class="btn btn-primary btn-sm">Aceitar Entrega</button>
          <button class="btn btn-destructive btn-sm">Reportar Problema</button>
        </div>
      </div>

      <!-- Sem pedido -->
      <div class="card motoboy-aguardando">
        <div class="empty-state">
          <p>🚀 Nenhum pedido no momento</p>
          <p style="font-size:0.85rem;color:var(--text-muted)">Aguardando novas entregas...</p>
        </div>
      </div>

      <!-- Mini mapa -->
      <div class="motoboy-mapa-mini">
        <!-- Leaflet MapContainer -->
      </div>

    </div>
  </div>
</div>
```

### Settings Modal
```html
<div class="modal modal-config"><!-- mais largo que modal normal -->
  <div class="settings-two-cols"><!-- grid 2 colunas -->
    <div>
      <!-- coluna esquerda: capa, logo, texto, overlay -->
      <p class="settings-label">📷 Imagem de Capa</p>
      <div class="settings-file-row">
        <input class="settings-file-input" id="coverFile" type="file" />
        <label class="settings-file-label" for="coverFile">📂 Escolher</label>
      </div>
      <div class="settings-divider"></div>
      <p class="settings-label">🖼️ Logo</p>
      <div class="settings-range-row">
        <input type="range" class="settings-range" />
        <span class="settings-range-value">100%</span>
      </div>
      <!-- ... -->
    </div>
    <div>
      <!-- coluna direita: tema, fonte, prévia -->
      <div class="settings-selector-grid">
        <div class="settings-selector-card active">
          <div class="theme-swatch">
            <span>🔥</span>
            <span style="background: red"></span>
            <span style="background: gold"></span>
          </div>
          <span class="selector-name">Clássico</span>
          <span class="selector-desc">Vermelho e dourado</span>
        </div>
      </div>
      <div class="settings-preview">
        <!-- mini preview do hero com tema/fonte atuais -->
        <div class="settings-preview-hint">↕ Arraste a logo para posicionar</div>
      </div>
    </div>
  </div>
</div>
```

### Background Decorativo
```html
<div class="bg-decoration" aria-hidden="true">
  <span class="float-pizza">🍕</span>
  <!-- 6 spans flutuando -->
</div>
```
Animação CSS `floatPizza` (20s ease-in-out infinite).

---

## Dados do Menu (Supabase)

Cada item no banco tem estes campos:
```js
{
  id: number,
  nome: string,
  descricao: string,
  preco: number | null,          // null para sabores e tamanhos
  categoria: string,             // "Pizzas Salgadas", "Bebidas", etc.
  imagem: string,                // URL ou vazio
  tipo: "sabor" | "tamanho" | "produto",
  maxSabores: number | null,     // só para tamanhos
  classificacao: "tradicional" | "especial" | "nobre" | null,  // só para sabores
  preco_tradicional: number | null,  // só para tamanhos
  preco_especial: number | null,     // só para tamanhos
  preco_nobre: number | null         // só para tamanhos
}
```

### Lógica de Preço de Pizza
- **Sabores** têm `classificacao` (tradicional/especial/nobre)
- **Tamanhos** têm `preco_tradicional`, `preco_especial`, `preco_nobre`
- Preço final = média dos preços dos sabores selecionados, onde cada sabor usa o tier price do tamanho conforme sua classificação
- Se `classificacao` não definida no sabor, assume 'tradicional'
- Se tier price não definido no tamanho, assume 0

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/menu` | Lista cardápio |
| POST | `/api/menu` | Criar item |
| PUT | `/api/menu/:id` | Atualizar item |
| DELETE | `/api/menu/:id` | Deletar item |
| GET | `/api/orders` | Lista pedidos |
| POST | `/api/orders` | Criar pedido |
| PATCH | `/api/orders/:id` | Atualizar status |
| GET | `/api/orders/stats` | Estatísticas |
| POST | `/api/login` | Login admin |
| POST | `/api/motoboy/login` | Login entregador |
| POST | `/api/motoboy/position` | Atualizar posição do motoboy |
| GET | `/api/motoboy/position` | Obter posição atual do motoboy |

---

## localStorage Keys

Todas as configurações persistem em localStorage (nunca em servidor):

| Key | Tipo | Default | Descrição |
|-----|------|---------|-----------|
| `appTheme` | string | `'classic'` | Tema ativo |
| `appFont` | string | `'classico'` | Fonte ativa |
| `cardapioCoverUrl` | string | `''` | URL/dataURL da imagem de capa |
| `cardapioLogoUrl` | string | `''` | URL/dataURL do logo |
| `cardapioLogoX` | string (float) | `'50'` | Posição X do logo (%) |
| `cardapioLogoY` | string (float) | `'50'` | Posição Y do logo (%) |
| `cardapioLogoSize` | string (float) | `'100'` | Tamanho do logo (%) |
| `cardapioTitle` | string | `''` | Título do hero |
| `cardapioSubtitle` | string | `''` | Subtítulo do hero |
| `cardapioOverlay` | string (float) | `'0'` | Escurecimento (-100 a 100) |
| `cardapioLayout` | string | `'classic'` | Layout: classic, modern, compact |

Admin auth usa `sessionStorage` (não localStorage):
| Key | Tipo | Descrição |
|-----|------|-----------|
| `adminAuth` | string | `'true'` após login bem-sucedido |

Motoboy usa `localStorage`:
| Key | Tipo | Descrição |
|-----|------|-----------|
| `motoboyToken` | string | Token JWT do entregador |
| `motoboyUser` | JSON | Dados do entregador (id, nome, telefone) |
| `motoboyOnline` | boolean | `'true'` se estava online |

---

## Responsivo

### Breakpoints Existentes
- **768px**: `.tamanhos-grid` vira 2 colunas, `.menu-grid` vira 2 colunas, admin-table esconde colunas
- **600px**: Ajustes de padding no carrinho e modal
- **480px**: `.tamanhos-grid` vira 1 coluna, `.sabores-grid` vira 1 coluna, modal padding reduzido

### Tamanho Mínimo de Tela
- **Largura mínima**: 320px (celular pequeno)
- Conteúdo não deve quebrar ou vazar abaixo de 320px
- Header texto pode ser truncado com ellipsis em telas muito estreitas
- Botões de tamanho e sabor devem ser legíveis (min 44px altura de toque)

---

## Regras de Design

1. **Todas as cores via CSS custom properties** — nunca usar valores hex/rgb fixos
2. **Todas as bordas arredondadas via variáveis** — `var(--radius-*)`
3. **Sombras via variáveis** — `var(--shadow-*)`
4. **Transições via** `var(--transition)`
5. **Fontes via** `var(--font-heading)` e `var(--font-body)`
6. **Não adicionar estilos específicos de tema fora dos blocos `.theme-*`** — os temas só trocam variáveis
7. **Manter a classe `.app` com `display: flex; flex-direction: column; min-height: 100vh`** — o header e footer dependem disso
8. **Botões de ação principal usam `.btn-add`**, botões destrutivos usam `.btn-del`, botões de editar usam `.btn-edit`
9. **Estado ativo em botões**: classe `.active`
10. **Tags/badges**: classe `.tipo-badge` + `.tipo-{sabor|tamanho|produto|tradicional|especial|nobre}`
11. **Status badges**: classe `.status-badge` + `.status-{pendente|aceito|entregue|recusado}`
12. **App do entregador (`motoboy/`)**: usa o mesmo design system do admin (variáveis CSS, componentes `.btn`, `.card`, `.badge`, `.modal`, `.empty-state`)
13. **Classes específicas do motoboy** prefixadas com `.motoboy-`: `.motoboy-app`, `.motoboy-login`, `.motoboy-dashboard`, `.motoboy-header`, `.motoboy-status-card`, `.motoboy-pedido-ativo`, `.motoboy-mapa-mini`
14. **Status do motoboy**: `.motoboy-online` (verde), `.motoboy-offline` (cinza/destructive), `.motoboy-perdendo-sinal` (warning)

---

## O Que PODE Ser Modificado

- Cores, fontes, tamanhos, padding, margens, bordas, sombras
- Grid layouts (incluindo `grid-template-columns`, `gap`)
- Animações e transições
- Novo CSS para novos elementos que você adicionar
- Elementos decorativos (backgrounds, patterns, ícones)
- Estrutura HTML desde que classes existentes NÃO sejam removidas (pode adicionar wrappers)

## O Que NÃO PODE Ser Modificado

- Nenhuma classe CSS existente
- Nenhum nome de função ou componente
- Nenhuma lógica de estado ou fluxo de dados
- Nenhuma chamada de API
- Nenhuma lógica de preço de pizza
- Nenhuma lógica de carrinho
- Inputs `type`, `name`, `placeholder` (a menos que para adicionar novos)
- Estrutura de dados do menu
- Sistema de temas (blocos CSS `.theme-*`)
- Sistema de fontes (blocos CSS `.font-*`)
- localStorage/sessionStorage keys
- A classe `.app` no elemento raiz
- A estrutura de rotas/páginas

---

## Dicas para um Layout Premium

- Use `background-image` com gradientes sutis sobre fotos de pizza
- Cards com `backdrop-filter: blur()` para glassmorphism
- Transições suaves em todos os hovers
- Sombras profundas para elevação
- Grids responsivos com `auto-fill` e `minmax()`
- Aproveite os emojis já presentes como ícones (🍕, 🛒, 🔐, ✏️)
- A barra de busca de sabores (`input-busca-sabor`) pode ganhar um ícone de lupa
- O empty state pode ter ilustrações maiores e mais chamativas
- A seção "Monte sua Pizza" pode ser visualmente destacada do resto com fundo diferente ou borda
- Hero pode ter gradiente sobreposto para melhor legibilidade do texto
