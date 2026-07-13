const express = require('express')
const path = require('path')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { createClient } = require('@supabase/supabase-js')
const { OAuth2Client } = require('google-auth-library')

let fbApp = null
let fbMessaging = null
try {
  const admin = require('firebase-admin')
  fbMessaging = require('firebase-admin/messaging')
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccountJson) {
    fbApp = admin.initializeApp({ credential: admin.cert(JSON.parse(serviceAccountJson)) })
  } else {
    const fs = require('fs')
    const saPath = './notificacao-da-pizzaria-firebase-adminsdk-fbsvc-854d52358b.json'
    if (fs.existsSync(saPath)) {
      fbApp = admin.initializeApp({ credential: admin.cert(require(saPath)) })
    }
  }
} catch (e) {
  console.log('Firebase não disponível, notificações desabilitadas:', e.message)
}

try { require('dotenv').config() } catch (e) { /* dotenv opcional */ }

const setupMarketplaces = require('./marketplaces')

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

// Base URL para callbacks (muda entre Vercel e localhost)
const BASE_URL = process.env.VERCEL ? 'https://queropizza.com' : `http://localhost:${PORT}`

const VALID_ROLES = ['cliente', 'motoboy', 'atendente', 'financeiro', 'admin']

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'israelita-pizzas-jwt-secret-dev'

app.use(cors())
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf }
}))

// Normaliza a URL para funcionar no Vercel (que tira o /api) e localmente
app.use((req, res, next) => {
  if (req.url.startsWith('/api/') || req.url === '/api') {
    req.url = req.url.replace(/^\/api/, '') || '/'
  }
  next()
})

// ===== MULTI-TENANT: Store detection =====
// Detecta o slug do subdomínio (ex: israelita.queropizza.com → israelita)
// Em desenvolvimento, usa X-Store-Slug header ou fallback default
app.use(async (req, res, next) => {
  let slug = null
  const host = req.headers.host || ''
  const match = host.match(/^(.+)\.queropizza\.com(:\d+)?$/)
  if (match) {
    slug = match[1]
  } else if (req.headers['x-store-slug']) {
    slug = req.headers['x-store-slug']
  }
  if (slug && supabase) {
    try {
      const { data } = await supabase.from('stores').select('*').eq('slug', slug).maybeSingle()
      req.store = data || null
    } catch { req.store = null }
  } else {
    req.store = null
  }
  next()
})

// Helper: query builder com store_id scoped
function sb(table) {
  return (req) => {
    const storeId = req.store?.id
    const q = supabase.from(table)
    return storeId ? q.eq('store_id', storeId) : q
  }
}

function storeId(req) {
  if (req.store?.id) return req.store.id
  // Fallback: DEFAULT_STORE_ID do .env (usado em localhost / preview)
  const defaultId = parseInt(process.env.DEFAULT_STORE_ID)
  return isNaN(defaultId) ? null : defaultId
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

let supabase
try {
  supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null
} catch (e) {
  console.error('Erro ao criar cliente Supabase:', e)
}

const { getAdapter, getPlatformInfo, getConfigDefaults, getPlatformStatuses } = setupMarketplaces()

// Health check (pra testar se o Express está rodando no Vercel)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    }
  })
})

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null; return next()
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET)
  } catch (_) { req.user = null }
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ erro: 'Sem permissão' })
    next()
  }
}

function checkSupabase(res) {
  if (!supabase) {
    res.status(500).json({ erro: 'Banco de dados não configurado (SUPABASE_URL/KEY ausentes)' })
    return false
  }
  return true
}

app.use(authMiddleware)

// ===== AUTO-EXPIRAÇÃO DE PEDIDOS ANTIGOS =====
const EXPIRY_MS = {
  entregador_proximo: 3 * 60 * 60 * 1000,
  em_rota: 6 * 60 * 60 * 1000,
  liberado: 8 * 60 * 60 * 1000,
  aceito: 12 * 60 * 60 * 1000,
  pendente: 24 * 60 * 60 * 1000,
}
const FINAL_STATUS = {
  entregador_proximo: 'entregue',
  em_rota: 'entregue',
  liberado: 'entregue',
  aceito: 'entregue',
  pendente: 'cancelado',
}

async function autoExpireOrders(orders) {
  if (!orders || !orders.length) return orders
  const now = Date.now()
  const updates = []
  for (const order of orders) {
    const threshold = EXPIRY_MS[order.status]
    if (!threshold) continue
    const orderTime = new Date(order.updatedAt || order.data).getTime()
    if (isNaN(orderTime)) continue
    if (now - orderTime > threshold) {
      const newStatus = FINAL_STATUS[order.status]
      if (newStatus) {
        updates.push({ id: order.id, status: newStatus })
        order.status = newStatus
      }
    }
  }
  if (updates.length > 0) {
    await Promise.all(updates.map(u =>
      supabase.from('orders').update({ status: u.status, updatedAt: new Date().toISOString() }).eq('id', u.id)
    ))
  }
  return orders
}

// ===== AUTH =====
app.post('/auth/signup', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { nome, email, senha, telefone, endereco, endereco_lat, endereco_lng, enderecos } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' })
    const { data: existente } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
    if (existente) return res.status(409).json({ erro: 'Email já cadastrado' })
    const hash = await bcrypt.hash(senha, 10)
    
    // Usar enderecos estruturados do cliente se fornecidos
    const enderecosIniciais = Array.isArray(enderecos) && enderecos.length > 0
      ? enderecos
      : endereco ? [{ id: 'addr1', rua: endereco, lat: endereco_lat, lng: endereco_lng }] : []
    
    const { data, error } = await supabase.from('users').insert({
      store_id: storeId(req), nome: nome || '', email, senha: hash, telefone: telefone || '', endereco: endereco || '', enderecos: enderecosIniciais, enderecoselecionado: endereco ? 'addr1' : null, role: 'cliente', status: 'ativo'
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome, role: data[0].role, store_id: data[0].store_id }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: data[0].id, nome: data[0].nome, email: data[0].email, telefone: data[0].telefone, endereco: data[0].endereco, enderecos: data[0].enderecos, enderecoSelecionado: data[0].enderecoselecionado, role: data[0].role, status: data[0].status } })
  } catch (err) {
    console.error('Erro ao cadastrar:', err)
    res.status(500).json({ erro: 'Erro ao cadastrar' })
  }
})

