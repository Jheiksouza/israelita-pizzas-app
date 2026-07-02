# Design System — Israelita Pizzas ERP

> Inspirado em Stripe, Linear, Vercel e Notion.
> Código e pixels em equilíbrio — funcional primeiro, bonito por consequência.
>
> **Escopo:** Este design system se aplica **exclusivamente** ao diretório `admin/`.
> O app do cliente (`client/`) possui seu próprio sistema de estilos e temas definidos em `client/src/App.css`.
> Os dois compartilham as mesmas variáveis CSS raiz (`:root`) no arquivo de estilos de cada um, mas NÃO compartilham componentes, layouts ou padrões visuais.

---

## 1. Filosofia

Cada decisão visual serve a um propósito: **clareza, eficiência e confiança**.

| Inspiração     | Princípio                          | Aplicação no ERP                               |
| -------------- | ---------------------------------- | ---------------------------------------------- |
| **Stripe**     | Profissionalismo silencioso        | Cards financeiros, tipografia limpa, espaçamento generoso |
| **Linear**     | Clareza de estado + foco           | Status de pedidos, badges, dark mode nativo    |
| **Vercel**     | Precisão geométrica                | Grids, borders consistentes, escala modular    |
| **Notion**     | Flexibilidade sem ruído            | Kanban de pedidos, sidebars, hierarquia textual |

---

## 2. Design Principles

1. **Status à prova de dúvida** — Todo estado (pendente, aceito, em rota, entregue) tem cor, ícone e label. Zero ambiguidade.
2. **Hierarquia implícita** — Tamanho, peso e cor guiam o olhar. Nada de caixas desnecessárias.
3. **Toque nativo** — Gestos, haptics, scroll suave. O app responde como um app, não como um site.
4. **Denso mas respirável** — Informação máxima, ruído mínimo. Espaçamento generoso entre grupos.
5. **Tema como identidade** — Cada tema (Classic, Elegance, Vibrant, Minimal, Noturno, Neon) é uma experiência completa, não só paleta.
6. **Mobile-first, desktop-aware** — O admin desktop aproveita o espaço sem perder a usabilidade do toque.

---

## 3. Tokens de Design

### 3.1 Cores Base

```css
--primary:        #E53935      /* Vermelho Israelita — ações principais */
--primary-dark:   #C62828      /* Hover / active */
--primary-light:  #FF6F60      /* Glow / destaque sutil */
--primary-soft:   #FFEBEE      /* Background de áreas selecionadas */
--secondary:      #FF8F00      /* Laranja — badges, destaques secundários */
--accent:         #FFB300      /* Amarelo — CTAs alternativos */
--accent-soft:    #FFF8E1      /* Fundo de avisos */
```

### 3.2 Neutros

```css
--bg:             #FAF8F5      /* Fundo geral — quente e acolhedor */
--bg-card:        #FFFFFF      /* Superfície de cards */
--bg-surface:     #F5F2ED      /* Superfície elevada (hover, inputs) */
--bg-elevated:    #FFFFFF      /* Modal / dropdown */
--text-primary:   #1D1D1D      /* Títulos e corpo principal */
--text-secondary: #5F5F5F      /* Corpo secundário, labels */
--text-muted:     #9E9E9E      /* Placeholder, metadados */
--border:         #E8E3DC      /* Bordas principais */
--border-light:   #F0EDE8      /* Bordas sutis */
```

### 3.3 Semântica

```css
--success:        #43A047      /* Verde — entregue, ativo, salvo */
--warning:        #F57F17      /* Laranja — pendente, atenção */
--error:          #E53935      /* Vermelho — recusado, erro */
--info:           #1565C0      /* Azul — processando, info */
--neutral:        #78909C      /* Cinza — inativo */
```

Status → cor mapping:
| Status               | Cor      | Fundo       | Borda       |
| -------------------- | -------- | ----------- | ----------- |
| Pendente             | #F57F17  | #FFF8E1     | #FFE082     |
| Aceito (preparo)     | #1565C0  | #E3F2FD     | #90CAF9     |
| Liberado (pronto)    | #7B1FA2  | #F3E5F5     | #CE93D8     |
| Em rota              | #FF8F00  | #FFF3E0     | #FFCC80     |
| Entregador próximo   | #D4A574  | #1A0F08     | #D4A574     |
| Entregue             | #2E7D32  | #E8F5E9     | #A5D6A7     |
| Recusado             | #C62828  | #FFEBEE     | #EF9A9A     |

