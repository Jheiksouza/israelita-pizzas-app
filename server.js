const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'client/dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

// Suas rotas da API (mantenha o resto igual)
const MENU_FILE = path.join(__dirname, 'menu.json')
const ORDERS_FILE = path.join(__dirname, 'orders.json')

// ... (o resto do código que você tinha)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})