app.post('/auth/login', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { email, senha } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' })
    let query = supabase.from('users').select('*').eq('email', email)
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data: user, error } = await query.maybeSingle()
    if (error || !user) return res.status(401).json({ erro: 'Email ou senha inválidos' })
    const ok = await bcrypt.compare(senha, user.senha)
    if (!ok) return res.status(401).json({ erro: 'Email ou senha inválidos' })
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome, role: user.role, store_id: user.store_id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone, endereco: user.endereco, enderecos: user.enderecos, enderecoSelecionado: user.enderecoselecionado, role: user.role, status: user.status } })
  } catch (err) {
    console.error('Erro ao logar:', err)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

app.get('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { data, error } = await supabase.from('users').select('id,nome,email,telefone,endereco,enderecos,enderecoselecionado,role,status').eq('id', req.user.id).single()
    if (error || !data) return res.status(404).json({ erro: 'Usuário não encontrado' })
    data.enderecoSelecionado = data.enderecoselecionado
    delete data.enderecoselecionado
    res.json(data)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuário' })
  }
})

app.patch('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { nome, telefone, endereco } = req.body
    const updates = {}
    if (nome !== undefined) updates.nome = nome
    if (telefone !== undefined) updates.telefone = telefone
    if (endereco !== undefined) { 
      updates.endereco = endereco
      const { data: current } = await supabase.from('users').select('enderecos').eq('id', req.user.id).single()
      if (!current?.enderecos || current.enderecos.length === 0) {
        updates.enderecos = [{ id: 'addr1', rua: endereco }]
        updates.enderecoselecionado = 'addr1'
      }
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' })
    const { data, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select()
    if (error) throw error
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome, role: data[0].role, store_id: data[0].store_id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: data[0].id, nome: data[0].nome, email: data[0].email, telefone: data[0].telefone, endereco: data[0].endereco, enderecos: data[0].enderecos, enderecoSelecionado: data[0].enderecoselecionado, role: data[0].role, status: data[0].status } })
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err)
    res.status(500).json({ erro: 'Erro ao atualizar dados' })
  }
})

app.patch('/auth/enderecos', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { enderecos, enderecoSelecionado } = req.body
    if (!Array.isArray(enderecos)) return res.status(400).json({ erro: 'enderecos deve ser um array' })
    const updates = { enderecos }
    if (enderecoSelecionado !== undefined) updates.enderecoselecionado = enderecoSelecionado
    const selecionado = enderecos.find(e => e.id === (enderecoSelecionado || undefined))
    if (selecionado) updates.endereco = selecionado.rua || ''
    const { data, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select()
    if (error) throw error
    res.json({ enderecos: data[0].enderecos, endereco: data[0].endereco, enderecoSelecionado: data[0].enderecoselecionado })
  } catch (err) {
    console.error('Erro ao atualizar endereços:', err.message, err.stack)
    res.status(500).json({ erro: err.message, stack: (err.stack || '').split('\n').slice(0, 3).join('|') })
  }
})

// Google OAuth — suporta dois fluxos:
// 1. POST /auth/google (backward compat, postmessage/implicit)
// 2. GET /auth/google/login → redirect → GET /auth/google/callback (server-side, funciona em qualquer subdomínio)
app.post('/auth/google', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { accessToken } = req.body
    if (!accessToken) return res.status(400).json({ erro: 'Token ausente' })
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!resp.ok) return res.status(401).json({ erro: 'Token inválido' })
    const payload = await resp.json()
    if (!payload || !payload.email) return res.status(401).json({ erro: 'Dados do usuário não encontrados' })
    const { email, name, id: sub } = payload
    let googleQuery = supabase.from('users').select('*').eq('email', email)
    if (storeId(req)) googleQuery = googleQuery.eq('store_id', storeId(req))
    const { data: existing } = await googleQuery.maybeSingle()
    if (existing) {
      const token = jwt.sign({ id: existing.id, email: existing.email, nome: existing.nome, role: existing.role, store_id: existing.store_id }, JWT_SECRET, { expiresIn: '7d' })
      return res.json({ token, user: { id: existing.id, nome: existing.nome, email: existing.email, telefone: existing.telefone, endereco: existing.endereco, enderecos: existing.enderecos, enderecoSelecionado: existing.enderecoselecionado, role: existing.role, status: existing.status } })
    }
    const { data: created, error } = await supabase.from('users').insert({
      store_id: storeId(req), nome: name || email.split('@')[0], email, senha: '', telefone: '', endereco: '', google_id: sub, role: 'cliente', status: 'ativo'
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: created[0].id, email: created[0].email, nome: created[0].nome, role: created[0].role, store_id: created[0].store_id }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: created[0].id, nome: created[0].nome, email: created[0].email, telefone: '', endereco: '', enderecos: [], enderecoSelecionado: null, role: created[0].role, status: created[0].status } })
  } catch (err) {
    console.error('Erro auth google:', err.message || err)
    res.status(500).json({ erro: err.message || 'Erro ao autenticar com Google' })
  }
})

// Google OAuth via redirect (server-side) — funciona em QUALQUER subdomínio sem configurar no Google Cloud
app.get('/auth/google/login', (req, res) => {
  const redirect = req.query.redirect || '/'
  const storeSlug = req.query.store || (req.store ? req.store.slug : '')
  const state = Buffer.from(JSON.stringify({ redirect, storeSlug })).toString('base64')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(`${BASE_URL}/api/auth/google/callback`)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=${encodeURIComponent(state)}`
  res.redirect(authUrl)
})

app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.status(400).send('Código ausente')
  // Recupera state
  let redirectTo = '/'
  let storeSlug = ''
  try {
    const parsed = JSON.parse(Buffer.from(state || '', 'base64').toString())
    redirectTo = parsed.redirect || '/'
    storeSlug = parsed.storeSlug || ''
  } catch {}
  try {
    // Troca code por tokens
    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: `${BASE_URL}/api/auth/google/callback`
    })
    // Extrai dados do usuário do id_token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload()
    if (!payload || !payload.email) return res.status(401).send('Email não encontrado')

    const { email, name, sub } = payload
    // Descobre store_id a partir do slug (ou fallback)
    let targetStoreId = storeId(req)
    if (!targetStoreId && storeSlug) {
      const { data: store } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle()
      if (store) targetStoreId = store.id
    }
    if (!targetStoreId) targetStoreId = 1 // fallback Israelita

    // Busca ou cria usuário na store
    const { data: existing } = await supabase.from('users').select('*').eq('email', email).eq('store_id', targetStoreId).maybeSingle()
    let user
    if (existing) {
      user = existing
    } else {
      const { data: created } = await supabase.from('users').insert({
        store_id: targetStoreId, nome: name || email.split('@')[0], email,
        senha: '', telefone: '', endereco: '', google_id: sub, role: 'cliente', status: 'ativo'
      }).select()
      if (created) user = created[0]
    }
    if (!user) return res.status(500).send('Erro ao criar usuário')

    const token = jwt.sign(
      { id: user.id, email: user.email, nome: user.nome, role: user.role, store_id: user.store_id },
      JWT_SECRET, { expiresIn: '7d' }
    )
    // Redireciona de volta com token na URL
    const baseUrl = storeSlug ? `https://${storeSlug}.queropizza.com` : ''
    const dest = baseUrl ? `${baseUrl}${redirectTo}` : redirectTo
    res.redirect(`${dest}${dest.includes('?') ? '&' : '?'}token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`)
  } catch (err) {
    console.error('Erro callback google:', err.message || err)
    res.status(500).send('Erro ao autenticar com Google')
  }
})

