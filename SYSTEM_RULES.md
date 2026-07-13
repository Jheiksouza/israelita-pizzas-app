# System Rules — Quero Pizza

> Este arquivo documenta todas as regras de funcionamento validadas do sistema.
> **Regras validadas só devem ser alteradas com instrução explícita do usuário.**

---

## 1. Multi-tenant

### 1.1 Stores
- Cada pizzaria cliente é uma row na tabela `stores` com `slug` único
- O subdomínio `{slug}.queropizza.com` identifica a loja
- O middleware no servidor extrai o slug do header `Host` com regex `/^(.+)\.queropizza\.com(:\d+)?$/`
- `req.store` é populado com os dados da store no middleware
- Tabelas de dados (`users`, `menu`, `orders`, `carts`, `app_config`) têm coluna `store_id` FK → `stores.id`
- Todas as queries são escopadas por `store_id` via helper `sb(table)` ou `storeId(req)`

### 1.2 Criação de nova loja
- Landing page `queropizza.com` → formulário → `POST /api/stores`
- Cria row em `stores` com slug gerado do nome
- Cria primeiro usuário admin
- Redireciona para `{slug}.queropizza.com/admin` com JWT

### 1.3 Fallback store_id
- `DEFAULT_STORE_ID=1` no .env para localhost/preview sem subdomínio
- Store 1 é sempre a Israelita Pizzas

---

## 2. Google OAuth (Login)

### 2.1 Fluxo — Redirect Server-Side
1. Usuário clica "Entrar com Google"
2. Redireciona para `/api/auth/google/login?redirect=...&store={slug}`
3. Servidor monta URL de autorização do Google com `redirect_uri = https://queropizza.com/api/auth/google/callback`
4. Google redireciona para `https://queropizza.com/api/auth/google/callback?code=...&state=...`
5. Servidor troca code por tokens, extrai dados (`email`, `name`, `sub`)
6. Busca ou cria usuário na store correta (slug vem do state)
7. Redireciona de volta para `{slug}.queropizza.com?token=...&user=...`
8. Frontend captura token da URL, salva em localStorage, recarrega

### 2.2 Regras de usuário
- Se email + store_id já existem → login (retorna usuário existente)
- Se não existem → cria novo com `role: 'cliente'`, `status: 'ativo'`
- `google_id` é único global (constraint UNIQUE)

### 2.3 Google Cloud Console
- Único redirect URI necessário: `https://queropizza.com/api/auth/google/callback`
- JavaScript origins: `https://queropizza.com`
- Client ID: `433687511785-95t4n2nulpja1aotvq6rfo74oui708im.apps.googleusercontent.com`

---

## 3. Autenticação (Email/Senha)

- `POST /auth/signup` — cria usuário com `role: 'cliente'`, `status: 'ativo'`
- `POST /auth/login` — valida email + senha com bcrypt, retorna JWT
- `GET /auth/me` — retorna dados do usuário atual (requer token)
- `PATCH /auth/me` — atualiza dados do perfil
- `PATCH /auth/enderecos` — gerencia endereços salvos
- JWT expira em 7 dias, contém: `id`, `email`, `nome`, `role`, `store_id`

---

## 4. Admin

### 4.1 Roles e permissões
| Role | Acesso |
|------|--------|
| `admin` | Tudo |
| `atendente` | Pedidos |
| `financeiro` | Pedidos |
| `cliente` | Sem acesso admin |
| `motoboy` | Sem acesso admin |

### 4.2 Abas do admin
- **Pedidos**: gerenciar ciclo do pedido (pendente → aceito → liberado → em_rota → entregador_proximo → entregue)
- **Cardápio**: CRUD de itens do menu
- **Pizzaria**: config (CNPJ, endereço, localização no mapa)
- **Integrações**: marketplaces (iFood)
- **Permissões**: gerenciar roles dos usuários
- **Gerenciar**: motoboys pendentes
- **Rastreio**: mapa com motoboys em tempo real

