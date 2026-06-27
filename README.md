# Israelita Pizzas App

Sistema de pedidos para Pizzaria Israelita — cardápio online + painel admin.

## Stack

- **Frontend:** React 19 + Vite 8
- **Backend:** Node.js + Express (roda como Serverless Function no Vercel)
- **Banco:** PostgreSQL via Supabase
- **Deploy:** Vercel (conectado via GitHub)

---

## Estrutura do Projeto

```
/
├── api/                    # Serverless Functions do Vercel
│   ├── index.js           # Express app (lida com /api/*)
│   ├── health.js          # Teste simples de env vars
│   └── test-env.js        # Debug: mostra as env vars
├── client/                # Frontend React
│   ├── src/
│   │   ├── App.jsx       # App inteiro (644 linhas)
│   │   └── App.css       # Estilos dark theme
│   ├── vite.config.js
│   └── package.json
├── server.js              # Servidor Express (raiz)
├── vercel.json            # Config de deploy
├── supabase-setup.sql     # Schema do banco + seed
├── .env.example           # Template das env vars
└── .env                   # Credenciais (NÃO COMMITAR)
```

## Banco de Dados (Supabase)

**URL do projeto:** `https://qnttyikrbuxuhzqybmaa.supabase.co`

**Tabelas:**
- `menu` — itens do cardápio (sabores, tamanhos, bebidas)
- `orders` — pedidos feitos pelos clientes

**Acessar:**
1. Vai em https://supabase.com
2. Entra na conta
3. Seleciona o projeto `qnttyikrbuxuhzqybmaa`
4. **SQL Editor** — roda comandos SQL
5. **Table Editor** — vê/edita dados direto

**Seed:** O arquivo `supabase-setup.sql` tem o schema completo + 12 itens iniciais. Se precisar recriar as tabelas, roda ele no SQL Editor.

---

## Variáveis de Ambiente

Criar arquivo `.env` na raiz com:

```
SUPABASE_URL=https://qnttyikrbuxuhzqybmaa.supabase.co
SUPABASE_ANON_KEY=sb_publishable_Q2jL5Q8YXlfmEU0a3RC65g_L-EVCNXW
```

Essas também precisam estar configuradas no **Vercel Dashboard:**
- Settings → Environment Variables
- Adicionar `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Marcar "Production" e "Preview"

> `.env` está no `.gitignore` — nunca commitar!

**Testar localmente se as credenciais funcionam:**
```powershell
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); supabase.from('menu').select('*').then(r => console.log('OK!', r.data.length, 'itens')).catch(e => console.error('Erro:', e.message))"
```

---

## Como Rodar Localmente

```bash
# Instalar dependências (raiz + client)
npm run install-all

# Rodar servidor + frontend ao mesmo tempo
npm run dev
```

- Express roda em `http://localhost:3001`
- Vite roda em `http://localhost:5173` (com proxy de `/api` pra `:3001`)

---

## Deploy (Vercel)

### Como funciona

O Vercel está conectado ao GitHub (`github.com/Jheiksouza/israelita-pizzas-app`).  
**Toda vez que dá push na branch `main`, o Vercel faz deploy automático.**

### O que o Vercel faz no deploy:

1. Roda `cd client && npm install && npm run build` (build do React com Vite)
2. Gera a pasta `dist/` com os arquivos estáticos
3. Compila as **Serverless Functions** da pasta `api/`
4. Aplica as **rewrites** do `vercel.json`

### Regras de roteamento (`vercel.json`):

```json
"rewrites": [
  { "source": "/api/(.*)", "destination": "/api" },  // API → Express
  { "source": "/(.*)", "destination": "/index.html" } // SPA → index.html
]
```

1. Requisições para `/api/*` (exceto funções individuais como `/api/test-env`) vão pro Express em `/api`
2. Qualquer outra rota serve `index.html` (pro React Router funcionar)
3. Funções individuais em `api/*.js` (ex: `api/health.js`) são prioridade antes das rewrites

### Configuração crítica no Vercel Dashboard

**Project Settings → General → Root Directory:** deve estar **vazio** (padrão).  
Se estiver como `client`, a pasta `api/` fica invisível e as functions não compilam.

### Debug

Se algo não funcionar:

1. **Verificar se as env vars chegam:**
   ```
   https://israelita-pizzas-app.vercel.app/api/test-env
   ```

2. **Verificar logs do deploy:**
   Vercel Dashboard → Deployments → clicar no deployment → "Function Logs"

3. **Verificar se o Express está rodando:**
   ```
   https://israelita-pizzas-app.vercel.app/api/health
   ```

---

## Fluxo de Desenvolvimento

```bash
# 1. Fazer alterações no código
# 2. Testar localmente
npm run dev

# 3. Commitar e push (Vercel faz deploy automático)
git add -A
git commit -m "descrição do que mudou"
git push
```

> **Não precisa rodar `vercel deploy` manualmente** — o GitHub Actions do Vercel já faz isso.

---

## Arquivos Importantes

| Arquivo | Função |
|---------|--------|
| `server.js` | Todo o backend Express (rotas da API + Supabase) |
| `api/index.js` | Apenas `require('../server')` e exporta pro Vercel |
| `vercel.json` | Configuração de build, output e rewrites |
| `client/vite.config.js` | Config do Vite com proxy e output dir |
| `client/src/App.jsx` | TODO frontend (React) |
| `supabase-setup.sql` | Schema e seed do banco |
| `.env.example` | Template das variáveis de ambiente |

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
| POST | `/api/login` | Login admin (senha: `admin123`) |

> **Nota:** No código do Express, as rotas não têm o prefixo `/api` (ex: `app.get('/menu', ...)`). Um middleware de normalização cuida de adicionar/remover o prefixo conforme necessário pro Vercel.