app.get('/auth/users', async (req, res) => {
  if (!checkSupabase(res)) return
  const authHeader = req.headers.authorization
  let isAdmin = false
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
      if (decoded.role === 'admin') isAdmin = true
    } catch (_) {}
  }
  if (!isAdmin && req.headers['x-admin-password'] !== 'admin123' && req.query.senha !== 'admin123') {
    return res.status(401).json({ erro: 'Não autorizado' })
  }
  try {
    let query = supabase.from('users').select('id,nome,email,telefone,role,status,created_at,store_id')
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query.order('id')
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Erro ao listar usuários:', err)
    res.status(500).json({ erro: 'Erro ao listar usuários' })
  }
})

app.patch('/auth/users/:id/role', async (req, res) => {
  if (!checkSupabase(res)) return
  const authHeader = req.headers.authorization
  let isAdmin = false
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
      if (decoded.role === 'admin') isAdmin = true
    } catch (_) {}
  }
  if (!isAdmin && req.headers['x-admin-password'] !== 'admin123' && req.query.senha !== 'admin123') {
    return res.status(401).json({ erro: 'Não autorizado' })
  }
  const { role, status } = req.body
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ erro: 'Role inválida' })
  const updates = {}
  if (role !== undefined) updates.role = role
  if (status !== undefined) updates.status = status
  if (Object.keys(updates).length === 0) return res.status(400).json({ erro: 'Nada para atualizar' })
  try {
    const { data, error } = await supabase.from('users').update(updates).eq('id', parseInt(req.params.id)).select()
    if (error) throw error
    if (!data || data.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' })
    res.json({ id: data[0].id, role: data[0].role, status: data[0].status, nome: data[0].nome, email: data[0].email })
  } catch (err) {
    console.error('Erro ao atualizar role:', err)
    res.status(500).json({ erro: 'Erro ao atualizar permissão' })
  }
})

app.get('/cart', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { data, error } = await supabase.from('carts').select('itens').eq('user_id', req.user.id).maybeSingle()
    if (error) throw error
    res.json(data ? data.itens : [])
  } catch (err) {
    console.error('Erro ao buscar carrinho:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar carrinho' })
  }
})

app.put('/cart', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { itens } = req.body
    if (!Array.isArray(itens)) return res.status(400).json({ erro: 'itens deve ser um array' })
    const { error } = await supabase.from('carts').upsert({ user_id: req.user.id, store_id: storeId(req), itens, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro ao salvar carrinho:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar carrinho' })
  }
})

app.get('/orders/mine', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    let { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('id', { ascending: false })
    if (error) throw error
    data = await autoExpireOrders(data || [])
    res.json(data)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' })
  }
})

app.get('/orders/stats', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('orders').select('*')
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query
    if (error) throw error
    const orders = data || []
    res.json({
      totalPedidos: orders.length,
      totalReceita: orders.filter(o => o.status === 'entregue').reduce((s, o) => s + (o.total || 0), 0),
      pendentes: orders.filter(o => o.status === 'pendente').length,
      aceitos: orders.filter(o => o.status === 'aceito').length,
      entregues: orders.filter(o => o.status === 'entregue').length,
      cancelados: orders.filter(o => o.status === 'cancelado').length,
      receitaPendente: orders.filter(o => o.status === 'aceito').reduce((s, o) => s + (o.total || 0), 0),
      proximos: orders.filter(o => o.status === 'entregador_proximo').length
    })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' })
  }
})

app.get('/orders/:id', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('orders').select('*').eq('id', parseInt(req.params.id))
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query.single()
    if (error || !data) return res.status(404).json({ erro: 'Pedido não encontrado' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedido' })
  }
})

// Cardápio
app.get('/menu', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('menu').select('*')
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query.order('id')
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Erro ao buscar menu:', err)
    res.status(500).json({ erro: 'Erro ao buscar cardápio' })
  }
})

app.post('/menu', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { data, error } = await supabase.from('menu').insert({ ...req.body, store_id: storeId(req) }).select()
    if (error) throw error
    res.status(201).json(data[0])
  } catch (err) {
    console.error('Erro ao criar item:', err)
    res.status(500).json({ erro: 'Erro ao criar item' })
  }
})

app.put('/menu/:id', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('menu').update(req.body).eq('id', parseInt(req.params.id))
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query.select()
    if (error) throw error
    if (!data || data.length === 0) return res.status(404).json({ erro: 'Item não encontrado' })
    res.json(data[0])
  } catch (err) {
    console.error('Erro ao atualizar item:', err)
    res.status(500).json({ erro: 'Erro ao atualizar item' })
  }
})

app.delete('/menu/:id', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('menu').delete().eq('id', parseInt(req.params.id))
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { error } = await query
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro ao deletar item:', err)
    res.status(500).json({ erro: 'Erro ao deletar item' })
  }
})

// Pedidos
app.get('/orders', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let query = supabase.from('orders').select('*')
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    let { data, error } = await query.order('id')
    if (error) throw error
    data = await autoExpireOrders(data || [])
    res.json(data)
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err)
    res.status(500).json({ erro: 'Erro ao buscar pedidos' })
  }
})

app.post('/orders', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { cliente, itens, total, entrega_lat: body_lat, entrega_lng: body_lng } = req.body
    if (!cliente || !itens) {
      return res.status(400).json({ erro: 'Dados incompletos: cliente e itens são obrigatórios' })
    }

    // Extrair lat/lng do cliente para colunas separadas (para queries geoespaciais futuras)
    const entrega_lat = body_lat || cliente.lat || cliente.endereco_lat || null
    const entrega_lng = body_lng || cliente.lng || cliente.endereco_lng || null

    const pedido = {
      store_id: storeId(req),
      data: new Date().toISOString(),
      status: 'pendente',
      updatedAt: new Date().toISOString(),
      cliente,
      itens,
      total,
      user_id: req.user ? req.user.id : null,
      entrega_lat,
      entrega_lng
    }

    const { data, error } = await supabase.from('orders').insert(pedido).select()
    if (error) throw error
    res.status(201).json(data[0])
  } catch (err) {
    console.error('Erro ao salvar pedido:', err)
    res.status(500).json({ erro: 'Erro interno ao salvar pedido' })
  }
})

