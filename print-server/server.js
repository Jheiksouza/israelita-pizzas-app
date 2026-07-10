const express = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const iconv = require('iconv-lite')

const PORT = 13001
let printerName = 'POS-80'
const API_URL = process.env.API_URL || 'http://localhost:3001'
let httpServer = null
let serverRunning = false

const DEFAULT_CONFIG = {
  nome_fantasia: process.env.NOME_FANTASIA || 'Israelita Pizzas',
  telefone: process.env.TEL_CONFIG || '',
  cnpj: process.env.CNPJ_CONFIG || '',
  rua: process.env.RUA_CONFIG || '',
  numero: process.env.NUMERO_CONFIG || '',
  bairro: process.env.BAIRRO_CONFIG || '',
  cidade: process.env.CIDADE_CONFIG || '',
  estado: process.env.ESTADO_CONFIG || '',
}

let config = { ...DEFAULT_CONFIG }

async function fetchConfig() {
  try {
    const res = await fetch(`${API_URL}/admin/config/pizzaria`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      config = { ...DEFAULT_CONFIG, ...data }
    }
  } catch {}
}

function setPrinterName(name) {
  printerName = name
}

function getPrinterName() {
  return printerName
}

function getPort() {
  return actualPort
}

function getServerStatus() {
  return serverRunning ? `Rodando (porta ${PORT})` : 'Parado'
}

let exePathOverride = null

function setExePath(p) {
  exePathOverride = p
}

function getExePath() {
  if (exePathOverride && fs.existsSync(exePathOverride)) return exePathOverride

  const isElectron = !!process.versions.electron
  if (isElectron && process.resourcesPath) {
    const p = path.join(process.resourcesPath, 'RawPrinter.exe')
    if (fs.existsSync(p)) return p
  }

  const local = path.join(__dirname, 'RawPrinter.exe')
  if (fs.existsSync(local)) return local

  const storePath = path.join(__dirname, 'store.json')
  try {
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      if (store.customExePath) {
        const custom = path.join(store.customExePath, 'RawPrinter.exe')
        if (fs.existsSync(custom)) return custom
      }
    }
  } catch {}
  return path.join(__dirname, 'RawPrinter.exe')
}

function cp850(str) {
  return iconv.encode(str, 'Windows-1252')
}

function formatEnderecoCompleto(cfg) {
  if (!cfg) return ''
  const partes = []
  if (cfg.rua) partes.push(`${cfg.rua}${cfg.numero ? ', ' + cfg.numero : ''}`)
  if (cfg.bairro) partes.push(cfg.bairro)
  if (cfg.cidade) partes.push(`${cfg.cidade}${cfg.estado ? ' - ' + cfg.estado : ''}`)
  return partes.join(', ')
}

function formatData(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch { return iso }
}

function gerarBytes(pedido) {
  const c = pedido.cliente || {}
  const partes = []

  function esc(...args) { partes.push(Buffer.from(args)) }
  function txt(str) { partes.push(cp850(str)) }

  const SEP = ''.padEnd(48, '-')
  const nomeFantasia = config.nome_fantasia || 'Pizzaria'
  const enderecoCompleto = config ? formatEnderecoCompleto(config) : ''
  const telefoneConfig = config.telefone || ''
  const cnpj = config.cnpj || ''

  esc(0x1B, 0x40)
  esc(0x1B, 0x74, 0x10)
  esc(0x1B, 0x32)
  esc(0x1B, 0x33, 0x2C)
  esc(0x1B, 0x64, 0x02)
  esc(0x1B, 0x61, 0x01)
  esc(0x1B, 0x21, 0x30)
  txt(nomeFantasia + '\n')
  esc(0x1B, 0x21, 0x00)
  if (enderecoCompleto) txt(enderecoCompleto + '\n')
  if (telefoneConfig) txt(`Tel: ${telefoneConfig}\n`)
  if (cnpj) txt(`CNPJ: ${cnpj}\n`)
  esc(0x1B, 0x61, 0x00)
  txt(SEP + '\n')
  esc(0x1B, 0x61, 0x01)
  esc(0x1B, 0x21, 0x30)
  txt(`PEDIDO #${pedido.id}\n`)
  esc(0x1B, 0x21, 0x00)
  esc(0x1B, 0x61, 0x00)

  if (pedido.data) txt(`${formatData(pedido.data)}\n`)

  txt(SEP + '\n')
  txt(`Cliente: ${c.nome || ''}\n`)
  if (c.telefone) txt(`Tel: ${c.telefone}\n`)
  if (c.cpf) txt(`CPF: ${c.cpf}\n`)
  if (c.origem) txt(`Origem: ${c.origem}\n`)
  if (c.marketplace_order_id) txt(`ID externo: ${c.marketplace_order_id}\n`)
  if (c.metodo_entrega) txt(`Entrega: ${c.metodo_entrega === 'MERCHANT' ? 'Propria' : c.metodo_entrega}\n`)
  if (c.endereco) txt(`End: ${c.endereco}\n`)
  txt(SEP + '\n')
  esc(0x1B, 0x45, 0x01)
  txt('ITENS\n')
  esc(0x1B, 0x45, 0x00)
  if (pedido.itens) {
    for (const item of pedido.itens) {
      let l = `${item.qtd}x ${item.nome}`
      if (item.tamanho) l += ` (${item.tamanho})`
      if (item.sabores && item.sabores.length) l += ` [${item.sabores.join(', ')}]`
      const preco = item.preco || item.valor_unitario || 0
      if (preco) l += `  R$${(preco * item.qtd).toFixed(2)}`
      txt(l + '\n')
    }
  }
  txt(SEP + '\n')
  esc(0x1B, 0x45, 0x01)
  txt(`TOTAL: R$${(pedido.total || 0).toFixed(2)}\n`)
  esc(0x1B, 0x45, 0x00)
  if (c.pagamento && c.pagamento.length > 0) {
    txt(SEP + '\n')
    for (const p of c.pagamento) {
      let linha = `${p.metodo} R$${(p.valor || 0).toFixed(2)}`
      if (p.bandeira) linha += ` (${p.bandeira})`
      if (p.prepago) linha += ' [PAGO]'
      if (p.troco) linha += ` Troco: R$${p.troco.toFixed(2)}`
      txt(linha + '\n')
    }
  }
  if (c.observacoes) {
    txt(SEP + '\n')
    esc(0x1B, 0x45, 0x01)
    esc(0x1B, 0x2D, 0x01)
    txt('OBSERVACOES:\n')
    esc(0x1B, 0x2D, 0x00)
    esc(0x1B, 0x45, 0x00)
    txt(c.observacoes + '\n')
  }
  if (c.codigo_coleta) txt(`Coleta: ${c.codigo_coleta}\n`)
  txt('\n\n')
  esc(0x1B, 0x64, 0x05)
  esc(0x1D, 0x56, 0x01)

  return Buffer.concat(partes)
}