### 3.4 Tipografia

```css
--font-heading: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

| Uso                 | Família    | Peso           | Tamanho         |
| ------------------- | ---------- | -------------- | --------------- |
| Display / Hero      | Playfair   | 700, 900       | 2.5–4rem        |
| Título de página    | Montserrat | 700            | 1.25–1.75rem    |
| Subtítulo / seção   | Montserrat | 600            | 1–1.15rem       |
| Corpo               | Inter      | 400, 500       | 0.875–1rem      |
| Label / meta        | Inter      | 500, 600       | 0.72–0.82rem    |
| Dado tabular        | Inter      | 600 (tabular)  | 0.85–1.8rem     |
| Código / Preço      | Inter      | 700            | inherit         |

**Line-height:** 1.5 (body), 1.2 (headings), 1.1 (display).

### 3.5 Espaçamento

Sistema de 4px:

| Token   | px   | Uso                          |
| ------- | ---- | ---------------------------- |
| `--4`   | 4px  | Micro espaçamento            |
| `--8`   | 8px  | Entre elementos inline       |
| `--12`  | 12px | Entre inputs, badges         |
| `--16`  | 16px | Padding interno de cards     |
| `--20`  | 20px | Entre cards, seções          |
| `--24`  | 24px | Padding de modals, headers   |
| `--32`  | 32px | Seções grandes               |
| `--48`  | 48px | Agrupamentos de página       |
| `--64`  | 64px | Hero / empty states          |

### 3.6 Border Radius

```css
--radius-xs:  8px    /* badges, small buttons */
--radius-sm:  10px   /* cards compactos, selects */
--radius-md:  14px   /* inputs, cards, modals */
--radius-lg:  24px   /* modals grandes, empty states */
--radius:     20px   /* variável genérica */
```

### 3.7 Sombras

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md:  0 4px 16px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
--shadow-lg:  0 12px 40px rgba(0,0,0,0.08);
--shadow-glow: 0 4px 20px rgba(229,57,53,0.15);
```

Elevação: cards usam `shadow-sm` por padrão, elevam para `shadow-md` no hover. Modals usam `shadow-lg`. Glow é reservado para CTAs principais e cards financeiros.

### 3.8 Transições

```css
--transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

Usada em hover, active, focus, e entrada de componentes. Todos os elementos interagíveis devem ter `transition: var(--transition)`.

---

## 4. Componentes

### 4.1 Botões

| Variante     | Uso                       | Visual                                    |
| ------------ | ------------------------- | ----------------------------------------- |
| `.btn-add`   | Primário                  | Gradiente primary→primary-dark, sombra    |
| `.btn-del`   | Destrutivo / secundário   | Outline primary, hover preenche           |
| `.btn-edit`  | Edição                    | Surface, hover primary-soft               |
| `.btn-config`| Configurações             | Outline neutro, sem gradiente             |
| `.btn-full`  | Largura total             | Adiciona `width:100%` ao btn-add          |
| `.btn-aceitar`| Aceitar pedido           | Gradiente verde                           |
| `.btn-recusar`| Recusar pedido           | Outline vermelho, hover preenche          |
| `.btn-liberar`| Liberar entrega          | Gradiente roxo                            |

**Regras:**
- Botões primários têm `transform: translateY(-2px)` no hover.
- NUNCA use `!important` fora de overrides de tema.
- Botões desabilitados usam `opacity: 0.6` + `cursor: not-allowed`.

### 4.2 Cards

```css
.card {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
```

Cards interativos elevam no hover: `transform: translateY(-3px)`, `box-shadow: var(--shadow-md)`.

### 4.3 Inputs

```css
input, textarea, select {
  padding: 12px 18px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.92rem;
  font-family: var(--font-body);
  transition: var(--transition);
}
input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(229,57,53,0.1);
}
```

- Labels ficam acima do input (stack vertical).
- Inputs de endereço têm grid variável (duplo, triplo).
- Inputs com CEP têm auto-complete via ViaCEP.

### 4.4 Modal

```css
.modal-overlay {
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(6px);
  z-index: 10001;
}
.modal {
  background: var(--bg-card);
  padding: 32px;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 520px;
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-lg);
  animation: modalIn 0.3s ease;
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