app.patch('/orders/:id', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const updates = { ...req.body, updatedAt: new Date().toISOString() }
    let query = supabase.from('orders').update(updates).eq('id', parseInt(req.params.id))
    if (storeId(req)) query = query.eq('store_id', storeId(req))
    const { data, error } = await query.select()
    if (error) throw error
    if (!data || data.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado' })
    const order = data[0]
    if (order.status === 'entregador_proximo' && order.user_id) {
      sendPushNotification(order.user_id, 'Entregador chegou!', `Pedido #${order.id} - O entregador está próximo!`)
    }
    if (order.status === 'liberado') {
      sendPushToMotoboys('Novo pedido!', `Pedido #${order.id} saiu para entrega!`)
    }

    // Sincronizar status com marketplace de origem
    const origem = order.cliente?.origem
    if (origem && origem !== 'site') {
      const adapter = getAdapter(origem)
      if (adapter) {
        const { data: configData } = await supabase.from('app_config').select('valor').eq('chave', 'marketplaces').maybeSingle()
        const allConfigs = configData?.valor || {}
        const config = allConfigs[origem] || {}
        if (config.enabled) {
          const extId = order.cliente?.marketplace_order_id
          const statusMap = {
            'aceito': ['confirmed', 'preparation_started'],
            'liberado': ['dispatched'],
          }
          const mappedStatuses = statusMap[order.status]
          if (mappedStatuses && extId) {
            mappedStatuses.forEach(s => {
              adapter.updateOrderStatus(extId, s, config).catch(err =>
                console.error(`[${origem}] Erro ao atualizar status ${order.status} -> ${s}:`, err.message)
              )
            })
          }
          // Cancelamento: se cancelado, solicita cancelamento no iFood
          if (order.status === 'cancelado' && extId) {
            adapter.getCancellationReasons(extId, config).then(reasons => {
              const reason = (reasons?.reasons || []).find(r => r.code === '503') || { code: '503' }
              adapter.requestCancellation(extId, reason.code, config).catch(err =>
                console.error(`[${origem}] Erro ao cancelar pedido ${extId}:`, err.message)
              )
            }).catch(err => {
              console.error(`[${origem}] Erro ao obter motivos de cancelamento:`, err.message)
            })
          }
        }
      }
    }

    res.json(order)
  } catch (err) {
    console.error('Erro ao atualizar pedido:', err)
    res.status(500).json({ erro: 'Erro ao atualizar pedido' })
  }
})

// ===== MARKETPLACES CONFIG =====
// Informações dos adapters registrados (para o admin montar formulários)
app.get('/marketplaces/info', (req, res) => {
  res.json(getPlatformInfo())
})

// Status de cada marketplace (configurado, pendente, etc)
app.get('/marketplaces/status', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data } = await q.maybeSingle()
    res.json(getPlatformStatuses(data?.valor || {}))
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// Testa conexão com um marketplace específico
// Aceita config no body para testar valores do formulário antes de salvar
app.post('/marketplace/:platform/test', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { platform } = req.params
    const adapter = getAdapter(platform)
    if (!adapter) return res.status(404).json({ erro: 'Marketplace não encontrado' })

    // Usa config enviado no body (formulário); fallback pra DB se vazio
    let config = req.body
    if (!config || Object.keys(config).length === 0) {
      let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
      if (storeId(req)) q = q.eq('store_id', storeId(req))
      const { data: configData } = await q.maybeSingle()
      const allConfigs = configData?.valor || {}
      config = allConfigs[platform] || {}
    }

    const result = await adapter.testConnection(config)
    res.json(result)
  } catch (err) {
    console.error('[Marketplace Test] Erro:', err)
    res.status(500).json({ success: false, message: err.message || 'Erro ao testar conexão' })
  }
})