function enviarParaImpressora(data, pedidoId, res) {
  const tmpFile = path.join(os.tmpdir(), `_print_${Date.now()}.bin`)
  fs.writeFileSync(tmpFile, data)

  const exe = getExePath()
  const cmd = `"${exe}" "${tmpFile}" "${printerName}"`

  exec(cmd, { timeout: 20000 }, (err, stdout, stderr) => {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
    const out = (stdout || '').trim()
    if (err) {
      if (res) return res.status(500).json({ error: (stderr || err.message).trim() })
      console.error('Print error:', (stderr || err.message).trim())
      return
    }
    if (res) res.json({ ok: true, pedido: pedidoId })
  })
}

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.post('/print', (req, res) => {
  try {
    const pedido = req.body
    if (!pedido?.id) return res.status(400).json({ error: 'pedido.id required' })
    const data = gerarBytes(pedido)
    enviarParaImpressora(data, pedido.id, res)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/test', (req, res) => {
  try {
    const data = gerarBytes({
      id: 'TESTE',
      data: new Date().toISOString(),
      total: 49.90,
      itens: [
        { qtd: 2, nome: 'Calabresa', preco: 24.95, tamanho: 'Grande', sabores: ['Calabresa', 'Mussarela'] },
        { qtd: 1, nome: 'Refrigerante 2L', preco: 8.00 },
      ],
      cliente: {
        nome: 'Cliente Teste',
        telefone: '(27) 99999-8888',
        endereco: 'Rua Teste, 123, Centro, Vila Velha - ES',
        cpf: '123.456.789-00',
        origem: 'site',
        metodo_entrega: 'MERCHANT',
        pagamento: [{ metodo: 'DINHEIRO', valor: 49.90, troco: 57.90 }],
        observacoes: 'Sem cebola',
        codigo_coleta: 'A123',
      },
    })
    enviarParaImpressora(data, 'TESTE', res)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/status', (req, res) => {
  res.json({ ok: true, printerName })
})

let actualPort = PORT

function startServer(callback) {
  if (httpServer) return
  const tryPort = (port) => {
    httpServer = app.listen(port, () => {
      actualPort = port
      serverRunning = true
      console.log(`Print server rodando em http://localhost:${port}`)
      if (callback) callback(null, port)
    })
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < PORT + 10) {
        console.log(`Porta ${port} ocupada, tentando ${port + 1}`)
        tryPort(port + 1)
      } else {
        console.error('Erro ao iniciar servidor:', err.message)
        if (callback) callback(err)
      }
    })
  }
  tryPort(PORT)
  fetchConfig()
  setInterval(fetchConfig, 60000)
}

function stopServer(callback) {
  if (!httpServer) return
  httpServer.close(() => {
    serverRunning = false
    httpServer = null
    if (callback) callback()
  })
}

// Auto-start when run directly with node server.js
if (require.main === module) {
  fetchConfig()
  startServer(() => {
    console.log(`Print server rodando em http://localhost:${PORT}`)
    console.log(`Impressora: ${printerName}`)
  })
}

module.exports = {
  startServer,
  stopServer,
  setPrinterName,
  getPrinterName,
  getPort,
  getServerStatus,
  gerarBytes,
  setExePath,
  getExePath
}