- `.modal-mapa`: max-width 98vw (mobile), 1100px (desktop).
- `.modal-config`: max-width 640px.
- Fechar com botão `.modal-close` (32×32, círculo, bg-surface).

### 4.5 Tabela

```css
.admin-table {
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.admin-table th {
  padding: 14px 20px;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  background: var(--bg-surface);
}
.admin-table td {
  padding: 14px 20px;
  border-bottom: 1.5px solid var(--border-light);
}
```

- Última linha sem borda inferior.
- Hover com fundo `rgba(229,57,53,0.03)`.

### 4.6 Badges / Tags

```css
.tipo-badge, .status-badge, .permissoes-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 50px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
```

Usados para: tipo de item (sabor, tamanho, produto), classificação (tradicional, especial, nobre), status de pedido, role do usuário.

### 4.7 Empty State

```css
.empty-state {
  text-align: center;
  padding: 80px 24px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-md);
}
```

---

## 5. Padrões de Layout

### 5.1 Admin Shell

```
┌──────────────────────────────────────┐
│ .admin-header-bar (sticky, 52px)    │
│ Logo | Role | Nome | [Sair]         │
├──────────────────────────────────────┤
│ .admin-page (max-width: 1200px)     │
│   ┌──────────────────────────────┐  │
│   │ .admin-tabs                  │  │
│   │ [Cardápio] [Pedidos] [Fin...]│  │
│   ├──────────────────────────────┤  │
│   │ .admin-header                │  │
│   │ Título           [Ações]     │  │
│   ├──────────────────────────────┤  │
│   │ Conteúdo da aba              │  │
│   └──────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 5.2 Mobile Adaptations

Abaixo de 768px:
- Header bar reduz padding para 10px 16px.
- Admin tabs viram scroll horizontal.
- `.admin-header` coluna (flex-direction: column).
- Financeiro grid vira 2 colunas.
- Tabelas: font-size 0.8rem, padding reduzido.
- Modals: padding 24px 20px.
- Pedidos: layout fullscreen com swipe (cards ocupam viewport inteira).

### 5.3 Order Cards (Kanban-style)

Cada pedido é um card independente com:
1. **Header**: ID + status badge
2. **Body**: Cliente nome/tel, endereço, meta (hora, valor, timer), itens
3. **Actions**: Aceitar/Recusar/Liberar/Entregue (conforme status)

Cards pendentes têm `pedido-pendente-destaque` com animação glow.

---

## 6. Temas

### 6.1 Tema Clássico (Default)

```css
.theme-classic {
  --primary: oklch(0.62 0.18 30);   /* Vermelho telha */
  --bg: oklch(0.16 0.012 40);       /* Marrom escuro */
  /* ... todos os tokens adaptados */
}
```

### 6.2 Tema Elegance

Dourado sobre preto. `--primary: #D4AF37`. Cards translúcidos com backdrop-filter.

### 6.3 Tema Vibrante

Roxo + teal. `--primary: #7B1FA2`, `--secondary: #00897B`.

### 6.4 Tema Minimal

Cinzas sóbrios. `--primary: #546E7A`, `--secondary: #8D6E63`. Sem gradientes.

### 6.5 Tema Noturno

Ciano + magenta. `--primary: #00BCD4`, `--secondary: #E040FB`. Glows neon.

### 6.6 Tema Neon

Roxo elétrico + teal. `--primary: #BD00FF`, `--secondary: #00EEFC`. O mais extremo.

Todos os temas definem **todas** as variáveis CSS — `--bg`, `--text-primary`, `--border`, etc. — para experiência completa sem fallback.

---

## 7. Animações