// Carrega configuração salva de todos os marketplaces (merge com defaults)
app.get('/config/marketplaces', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data } = await q.maybeSingle()
    const defaults = getConfigDefaults()
    const saved = data?.valor || {}
    const merged = {}
    for (const key of Object.keys(defaults)) {
      merged[key] = { ...defaults[key], ...(saved[key] || {}) }
    }
    for (const key of Object.keys(saved)) {
      if (!merged[key]) merged[key] = saved[key]
    }
    res.json(merged)
  } catch (err) {
    console.error('Erro ao ler config de marketplaces:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Salva configuração de um marketplace específico
app.put('/config/marketplaces/:platform', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { platform } = req.params
    const adapter = getAdapter(platform)
    if (!adapter) return res.status(404).json({ erro: 'Marketplace não encontrado' })

    let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data: currentData } = await q.maybeSingle()
    const current = currentData?.valor || {}
    current[platform] = req.body

    const sid = storeId(req)
    const { data: existing } = await supabase.from('app_config')
      .select('id').eq('chave', 'marketplaces')
      .eq('store_id', sid).maybeSingle()
    const payload = { store_id: sid, chave: 'marketplaces', valor: current, updated_at: new Date().toISOString() }
    let result
    if (existing) {
      result = await supabase.from('app_config').update(payload).eq('id', existing.id).select()
    } else {
      result = await supabase.from('app_config').insert(payload).select()
    }
    if (result.error) throw result.error
    const { data, error } = result
    if (error) throw error
    const novoValor = data?.[0]?.valor || {}
    const status = getPlatformStatuses(novoValor)
    res.json({ ok: true, config: novoValor[platform], status: status[platform] })
  } catch (err) {
    console.error('Erro ao salvar config marketplace:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Webhook genérico para qualquer marketplace registrado
// Log em memória dos últimos webhooks (útil pra debug)
const webhookLog = []
function addWebhookLog(platform, event) {
  webhookLog.unshift({ platform, ...event, timestamp: new Date().toISOString() })
  if (webhookLog.length > 50) webhookLog.pop()
}

// GET para teste de conectividade do webhook (iFood faz presença)
app.get('/marketplace/:platform/webhook', (req, res) => {
  const { platform } = req.params
  const adapter = getAdapter(platform)
  if (!adapter) return res.status(404).json({ error: 'Marketplace não encontrado' })
  addWebhookLog(platform, { type: 'GET_PRESENCE' })
  res.status(202).json({ received: true })
})

// Debug: ver os últimos webhooks recebidos
app.get('/marketplace/debug/log', (req, res) => {
  res.json(webhookLog)
})

app.post('/marketplace/:platform/webhook', async (req, res) => {
  if (!checkSupabase(res)) return res.status(500).json({ error: 'Banco não configurado' })
  try {
    const { platform } = req.params
    const adapter = getAdapter(platform)
    if (!adapter) return res.status(404).json({ error: 'Marketplace não encontrado' })

    let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data: configData } = await q.maybeSingle()
    const allConfigs = configData?.valor || {}
    const config = allConfigs[platform] || {}

    if (!config.enabled) {
      return res.status(403).json({ error: `Integração ${adapter.displayName} desabilitada` })
    }

    const { valid, eventType, rawPayload, parsedEvents } = await adapter.validateWebhook(req, config)

    if (rawPayload && (eventType === 'EVENTS' || eventType === 'PRESENCE')) {
      console.log(`[${platform}] 📨 Payload recebido do webhook:`, JSON.stringify(rawPayload, null, 2))
    }

    addWebhookLog(platform, {
      type: 'VALIDATE', valid, eventType, eventsCount: parsedEvents?.length || 0,
      bodyPreview: JSON.stringify(req.body).substring(0, 500),
      headers: JSON.stringify(Object.keys(req.headers).filter(h => h.startsWith('x-') || h === 'content-type' || h === 'content-length'))
    })

    if (!valid) return res.status(401).json({ error: 'Webhook inválido' })

    if (eventType === 'PRESENCE') {
      addWebhookLog(platform, { type: 'PRESENCE' })
      return res.status(202).json({ received: true })
    }

    if (eventType === 'EVENTS' && parsedEvents) {
      // KEEPALIVE / PRESENCE — responder 202 imediatamente (iFood espera isso)
      const isKeepalive = parsedEvents.some(e => e.code === 'KEEPALIVE' || e.code === 'PRESENCE')
      if (isKeepalive) {
        addWebhookLog(platform, { type: 'KEEPALIVE', events: parsedEvents.map(e => ({ id: e.id, code: e.code })) })
        const ids = parsedEvents.filter(e => e.id).map(e => e.id)
        if (ids.length > 0) adapter.acknowledgeEvents(ids, config).catch(() => {})
        return res.status(202).json({ received: true })
      }

      const eventosParaAck = []

      for (const event of parsedEvents) {
        addWebhookLog(platform, { type: 'EVENT', code: event.code, orderId: event.orderId, eventId: event.id })

        if (event.code === 'CONFIRMED' || event.code === 'PLACED') {
          try {
            let orderPayload = rawPayload

            if (event.orderId) {
              addWebhookLog(platform, { type: 'FETCH_ORDER', orderId: event.orderId })
              // Retry logic: PLACED pode chegar antes dos detalhes estarem disponíveis
              let orderData = null
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  orderData = await adapter.fetchOrderDetails(event.orderId, config)
                  break
                } catch (err) {
                  if (attempt < 2) {
                    const delay = Math.pow(2, attempt) * 2000
                    addWebhookLog(platform, { type: 'FETCH_RETRY', orderId: event.orderId, attempt: attempt + 1, delay })
                    await new Promise(r => setTimeout(r, delay))
                  } else {
                    addWebhookLog(platform, { type: 'FETCH_FAIL', orderId: event.orderId, error: err.message })
                  }
                }
              }
              orderPayload = orderData || event.metadata
              eventosParaAck.push(event.id)
              if (orderData) {
                addWebhookLog(platform, { type: 'FETCH_ORDER_DATA', orderId: event.orderId, preview: JSON.stringify(orderData).substring(0, 1000) })
              }
            }

            console.log(`[${platform}] 🔄 Convertendo orderPayload:`, JSON.stringify(orderPayload, null, 2))
            const orderData = await adapter.toInternalOrder(orderPayload, config)
            orderData.cliente.marketplace_order_id = event.orderId || orderData.cliente.marketplace_order_id

            const extId = orderData.cliente?.marketplace_order_id
            if (!extId) {
              addWebhookLog(platform, { type: 'SKIP_NO_ORDER_ID' })
              continue
            }

            const { data: existente } = await supabase
              .from('orders')
              .select('id')
              .filter('cliente->>marketplace_order_id', 'eq', extId)
              .maybeSingle()
            if (existente) {
              addWebhookLog(platform, { type: 'DUPLICATE', extId })
              continue
            }

            const pedido = {
              store_id: storeId(req),
              data: new Date().toISOString(),
              status: 'pendente',
              updatedAt: new Date().toISOString(),
              cliente: orderData.cliente,
              itens: orderData.itens,
              total: orderData.total,
              user_id: null,
              entrega_lat: orderData.entrega_lat,
              entrega_lng: orderData.entrega_lng
            }
            const { data, error } = await supabase.from('orders').insert(pedido).select()
            if (error) throw error
            addWebhookLog(platform, { type: 'IMPORTED', orderId: data[0].id, extId })
            console.log(`[ifood] Pedido #${data[0].id} importado: ${extId}`)
          } catch (err) {
            addWebhookLog(platform, { type: 'ERROR', eventId: event.id, error: err.message })
            console.error(`[ifood] Erro ao processar evento ${event.id}:`, err.message || err)
          }
        } else if (event.code === 'CONCLUDED') {
          // iFood marcou como concluído -> atualiza local
          if (event.orderId) {
            await supabase.from('orders').update({
              status: 'entregue',
              updatedAt: new Date().toISOString()
            }).filter('cliente->>marketplace_order_id', 'eq', event.orderId)
            addWebhookLog(platform, { type: 'STATUS_UPDATED', orderId: event.orderId, status: 'entregue' })
            eventosParaAck.push(event.id)
          }
        } else if (event.code === 'CANCELLED') {
          // iFood cancelou -> atualiza local
          if (event.orderId) {
            await supabase.from('orders').update({
              status: 'cancelado',
              updatedAt: new Date().toISOString()
            }).filter('cliente->>marketplace_order_id', 'eq', event.orderId)
            addWebhookLog(platform, { type: 'STATUS_UPDATED', orderId: event.orderId, status: 'cancelado' })
            eventosParaAck.push(event.id)
          }
        } else if (event.code === 'PRESENCE') {
          eventosParaAck.push(event.id)
        }
      }

      if (eventosParaAck.length > 0) {
        adapter.acknowledgeEvents(eventosParaAck, config).catch(() => {})
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Marketplace Webhook] Erro ao processar:', err)
    res.status(500).json({ error: err.message || 'Erro interno' })
  }
})

app.post('/marketplace/:platform/poll', async (req, res) => {
  if (!checkSupabase(res)) return res.status(500).json({ error: 'Banco não configurado' })
  try {
    const { platform } = req.params
    const adapter = getAdapter(platform)
    if (!adapter) return res.status(404).json({ error: 'Marketplace não encontrado' })
    if (!adapter.pollOrders) return res.status(400).json({ error: 'Polling não suportado' })

    let q = supabase.from('app_config').select('valor').eq('chave', 'marketplaces')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data: configData } = await q.maybeSingle()
    const allConfigs = configData?.valor || {}
    const config = allConfigs[platform] || {}
    if (!config.enabled) return res.status(403).json({ error: 'Integração desabilitada' })

    let events
    try {
      events = await adapter.pollOrders(config)
    } catch (err) {
      return res.status(400).json({ error: `API iFood retornou ${err.message}. O webhook é o método recomendado. Verifique se o Polling está habilitado no Portal iFood.` })
    }

    console.log(`[${platform}] 🔄 Eventos recebidos no polling:`, JSON.stringify(events, null, 2))

    const imported = []

    for (const event of events) {
      if (event.code === 'CONFIRMED' || event.code === 'PLACED') {
        try {
          const orderData = await adapter.fetchOrderDetails(event.orderId, config)
          console.log(`[${platform}] 🔄 Raw payload antes do toInternalOrder (polling):`, JSON.stringify(orderData, null, 2))
          const internal = await adapter.toInternalOrder(orderData, config)

          const { data: existente } = await supabase
            .from('orders')
            .select('id')
            .filter('cliente->>marketplace_order_id', 'eq', event.orderId)
            .maybeSingle()
          if (existente) continue

          const pedido = {
            store_id: storeId(req),
            data: new Date().toISOString(),
            status: 'pendente',
            updatedAt: new Date().toISOString(),
            cliente: { ...internal.cliente, marketplace_order_id: event.orderId },
            itens: internal.itens,
            total: internal.total,
            user_id: null,
            entrega_lat: internal.entrega_lat,
            entrega_lng: internal.entrega_lng
          }
          const { data } = await supabase.from('orders').insert(pedido).select()
          if (data) imported.push(data[0].id)
        } catch (err) {
          console.error(`[poll/${platform}] Erro evento ${event.id}:`, err.message)
        }
      }
    }

    if (events.length > 0) {
      const ids = events.map(e => e.id).filter(Boolean)
      adapter.acknowledgeEvents(ids, config).catch(() => {})
    }

    res.json({ importedCount: imported.length, imported, totalEvents: events.length })
  } catch (err) {
    console.error('[Marketplace Poll] Erro:', err)
    res.status(500).json({ error: err.message || 'Erro interno' })
  }
})

