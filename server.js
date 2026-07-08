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
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage')

const VALID_ROLES = ['cliente', 'motoboy', 'atendente', 'financeiro', 'admin']

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'israelita-pizzas-jwt-secret-dev'

app.use(cors())
app.use(express.json())

// Normaliza a URL para funcionar no Vercel (que tira o /api) e localmente
app.use((req, res, next) => {
  if (req.url.startsWith('/api/') || req.url === '/api') {
    req.url = req.url.replace(/^\/api/, '') || '/'
  }
  next()
})

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

const { getAdapter, getPlatformInfo, getConfigDefaults } = setupMarketplaces()

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
  pendente: 'recusado',
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
      nome: nome || '', email, senha: hash, telefone: telefone || '', endereco: endereco || '', enderecos: enderecosIniciais, enderecoselecionado: endereco ? 'addr1' : null, role: 'cliente', status: 'ativo'
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome, role: data[0].role }, JWT_SECRET, { expiresIn: '7d' })
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
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
    if (error || !user) return res.status(401).json({ erro: 'Email ou senha inválidos' })
    const ok = await bcrypt.compare(senha, user.senha)
    if (!ok) return res.status(401).json({ erro: 'Email ou senha inválidos' })
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
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
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome, role: data[0].role }, JWT_SECRET, { expiresIn: '7d' })
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
    const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
    if (existing) {
      const token = jwt.sign({ id: existing.id, email: existing.email, nome: existing.nome, role: existing.role }, JWT_SECRET, { expiresIn: '7d' })
      return res.json({ token, user: { id: existing.id, nome: existing.nome, email: existing.email, telefone: existing.telefone, endereco: existing.endereco, enderecos: existing.enderecos, enderecoSelecionado: existing.enderecoselecionado, role: existing.role, status: existing.status } })
    }
    const { data: created, error } = await supabase.from('users').insert({
      nome: name || email.split('@')[0], email, senha: '', telefone: '', endereco: '', google_id: sub, role: 'cliente', status: 'ativo'
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: created[0].id, email: created[0].email, nome: created[0].nome, role: created[0].role }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: created[0].id, nome: created[0].nome, email: created[0].email, telefone: '', endereco: '', enderecos: [], enderecoSelecionado: null, role: created[0].role, status: created[0].status } })
  } catch (err) {
    console.error('Erro auth google:', err.message || err)
    res.status(500).json({ erro: err.message || 'Erro ao autenticar com Google' })
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
    const { data, error } = await supabase.from('users').select('id,nome,email,telefone,role,status,created_at').order('id')
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
    const { error } = await supabase.from('carts').upsert({ user_id: req.user.id, itens, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
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
    const { data, error } = await supabase.from('orders').select('*')
    if (error) throw error
    const orders = data || []
    res.json({
      totalPedidos: orders.length,
      totalReceita: orders.filter(o => o.status === 'entregue').reduce((s, o) => s + (o.total || 0), 0),
      pendentes: orders.filter(o => o.status === 'pendente').length,
      aceitos: orders.filter(o => o.status === 'aceito').length,
      entregues: orders.filter(o => o.status === 'entregue').length,
      recusados: orders.filter(o => o.status === 'recusado').length,
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
    const { data, error } = await supabase.from('orders').select('*').eq('id', parseInt(req.params.id)).single()
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
    const { data, error } = await supabase.from('menu').select('*').order('id')
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
    const { data, error } = await supabase.from('menu').insert(req.body).select()
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
    const { data, error } = await supabase.from('menu').update(req.body).eq('id', parseInt(req.params.id)).select()
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
    const { error } = await supabase.from('menu').delete().eq('id', parseInt(req.params.id))
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
    let { data, error } = await supabase.from('orders').select('*').order('id')
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
    const { data, error } = await supabase.from('orders').update(updates).eq('id', parseInt(req.params.id)).select()
    if (error) throw error
    if (!data || data.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado' })
    const order = data[0]
    if (order.status === 'entregador_proximo' && order.user_id) {
      sendPushNotification(order.user_id, 'Entregador chegou!', `Pedido #${order.id} - O entregador está próximo!`)
    }
    if (order.status === 'liberado') {
      sendPushToMotoboys('Novo pedido!', `Pedido #${order.id} saiu para entrega!`)
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

// Carrega configuração salva de todos os marketplaces (merge com defaults)
app.get('/config/marketplaces', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { data } = await supabase.from('app_config').select('valor').eq('chave', 'marketplaces').maybeSingle()
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

    const { data: currentData } = await supabase.from('app_config').select('valor').eq('chave', 'marketplaces').maybeSingle()
    const current = currentData?.valor || {}
    current[platform] = req.body

    const { data, error } = await supabase.from('app_config').upsert(
      { chave: 'marketplaces', valor: current, updated_at: new Date().toISOString() },
      { onConflict: 'chave' }
    ).select()
    if (error) throw error
    res.json({ ok: true, config: data?.[0]?.valor?.[platform] })
  } catch (err) {
    console.error('Erro ao salvar config marketplace:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Webhook genérico para qualquer marketplace registrado
app.post('/marketplace/:platform/webhook', async (req, res) => {
  if (!checkSupabase(res)) return res.status(500).json({ erro: 'Banco não configurado' })
  try {
    const { platform } = req.params
    const adapter = getAdapter(platform)
    if (!adapter) return res.status(404).json({ erro: 'Marketplace não encontrado' })

    const { data: configData } = await supabase.from('app_config').select('valor').eq('chave', 'marketplaces').maybeSingle()
    const allConfigs = configData?.valor || {}
    const config = allConfigs[platform] || {}

    if (!config.enabled) {
      return res.status(403).json({ erro: `Integração ${adapter.displayName} desabilitada` })
    }

    const { valid, eventType, rawPayload } = await adapter.validateWebhook(req, config)
    if (!valid) return res.status(401).json({ erro: 'Webhook inválido' })

    if (eventType === 'ORDER_CREATED') {
      const orderData = await adapter.toInternalOrder(rawPayload, config)
      const pedido = {
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
      console.log(`[${adapter.displayName} Webhook] Pedido #${data[0].id} importado (order: ${orderData.cliente.marketplace_order_id})`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Marketplace Webhook] Erro ao processar:', err)
    res.status(500).json({ erro: err.message || 'Erro interno' })
  }
})

// Configuração da pizzaria
app.get('/admin/config/pizzaria', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { data } = await supabase.from('app_config').select('valor').eq('chave', 'pizzaria').maybeSingle()
    res.json(data?.valor || {
      cnpj: '', nome_fantasia: 'Israelita Pizzas', razao_social: '', telefone: '',
      cep: '82840-080', rua: 'Rua Eloir Dide Maria', numero: '283',
      complemento: '', bairro: 'Tatuquara', cidade: 'Curitiba', estado: 'PR',
      lat: -25.590233, lng: -49.321738
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
  try {
    const { data, error } = await supabase.from('app_config').upsert(
      { chave: 'pizzaria', valor, updated_at: new Date().toISOString() },
      { onConflict: 'chave' }
    ).select()
    if (error) throw error
    res.json({ ok: true, config: data?.[0]?.valor })
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
          const token = jwt.sign({ id: data.id, email: data.email, nome: data.nome, role: data.role }, JWT_SECRET, { expiresIn: '7d' })
          return res.json({ autenticado: true, token, user: { ...data, enderecoSelecionado: data.enderecoselecionado } })
        }
      } catch (_) {}
    }
    const token = jwt.sign({ id: 0, email: 'admin@israelita', nome: 'Admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
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
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
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
    await supabase.from('app_config').upsert({ chave, valor: dados, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
  } catch (_) {}

  // Geofence: verificar se motoboy está a <100m de algum pedido atribuído a ele
  if (lat != null && lng != null) {
    try {
      const [ordersRes, configsRes] = await Promise.all([
        supabase.from('orders').select('id, entrega_lat, entrega_lng, status, user_id').in('status', ['em_rota']),
        supabase.from('app_config').select('chave, valor').like('chave', `pedido_motoboy_%`)
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
    await supabase.from('app_config').upsert({ chave, valor: dados, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
  } catch (_) {}
  res.json({ ok: true })
})

app.get('/motoboy/positions', async (req, res) => {
  try {
    const { data } = await supabase.from('app_config').select('chave, valor').like('chave', 'motoboy_pos_%')
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
    const [ordersRes, configsRes] = await Promise.all([
      supabase.from('orders').select('*').in('status', ['aceito', 'liberado']).order('id'),
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
    const { data: todos, error: findErr } = await supabase.from('orders').select('*').in('status', ['liberado'])
    if (findErr) return res.status(500).json({ erro: 'Erro ao buscar pedido' })
    // Verifica app_config se pedido já foi pego
    const { data: configs } = await supabase.from('app_config').select('chave, valor').like('chave', `pedido_motoboy_${idNum}`)
    const jaPego = configs && configs.length > 0 && configs[0].valor
    if (jaPego) return res.status(409).json({ erro: 'Pedido já está sendo atendido por outro entregador' })
    const current = (todos || []).find(o => o.id === idNum && o.status === 'liberado')
    if (!current) return res.status(404).json({ erro: 'Pedido não encontrado ou não está mais disponível' })
    // Salva atribuição no app_config (já que a coluna motoboy_nome não existe na tabela orders)
    await supabase.from('app_config').upsert({
      chave: `pedido_motoboy_${idNum}`,
      valor: { orderId: idNum, motoboy: nome, timestamp: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'chave' })
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
    const [ordersRes, configsRes] = await Promise.all([
      supabase.from('orders').select('*').in('status', ['liberado', 'em_rota', 'entregador_proximo', 'entregue', 'recusado']).order('id'),
      supabase.from('app_config').select('chave, valor').like('chave', 'pedido_motoboy_%')
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
    const { data } = await supabase.from('app_config').select('valor').eq('chave', 'fcm_tokens').maybeSingle()
    if (data?.valor) {
      fcmTokens = data.valor.userTokens || {}
      fcmMotoboyTokens = data.valor.motoboyTokens || []
    }
  } catch {}
}

async function salvarFcmTokens() {
  if (!supabase) return
  try {
    await supabase.from('app_config').upsert(
      { chave: 'fcm_tokens', valor: { userTokens: fcmTokens, motoboyTokens: fcmMotoboyTokens } },
      { onConflict: 'chave' }
    )
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