### 4.3 Config da Pizzaria
- Salvando em `stores.config` (coluna JSONB)
- Ao digitar CEP: AwesomeAPI busca endereço + coordenadas (`lat`, `lng`)
- Fallback: ViaCEP (sem coordenadas)
- "Marcar no mapa" abre modal que usa `initialCoords` (lat/lng salvos) se disponível, senão geocode do endereço via servidor (`POST /geocode`)
- Confirmar no mapa → atualiza lat/lng no form → salvar → `PUT /admin/config/pizzaria` com senha `admin123`

### 4.4 Rastreio (mapa)
- Centro do mapa = pizzaria (`pizzaria.lat`, `pizzaria.lng`)
- Se não tiver config da pizzaria, usa primeiro motoboy online
- Marker vermelho "P" para pizzaria
- Markers coloridos para motoboys (verde = online, laranja = sinal perdido, vermelho = offline)

---

## 5. Cardápio

- `GET /menu` — lista itens da store
- `POST /menu` — cria item (admin)
- `PUT /menu/:id` — atualiza item
- `DELETE /menu/:id` — remove item
- Cada item tem: `nome`, `descricao`, `preco`, `categoria`, `imagem`, `disponivel`
- Categorias comuns: `Pizzas`, `Bebidas`, `Porções`, `Sobremesas`

---

## 6. Carrinho

- `GET /cart` — carrinho do usuário
- `PUT /cart` — adiciona/atualiza item no carrinho
- Carrinho é salvo na tabela `carts` (persistente entre sessões)
- Escopado por `store_id` e `user_id`

---

## 7. Pedidos

### 7.1 Ciclo de status
```
pendente → aceito → liberado → em_rota → entregador_proximo → entregue
                → cancelado
```
- `pendente`: aguardando confirmação do admin
- `aceito`: em preparo
- `liberado`: pronto, aguardando motoboy
- `em_rota`: motoboy a caminho
- `entregador_proximo`: motoboy chegou
- `entregue`: finalizado
- `cancelado`: cancelado (de qualquer status exceto entregue)

### 7.2 Auto-cancelamento
- Pedidos pendentes são cancelados automaticamente após **8 minutos**
- (Valor alterado de 5min para 8min para igualar iFood)

### 7.3 Atribuição de motoboy
- Motoboy "pega" pedido via `POST /motoboy/pegar-pedido`
- Atribuição salva em `app_config` com chave `pedido_motoboy_{id}`
- Pedido só pode ser pego por um motoboy (verificação de conflito)

---

## 8. Entregador (Motoboy)

### 8.1 Fluxo
- Login via app `{slug}.queropizza.com/motoboy`
- Login com Google (redirect server-side) ou email/senha
- Ao entrar online: watchPosition envia localização a cada intervalo
- `POST /motoboy/position` — atualiza posição
- `POST /motoboy/offline` — marca como offline
- `GET /motoboy/pedidos-disponiveis` — pedidos liberados para entrega
- `POST /motoboy/pegar-pedido` — assume um pedido
- `GET /motoboy/pedidos` — pedidos do motoboy

### 8.2 Status online
- Online: posição enviada há < 45s
- Sinal perdido: > 45s sem atualização
- Offline: marcado explicitamente

---

## 9. Marketplaces (iFood)

- Integração via `app_config` com chave `marketplaces`
- Webhook `POST /marketplace/ifood/webhook` recebe pedidos do iFood
- Polling `POST /marketplace/ifood/poll` busca pedidos novos
- Configuração em `GET/PUT /config/marketplaces/:platform`
- Teste de conexão via `POST /marketplace/:platform/test`
- Pedidos do iFood viram pedidos internos com `store_id` da store

---

## 10. Firebase / Push Notifications

- FCM tokens salvos em `app_config` com chave `fcm_tokens` (store_id = null, global)
- `POST /fcm/token` — registra token do dispositivo
- Push enviado para motoboys e clientes sobre mudanças de status

---

## 11. Banco de Dados (Supabase)