// Configuração da pizzaria (agora em stores.config)
app.get('/admin/config/pizzaria', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    if (req.store) {
      const { data } = await supabase.from('stores').select('config').eq('id', req.store.id).single()
      return res.json(data?.config || {})
    }
    // Fallback: sem store (localhost / preview)
    res.json({
      cnpj: '', nome_fantasia: 'Minha Pizzaria', razao_social: '', telefone: '',
      cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
      lat: -23.5505, lng: -46.6333
    })
  } catch (err) {
    console.error('Erro ao ler config:', err)
    res.status(500).json({ erro: err.message })
  }
})

app.put('/admin/config/pizzaria', async (req, res) => {
  if (!checkSupabase(res)) return
  const { senha, ...valor } = req.body
  if (senha !== 'admin123') return res.status(401).json({ erro: 'Não autorizado' })
  if (!req.store) return res.status(400).json({ erro: 'Store não identificada' })
  try {
    const { error } = await supabase.from('stores').update({ config: valor }).eq('id', req.store.id)
    if (error) throw error
    res.json({ ok: true, config: valor })
  } catch (err) {
    console.error('Erro ao salvar config:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Login
app.post('/login', async (req, res) => {
  const { senha, userId } = req.body
  if (senha === 'admin123') {
    if (userId && checkSupabase(res)) {
      try {
        const { data } = await supabase.from('users').select('id,nome,email,telefone,role,status,endereco,enderecos,enderecoselecionado').eq('id', parseInt(userId)).maybeSingle()
        if (data) {
          const token = jwt.sign({ id: data.id, email: data.email, nome: data.nome, role: data.role, store_id: data.store_id }, JWT_SECRET, { expiresIn: '7d' })
          return res.json({ autenticado: true, token, user: { ...data, enderecoSelecionado: data.enderecoselecionado } })
        }
      } catch (_) {}
    }
    const token = jwt.sign({ id: 0, email: 'admin@israelita', nome: 'Admin', role: 'admin', store_id: storeId(req) }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ autenticado: true, token, user: { nome: 'Admin', role: 'admin' } })
  }
  res.status(401).json({ autenticado: false, erro: 'Senha incorreta' })
})

// Login do motoboy
app.post('/motoboy/login', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { email, senha } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' })
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
    if (error || !user) return res.status(401).json({ erro: 'Entregador não encontrado' })
    if (user.role !== 'motoboy') return res.status(403).json({ erro: 'Conta não autorizada como entregador' })
    if (user.status !== 'ativo') return res.status(403).json({ erro: 'Conta desativada' })
    const ok = await bcrypt.compare(senha, user.senha)
    if (!ok) return res.status(401).json({ erro: 'Senha incorreta' })
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome, role: user.role, store_id: user.store_id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone, role: user.role, status: user.status } })
  } catch (err) {
    console.error('Erro ao logar motoboy:', err)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

// Rastreio dos motoboys (persistido no Supabase)
function sanitizarChave(nome) {
  return 'motoboy_pos_' + nome.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 40)
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

app.post('/motoboy/position', async (req, res) => {
  const { lat, lng, nome } = req.body
  const nomeMotoboy = nome || 'Motoboy'
  const dados = {
    online: true, lat: lat != null ? parseFloat(lat) : null, lng: lng != null ? parseFloat(lng) : null,
    timestamp: new Date().toISOString(), nome: nomeMotoboy
  }
  try {
    const chave = sanitizarChave(nomeMotoboy)
    const sid = storeId(req)
    const { data: posExist } = await supabase.from('app_config').select('id').eq('chave', chave).eq('store_id', sid).maybeSingle()
    const payload = { store_id: sid, chave, valor: dados, updated_at: new Date().toISOString() }
    if (posExist) {
      await supabase.from('app_config').update(payload).eq('id', posExist.id)
    } else {
      await supabase.from('app_config').insert(payload)
    }
  } catch (_) {}

  // Geofence: verificar se motoboy está a <100m de algum pedido atribuído a ele
    if (lat != null && lng != null) {
    try {
      let geofenceQuery = supabase.from('orders').select('id, entrega_lat, entrega_lng, status, user_id').in('status', ['em_rota'])
      if (storeId(req)) geofenceQuery = geofenceQuery.eq('store_id', storeId(req))
      let pedidoConfigQuery = supabase.from('app_config').select('chave, valor').like('chave', `pedido_motoboy_%`)
      if (storeId(req)) pedidoConfigQuery = pedidoConfigQuery.eq('store_id', storeId(req))
      const [ordersRes, configsRes] = await Promise.all([
        supabase.from('orders').select('id, entrega_lat, entrega_lng, status, user_id').in('status', ['em_rota']),
        pedidoConfigQuery
      ])
      if (ordersRes.data && configsRes.data) {
        const meusIds = configsRes.data.filter(c => c.valor?.motoboy === nomeMotoboy).map(c => c.valor.orderId)
        const filtrados = ordersRes.data.filter(p => meusIds.includes(p.id))
        for (const pedido of filtrados) {
          const destLat = parseFloat(pedido.entrega_lat)
          const destLng = parseFloat(pedido.entrega_lng)
          if (isNaN(destLat) || isNaN(destLng)) continue
          const dist = haversine(parseFloat(lat), parseFloat(lng), destLat, destLng)
          if (dist < 100) {
            await supabase.from('orders').update({ status: 'entregador_proximo', updatedAt: new Date().toISOString() }).eq('id', pedido.id)
            if (pedido.user_id) {
              sendPushNotification(pedido.user_id, 'Entregador chegou!', `Pedido #${pedido.id} - O entregador está próximo!`)
            }
          }
        }
      }
    } catch (_) {}
  }

  res.json({ ok: true })
})

app.post('/motoboy/offline', async (req, res) => {
  const nomeMotoboy = req.body?.nome || 'Motoboy'
  const dados = { online: false, lat: null, lng: null, timestamp: new Date().toISOString(), nome: nomeMotoboy }
  try {
    const chave = sanitizarChave(nomeMotoboy)
    const sid = storeId(req)
    const { data: posExist } = await supabase.from('app_config').select('id').eq('chave', chave).eq('store_id', sid).maybeSingle()
    const payload = { store_id: sid, chave, valor: dados, updated_at: new Date().toISOString() }
    if (posExist) {
      await supabase.from('app_config').update(payload).eq('id', posExist.id)
    } else {
      await supabase.from('app_config').insert(payload)
    }
  } catch (_) {}
  res.json({ ok: true })
})

app.get('/motoboy/positions', async (req, res) => {
  try {
    let q = supabase.from('app_config').select('chave, valor').like('chave', 'motoboy_pos_%')
    if (storeId(req)) q = q.eq('store_id', storeId(req))
    const { data } = await q
    if (data) {
      const motoboys = data.map(r => r.valor).filter(Boolean)
      return res.json(motoboys)
    }
  } catch (_) {}
  res.json([])
})

// Pedidos disponíveis para o motoboy pegar (liberado sem dono)
app.get('/motoboy/pedidos-disponiveis', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    let ordersQuery = supabase.from('orders').select('*').in('status', ['aceito', 'liberado'])
    if (storeId(req)) ordersQuery = ordersQuery.eq('store_id', storeId(req))
    const [ordersRes, configsRes] = await Promise.all([
      ordersQuery.order('id'),
      supabase.from('app_config').select('chave, valor').like('chave', 'pedido_motoboy_%')
    ])
    if (ordersRes.error) throw ordersRes.error
    const pedidosPegos = new Set()
    if (configsRes.data) {
      configsRes.data.forEach(c => {
        const id = parseInt(c.chave.replace('pedido_motoboy_', ''))
        if (!isNaN(id)) pedidosPegos.add(id)
      })
    }
    const disponiveis = (ordersRes.data || []).filter(p => !pedidosPegos.has(p.id))
    res.json(disponiveis)
  } catch (err) {
    console.error('Erro pedidos-disponiveis:', err)
    res.status(500).json({ erro: 'Erro ao buscar pedidos' })
  }
})