| Nome              | Duração | Easing     | Uso                          |
| ----------------- | ------- | ---------- | ---------------------------- |
| `fadeUp`          | 0.5s    | ease       | Entrada de página / seção    |
| `fadeIn`          | 0.2s    | ease       | Modal overlay                |
| `modalIn`         | 0.3s    | ease       | Modal content                |
| `pedidoGlow`      | 1s      | ease-in-out| Card pedido pendente         |
| `statusProximoPulse` | 2s   | ease-in-out| Badge "entregador próximo"   |
| `timerUrgencia`   | 0.5s    | ease-in-out| Timer expirando              |
| `motoboyBtnPulse` | 1s      | alternate  | Indicador GPS online         |

---

## 8. Responsivo

| Breakpoint | Largura   | Comportamento                        |
| ---------- | --------- | ------------------------------------ |
| Mobile     | < 480px   | 1 coluna, modals compactos           |
| Tablet     | 480–768px | 2 colunas, scroll horizontal tabs    |
| Desktop    | 768–1200px| Layout completo, sidebar vertical    |
| Wide       | > 1200px  | Grid expandido, mapa grande          |

---

## 9. Acessibilidade

- Contraste mínimo 4.5:1 em texto normal.
- Estados de foco visíveis com `box-shadow` em inputs.
- Botões têm `cursor: pointer`.
- Animações respeitam `prefers-reduced-motion` (reduzir ou desligar).
- Labels associados via elemento `<label>`.

---

## 10. Ícones

Usar **SVG inline** (estilo Feather/Lucide) para simplicidade, consistência e performance. Emojis NÃO devem ser usados como ícones.

Os ícones são definidos como componentes React no topo de `App.jsx` com o prefixo `Icon` (ex: `IconPizza`, `IconPin`). Cada componente aceita `size` (default 20px) e retorna um `<span className="i">` contendo o SVG.

### Convenções
- **Traço:** `strokeWidth={2}`, `fill="none"`, `stroke="currentColor"`
- **ViewBox:** `0 0 24 24`
- **Wrapper:** `<span className="i" style={{ width: size, height: size }}>`
- **CSS:** classe `.i` com `display: inline-flex; vertical-align: middle;`
- O SVG herda a cor via `currentColor` — a cor é controlada pelo CSS pai.

### Componentes disponíveis

| Componente       | Uso                          |
| ---------------- | ---------------------------- |
| `IconPizza`      | Logo, login, cardápio        |
| `IconPin`        | Rastreio, endereço, mapa     |
| `IconStore`      | Aba Pizzaria                 |
| `IconLock`       | Aba / página Permissões      |
| `IconClock`      | Horário do pedido            |
| `IconTimer`      | Temporizador de expiração    |
| `IconCheck`      | Botão Aceitar                |
| `IconClose`      | Botão Recusar, fechar modal  |
| `IconTruck`      | Botão Liberar                |
| `IconCheckCircle`| Botão Entregue / Confirmar   |
| `IconScooter`    | Motoboy offline              |
| `IconSearch`     | Busca no mapa                |

---

## 11. Sistema de Arquivos (Admin App)

```
admin/
├── src/
│   ├── App.jsx          # Shell principal + todas as telas
│   ├── App.css          # Design system completo + estilos
│   └── main.jsx         # Entry point
├── index.html
├── package.json
└── vite.config.js
```

O admin é um app React independente, buildado para `client/dist/admin` e servido na rota `/admin`.

---

## 12. Checklist de Consistência

- [ ] Todas as cores usam variáveis CSS, nunca valores literais.
- [ ] Botões têm `transition: var(--transition)`.
- [ ] Cards têm `border-radius: var(--radius-lg)` + `box-shadow: var(--shadow-sm)`.
- [ ] Inputs têm `border-radius: var(--radius-md)` + foco com `box-shadow`.
- [ ] Status de pedido seguem o mapping de cores da seção 3.3.
- [ ] Modals têm backdrop-filter + animação modalIn.
- [ ] Todo estado de carregamento usa `.empty-state` ou spinner.
- [ ] Responsivo testado em 4 breakpoints (480/768/1200+).
- [ ] Temas definem 100% dos tokens (sem fallback para :root).