### 11.1 Tabelas
| Tabela | Função |
|--------|--------|
| `stores` | Lojas (multi-tenant) |
| `users` | Usuários (clientes, admins, motoboys) |
| `menu` | Itens do cardápio |
| `orders` | Pedidos |
| `carts` | Carrinhos |
| `app_config` | Configurações chave-valor |

### 11.2 RLS (Row Level Security)
- Todas as tabelas têm política `FOR ALL USING (true) WITH CHECK (true)` — anon acesso total
- Exceto `stores` que PRECISA ter política explícita (já adicionada)

### 11.3 Constraints
- `users`: UNIQUE(store_id, email) — email único por loja
- `users`: UNIQUE(google_id) — google_id único global
- `app_config`: UNIQUE index (COALESCE(store_id, -1), chave)

---

## 12. Deploy & Infraestrutura

### 12.1 Vercel
- Repositório: `github.com/Jheiksouza/israelita-pizzas-app`
- Domínios configurados: `queropizza.com`, `*.queropizza.com`, `israelita.queropizza.com`
- Wildcard DNS apontado para Vercel
- Build: `cd client && npm install && npm run build && cd ../admin && npm install && npm run build && cd ../motoboy && npm install && npm run build`
- Rewrites: `/api/*` → Express, `/admin/*` → admin SPA, `/motoboy/*` → motoboy SPA

### 12.2 Env Vars (Vercel)
Obrigatórias:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para bypass RLS em reparos)
- `SUPABASE_PAT` (para executar SQL via Management API)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET`
- `DEFAULT_STORE_ID=1`

### 12.3 URL Normalization (Vercel)
- Middleware no Express remove prefixo `/api` de `req.url`
- Todas as rotas no Express são definidas SEM `/api` (ex: `app.get('/auth/google/login')`)
- Frontend chama COM `/api` (ex: `${API}/auth/google/login` onde `API='/api'`)

---

## 13. Regras de Frontend

### 13.1 Roteamento por domínio
- `queropizza.com` → LandingPage (vendas + cadastro)
- `{slug}.queropizza.com` → App principal (cardápio)
- `{slug}.queropizza.com/admin` → Admin SPA
- `{slug}.queropizza.com/motoboy` → Motoboy SPA

### 13.2 Google OAuth callback
- `App.jsx` (todos os SPAs) têm `useEffect` que captura `token` e `user` da URL no mount
- Após capturar, limpa a URL com `window.history.replaceState` e recarrega

### 13.3 Mapa (Leaflet)
- Busca de endereço usa servidor (`POST /api/geocode`) — evita CORS/adblock
- Marcadores usam `L.divIcon` com HTML customizado

---

## 14. Regras de Servidor (server.js)

- `checkSupabase(res)` — valida se Supabase está configurado antes de queries
- `authMiddleware` — extrai JWT do header Authorization, deixa `req.user` ou null
- `requireRole(...roles)` — middleware que bloqueia se role não permitida
- `sb(table)` — factory que retorna query builder escopado por `store_id`
- `storeId(req)` — extrai store_id (de `req.store.id` ou `DEFAULT_STORE_ID`)

---

## 15. Histórico de Validações

| Data | Regra | Status |
|------|-------|--------|
| 2026-07-12 | Multi-tenant: store_id em todas as queries | ✅ Validado |
| 2026-07-12 | Login Google redirect server-side (qualquer subdomínio) | ✅ Validado |
| 2026-07-12 | Admin config pizzaria: fallback app_config → stores.config | ✅ Validado |
| 2026-07-12 | CEP preenche endereço + coordenadas via AwesomeAPI | ✅ Validado |
| 2026-07-12 | Mapa pizzaria centra nas coordenadas do CEP | ✅ Validado |
| 2026-07-12 | Geocode via servidor (POST /geocode) para evitar CORS | ✅ Validado |
| 2026-07-12 | Prioriza pizzaria como centro do mapa de rastreio | ✅ Validado |
| 2026-07-12 | Store 'israelita' criada + RLS policy para stores | ✅ Validado |