// Motoboy pegar pedido (endpoint dedicado em vez de PATCH)
app.post('/motoboy/pegar-pedido', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { pedidoId, nome } = req.body
    if (pedidoId == null || !nome) return res.status(400).json({ erro: 'pedidoId e nome obrigatórios' })
    const idNum = Number(pedidoId)
    if (!Number.isFinite(idNum)) return res.status(400).json({ erro: 'ID inválido' })
    // Busca todos os orders liberados e filtra em memoria (evita problemas com coluna)
    let findQuery = supabase.from('orders').select('*').in('status', ['liberado'])
    if (storeId(req)) findQuery = findQuery.eq('store_id', storeId(req))
    const { data: todos, error: findErr } = await findQuery
    if (findErr) return res.status(500).json({ erro: 'Erro ao buscar pedido' })
    // Verifica app_config se pedido já foi pego
    let pegarQuery = supabase.from('app_config').select('chave, valor').like('chave', `pedido_motoboy_${idNum}`)
    if (storeId(req)) pegarQuery = pegarQuery.eq('store_id', storeId(req))
    const { data: configs } = await pegarQuery
    const jaPego = configs && configs.length > 0 && configs[0].valor
    if (jaPego) return res.status(409).json({ erro: 'Pedido já está sendo atendido por outro entregador' })
    const current = (todos || []).find(o => o.id === idNum && o.status === 'liberado')
    if (!current) return res.status(404).json({ erro: 'Pedido não encontrado ou não está mais disponível' })
    // Salva atribuição no app_config (já que a coluna motoboy_nome não existe na tabela orders)
    const sid = storeId(req)
    // Upsert manual (app_config tem unique index composto)
    const { data: existente } = await supabase.from('app_config').select('id').eq('chave', `pedido_motoboy_${idNum}`).eq('store_id', sid).maybeSingle()
    const payload = { store_id: sid, chave: `pedido_motoboy_${idNum}`, valor: { orderId: idNum, motoboy: nome, timestamp: new Date().toISOString() }, updated_at: new Date().toISOString() }
    if (existente) {
      await supabase.from('app_config').update(payload).eq('id', existente.id)
    } else {
      await supabase.from('app_config').insert(payload)
    }
    res.json({ ok: true, id: idNum, motoboy: nome })
  } catch (err) {
    console.error('Erro ao pegar pedido:', err)
    res.status(500).json({ erro: 'Erro ao pegar pedido' })
  }
})

