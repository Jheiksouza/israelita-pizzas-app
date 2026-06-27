const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'client/dist')))

// Rota para SPA (single page application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

const MENU_FILE = path.join(__dirname, 'menu.json')
const ORDERS_FILE = path.join(__dirname, 'orders.json')

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// Rotas da API
app.get('/api/menu', (req, res) => {
  const menu = readJSON(MENU_FILE)
  res.json(menu)
})

app.post('/api/menu', (req, res) => {
  const menu = readJSON(MENU_FILE)
  const maxId = menu.reduce((max, item) => Math.max(max, item.id), 0)
  const novo = { id: maxId + 1, ...req.body }
  menu.push(novo)
  writeJSON(MENU_FILE, menu)
  res.status(201).json(novo)
})

app.put('/api/menu/:id', (req, res) => {
  const menu = readJSON(MENU_FILE)
  const idx = menu.findIndex(i => i.id === parseInt(req.params.id))
  if (idx === -1) return res.status(404).json({ erro: 'Item não encontrado' })
  menu[idx] = { ...menu[idx], ...req.body, id: menu[idx].id }
  writeJSON(MENU_FILE, menu)
  res.json(menu[idx])
})

app.delete('/api/menu/:id', (req, res) => {
  let menu = readJSON(MENU_FILE)
  menu = menu.filter(i => i.id !== parseInt(req.params.id))
  writeJSON(MENU_FILE, menu)
  res.json({ ok: true })
})

app.get('/api/orders', (req, res) => {
  const orders = readJSON(ORDERS_FILE)
  res.json(orders)
})

app.post('/api/orders', (req, res) => {
  const orders = readJSON(ORDERS_FILE)
  const pedido = {
    id: orders.length + 1,
    data: new Date().toISOString(),
    status: 'pendente',
    updatedAt: new Date().toISOString(),
    ...req.body
  }
  orders.push(pedido)
  writeJSON(ORDERS_FILE, orders)
  res.status(201).json(pedido)
})

app.patch('/api/orders/:id', (req, res) => {
  const orders = readJSON(ORDERS_FILE)
  const idx = orders.findIndex(o => o.id === parseInt(req.params.id))
  if (idx === -1) return res.status(404).json({ erro: 'Pedido não encontrado' })
  orders[idx] = { ...orders[idx], ...req.body, id: orders[idx].id, updatedAt: new Date().toISOString() }
  writeJSON(ORDERS_FILE, orders)
  res.json(orders[idx])
})

app.get('/api/orders/stats', (req, res) => {
  const orders = readJSON(ORDERS_FILE)
  const totalPedidos = orders.length
  const totalReceita = orders.filter(o => o.status === 'entregue').reduce((s, o) => s + (o.total || 0), 0)
  const pendentes = orders.filter(o => o.status === 'pendente').length
  const aceitos = orders.filter(o => o.status === 'aceito').length
  const entregues = orders.filter(o => o.status === 'entregue').length
  const recusados = orders.filter(o => o.status === 'recusado').length
  const receitaPendente = orders.filter(o => o.status === 'aceito').reduce((s, o) => s + (o.total || 0), 0)
  res.json({ totalPedidos, totalReceita, pendentes, aceitos, entregues, recusados, receitaPendente })
})

app.post('/api/login', (req, res) => {
  const { senha } = req.body
  if (senha === 'admin123') {
    return res.json({ autenticado: true })
  }
  res.status(401).json({ autenticado: false, erro: 'Senha incorreta' })
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})