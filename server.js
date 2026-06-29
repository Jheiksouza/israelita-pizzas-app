const express = require('express')
const path = require('path')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { createClient } = require('@supabase/supabase-js')
const { OAuth2Client } = require('google-auth-library')

try { require('dotenv').config() } catch (e) { /* dotenv opcional */ }

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage')

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

function checkSupabase(res) {
  if (!supabase) {
    res.status(500).json({ erro: 'Banco de dados não configurado (SUPABASE_URL/KEY ausentes)' })
    return false
  }
  return true
}

app.use(authMiddleware)

// ===== AUTH =====
app.post('/auth/signup', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { nome, email, senha, telefone, endereco, endereco_lat, endereco_lng } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' })
    const { data: existente } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
    if (existente) return res.status(409).json({ erro: 'Email já cadastrado' })
    const hash = await bcrypt.hash(senha, 10)
    
    // Preparar endereços com lat/lng se fornecidos
    const enderecosIniciais = endereco ? [{ id: 'addr1', rua: endereco, lat: endereco_lat, lng: endereco_lng }] : []
    
    const { data, error } = await supabase.from('users').insert({
      nome: nome || '', email, senha: hash, telefone: telefone || '', endereco: endereco || '', enderecos: enderecosIniciais, enderecoselecionado: endereco ? 'addr1' : null
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: data[0].id, nome: data[0].nome, email: data[0].email, telefone: data[0].telefone, endereco: data[0].endereco, enderecos: data[0].enderecos, enderecoSelecionado: data[0].enderecoselecionado } })
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
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone, endereco: user.endereco, enderecos: user.enderecos, enderecoSelecionado: user.enderecoselecionado } })
  } catch (err) {
    console.error('Erro ao logar:', err)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

app.get('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não autenticado' })
  if (!checkSupabase(res)) return
  try {
    const { data, error } = await supabase.from('users').select('id,nome,email,telefone,endereco,enderecos,enderecoselecionado').eq('id', req.user.id).single()
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
    const token = jwt.sign({ id: data[0].id, email: data[0].email, nome: data[0].nome }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: data[0].id, nome: data[0].nome, email: data[0].email, telefone: data[0].telefone, endereco: data[0].endereco, enderecos: data[0].enderecos, enderecoSelecionado: data[0].enderecoselecionado } })
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
      const token = jwt.sign({ id: existing.id, email: existing.email, nome: existing.nome }, JWT_SECRET, { expiresIn: '7d' })
      return res.json({ token, user: { id: existing.id, nome: existing.nome, email: existing.email, telefone: existing.telefone, endereco: existing.endereco, enderecos: existing.enderecos, enderecoSelecionado: existing.enderecoselecionado } })
    }
    const { data: created, error } = await supabase.from('users').insert({
      nome: name || email.split('@')[0], email, senha: '', telefone: '', endereco: '', google_id: sub
    }).select()
    if (error) throw error
    const token = jwt.sign({ id: created[0].id, email: created[0].email, nome: created[0].nome }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: created[0].id, nome: created[0].nome, email: created[0].email, telefone: '', endereco: '', enderecos: [], enderecoSelecionado: null } })
  } catch (err) {
    console.error('Erro auth google:', err.message || err)
    res.status(500).json({ erro: err.message || 'Erro ao autenticar com Google' })
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
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('id', { ascending: false })
    if (error) throw error
    res.json(data || [])
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
      receitaPendente: orders.filter(o => o.status === 'aceito').reduce((s, o) => s + (o.total || 0), 0)
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
    const { data, error } = await supabase.from('orders').select('*').order('id')
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err)
    res.status(500).json({ erro: 'Erro ao buscar pedidos' })
  }
})

app.post('/orders', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { cliente, itens, total } = req.body
    if (!cliente || !itens) {
      return res.status(400).json({ erro: 'Dados incompletos: cliente e itens são obrigatórios' })
    }

    // Extrair lat/lng do cliente para colunas separadas (para queries geoespaciais futuras)
    const entrega_lat = cliente.lat || cliente.endereco_lat || null
    const entrega_lng = cliente.lng || cliente.endereco_lng || null

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
    res.json(data[0])
  } catch (err) {
    console.error('Erro ao atualizar pedido:', err)
    res.status(500).json({ erro: 'Erro ao atualizar pedido' })
  }
})

// Login
app.post('/login', (req, res) => {
  const { senha } = req.body
  if (senha === 'admin123') {
    return res.json({ autenticado: true })
  }
  res.status(401).json({ autenticado: false, erro: 'Senha incorreta' })
})

// Rastreio do motoboy (em memória)
let ultimaPosMotoboy = null

app.post('/motoboy/position', (req, res) => {
  const { lat, lng } = req.body
  if (lat == null || lng == null) return res.status(400).json({ erro: 'lat e lng obrigatórios' })
  ultimaPosMotoboy = { lat: parseFloat(lat), lng: parseFloat(lng), timestamp: Date.now() }
  res.json({ ok: true })
})

app.get('/motoboy/position', (req, res) => {
  res.json(ultimaPosMotoboy || { lat: null, lng: null, timestamp: null })
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