// Pedidos do motoboy autenticado
app.get('/motoboy/pedidos', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    let ordersQuery = supabase.from('orders').select('*').in('status', ['liberado', 'em_rota', 'entregador_proximo', 'entregue', 'cancelado'])
    if (storeId(req)) ordersQuery = ordersQuery.eq('store_id', storeId(req))
    let motoConfQuery = supabase.from('app_config').select('chave, valor').like('chave', 'pedido_motoboy_%')
    if (storeId(req)) motoConfQuery = motoConfQuery.eq('store_id', storeId(req))
    const [ordersRes, configsRes] = await Promise.all([
      ordersQuery.order('id'),
      motoConfQuery
    ])
    if (ordersRes.error) throw ordersRes.error
    const configs = configsRes.data || []
    const meusIds = configs.filter(c => c.valor?.motoboy === req.user.nome).map(c => c.valor.orderId)
    const meus = (ordersRes.data || []).filter(p => meusIds.includes(p.id))
    res.json(meus)
  } catch (err) {
    console.error('Erro pedidos motoboy:', err)
    res.status(500).json({ erro: 'Erro ao buscar pedidos' })
  }
})

// FCM tokens (persistidos no Supabase para funcionar em serverless)
let fcmTokens = {}
let fcmMotoboyTokens = []

async function carregarFcmTokens() {
  if (!supabase) return
  try {
    const { data } = await supabase.from('app_config').select('valor').eq('chave', 'fcm_tokens').is('store_id', null).maybeSingle()
    if (data?.valor) {
      fcmTokens = data.valor.userTokens || {}
      fcmMotoboyTokens = data.valor.motoboyTokens || []
    }
  } catch {}
}

async function salvarFcmTokens() {
  if (!supabase) return
  try {
    const { data: fcmExist } = await supabase.from('app_config').select('id').eq('chave', 'fcm_tokens').is('store_id', null).maybeSingle()
    const payload = { store_id: null, chave: 'fcm_tokens', valor: { userTokens: fcmTokens, motoboyTokens: fcmMotoboyTokens } }
    if (fcmExist) {
      await supabase.from('app_config').update(payload).eq('id', fcmExist.id)
    } else {
      await supabase.from('app_config').insert(payload)
    }
  } catch {}
}

// Carrega tokens no primeiro request
let tokensCarregados = false

app.post('/fcm/token', async (req, res) => {
  if (!checkSupabase(res)) return
  if (!tokensCarregados) { await carregarFcmTokens(); tokensCarregados = true }
  const { token, userId, role } = req.body
  if (!token || !userId) return res.status(400).json({ erro: 'token e userId obrigatórios' })
  if (!fcmTokens[userId]) fcmTokens[userId] = []
  if (!fcmTokens[userId].includes(token)) fcmTokens[userId].push(token)
  if (role === 'motoboy' && !fcmMotoboyTokens.includes(token)) fcmMotoboyTokens.push(token)
  salvarFcmTokens() // não espera, fire-and-forget
  res.json({ ok: true })
})

async function sendPushNotification(userId, title, body) {
  if (!fbApp || !fbMessaging) return
  if (!tokensCarregados) await carregarFcmTokens()
  const tokens = fcmTokens[userId]
  if (!tokens || tokens.length === 0) return
  try {
    await fbMessaging.getMessaging(fbApp).sendEachForMulticast({ tokens, data: { title, body } })
  } catch (err) {
    console.error('FCM send error:', err)
  }
}

async function sendPushToMotoboys(title, body) {
  if (!fbApp || !fbMessaging) return
  if (!tokensCarregados) await carregarFcmTokens()
  if (fcmMotoboyTokens.length === 0) return
  try {
    await fbMessaging.getMessaging(fbApp).sendEachForMulticast({ tokens: fcmMotoboyTokens, data: { title, body } })
  } catch (err) {
    console.error('FCM send to motoboys error:', err)
  }
}

// ===== STORE CREATION (multi-tenant signup) =====
app.post('/stores', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { slug, nome, adminNome, adminEmail, adminSenha } = req.body
    if (!slug || !nome || !adminNome || !adminEmail || !adminSenha) {
      return res.status(400).json({ erro: 'slug, nome, adminNome, adminEmail e adminSenha são obrigatórios' })
    }
    const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!slugLimpo || slugLimpo.length < 3) return res.status(400).json({ erro: 'Slug inválido (mínimo 3 caracteres, apenas letras e números)' })

    // Verifica se slug já existe
    const { data: existente } = await supabase.from('stores').select('id').eq('slug', slugLimpo).maybeSingle()
    if (existente) return res.status(409).json({ erro: 'Este slug já está em uso' })

    // Hash da senha do admin
    const hash = await bcrypt.hash(adminSenha, 10)

    // Cria store + admin user em transação
    const { data: store, error: storeErr } = await supabase.from('stores').insert({
      slug: slugLimpo, nome, config: {}
    }).select()
    if (storeErr) throw storeErr

    const { data: admin, error: userErr } = await supabase.from('users').insert({
      store_id: store[0].id, nome: adminNome, email: adminEmail, senha: hash,
      role: 'admin', status: 'ativo'
    }).select()
    if (userErr) {
      // Rollback: deleta a store criada
      await supabase.from('stores').delete().eq('id', store[0].id)
      throw userErr
    }

    // Atualiza owner_id da store
    await supabase.from('stores').update({ owner_id: admin[0].id }).eq('id', store[0].id)

    const token = jwt.sign({ id: admin[0].id, email: admin[0].email, nome: admin[0].nome, role: 'admin', store_id: store[0].id }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({
      token, store: store[0],
      user: { id: admin[0].id, nome: admin[0].nome, email: admin[0].email, role: 'admin' },
      urls: { site: `https://${slugLimpo}.queropizza.com`, admin: `https://${slugLimpo}.queropizza.com/admin`, motoboy: `https://${slugLimpo}.queropizza.com/motoboy` }
    })
  } catch (err) {
    console.error('Erro ao criar loja:', err)
    res.status(500).json({ erro: err.message || 'Erro ao criar loja' })
  }
})

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    hasSupabase: !!supabase,
    hasFirebase: !!fbApp,
    vercel: !!process.env.VERCEL,
    node: process.version,
    envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('TOKEN'))
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err?.message || err, err?.stack?.split('\n').slice(0, 3).join('\n'))
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

// Servir frontend buildado (apenas local; no Vercel quem serve é o próprio Vercel)
if (!process.env.VERCEL) {
  const distDir = path.resolve(__dirname, 'dist')
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

module.exports = app

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`)
  })
}
