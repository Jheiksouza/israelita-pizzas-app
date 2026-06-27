const express = require('express')
const path = require('path')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

try { require('dotenv').config() } catch (e) { /* dotenv opcional */ }

const app = express()
const PORT = process.env.PORT || 3001

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

function checkSupabase(res) {
  if (!supabase) {
    res.status(500).json({ erro: 'Banco de dados não configurado (SUPABASE_URL/KEY ausentes)' })
    return false
  }
  return true
}

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

    const pedido = {
      data: new Date().toISOString(),
      status: 'pendente',
      updatedAt: new Date().toISOString(),
      cliente,
      itens,
      total
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

app.get('/orders/stats', async (req, res) => {
  if (!checkSupabase(res)) return
  try {
    const { data, error } = await supabase.from('orders').select('*')
    if (error) throw error

    const orders = data || []
    const totalPedidos = orders.length
    const totalReceita = orders.filter(o => o.status === 'entregue').reduce((s, o) => s + (o.total || 0), 0)
    const pendentes = orders.filter(o => o.status === 'pendente').length
    const aceitos = orders.filter(o => o.status === 'aceito').length
    const entregues = orders.filter(o => o.status === 'entregue').length
    const recusados = orders.filter(o => o.status === 'recusado').length
    const receitaPendente = orders.filter(o => o.status === 'aceito').reduce((s, o) => s + (o.total || 0), 0)

    res.json({ totalPedidos, totalReceita, pendentes, aceitos, entregues, recusados, receitaPendente })
  } catch (err) {
    console.error('Erro ao buscar stats:', err)
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' })
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

// Servir frontend buildado
const distDir = path.resolve(__dirname, 'client', 'dist')
app.use(express.static(distDir))
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

module.exports = app

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`)
  })
}
