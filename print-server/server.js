const express = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 13001
const PRINTER_NAME = process.env.PRINTER_NAME || 'POS-80'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function cp850(str) {
  const map = {
    'á':0xA0,'à':0xA1,'â':0xA2,'ã':0xA3,'ä':0xA4,'é':0x82,'è':0x8A,'ê':0x83,'ë':0x89,
    'í':0xA8,'ì':0x8D,'î':0x8E,'ï':0x8F,'ó':0xE0,'ò':0xE1,'ô':0xE2,'õ':0xE3,'ö':0xE4,
    'ú':0x82,'ù':0xEB,'û':0xEE,'ü':0x81,'ç':0x87,'Ç':0x80,'ñ':0xA5,'Ñ':0xA6,
    'º':0xA7,'ª':0xAB,'°':0xF8,
  }
  const b = Buffer.alloc(str.length)
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const code = ch.charCodeAt(0)
    if (code < 128) b[i] = code
    else if (map[ch] !== undefined) b[i] = map[ch]
    else b[i] = 0x3F
  }
  return b
}

function gerarBytes(pedido) {
  const c = pedido.cliente || {}
  const partes = []

  function esc(...args) { partes.push(Buffer.from(args)) }
  function txt(str) { partes.push(cp850(str)) }

  esc(0x1B, 0x40)
  esc(0x1B, 0x64, 0x03)
  esc(0x1B, 0x61, 0x01)
  esc(0x1B, 0x21, 0x30)
  txt('ISRAELITA PIZZAS\n')
  esc(0x1B, 0x21, 0x00)
  txt('Vila Velha - ES\n')
  esc(0x1B, 0x61, 0x00)
  txt(''.padEnd(32, '-') + '\n')
  esc(0x1B, 0x61, 0x01)
  esc(0x1B, 0x21, 0x30)
  txt(`PEDIDO #${pedido.id}\n`)
  esc(0x1B, 0x21, 0x00)
  esc(0x1B, 0x61, 0x00)
  txt(''.padEnd(32, '-') + '\n')
  txt(`Cliente: ${c.nome || ''}\n`)
  if (c.telefone) txt(`Tel: ${c.telefone}\n`)
  if (c.endereco) txt(`End: ${c.endereco}\n`)
  txt(''.padEnd(32, '-') + '\n')
  esc(0x1B, 0x45, 0x01)
  txt('ITENS\n')
  esc(0x1B, 0x45, 0x00)
  if (pedido.itens) {
    for (const item of pedido.itens) {
      let l = `${item.qtd}x ${item.nome}`
      if (item.valor_unitario) l += `  R$${(item.valor_unitario * item.qtd).toFixed(2)}`
      txt(l + '\n')
    }
  }
  txt(''.padEnd(32, '-') + '\n')
  esc(0x1B, 0x45, 0x01)
  txt(`TOTAL: R$${(pedido.total || 0).toFixed(2)}\n`)
  esc(0x1B, 0x45, 0x00)
  if (c.pagamento && c.pagamento.length > 0) {
    txt(''.padEnd(32, '-') + '\n')
    for (const p of c.pagamento) {
      txt(`${p.metodo} R$${(p.valor || 0).toFixed(2)}\n`)
    }
  }
  if (c.observacoes) txt(`\nObs: ${c.observacoes}\n`)
  if (c.codigo_coleta) txt(`Coleta: ${c.codigo_coleta}\n`)
  esc(0x1B, 0x64, 0x05)
  esc(0x1D, 0x56, 0x01)

  return Buffer.concat(partes)
}

app.post('/print', async (req, res) => {
  try {
    const pedido = req.body
    if (!pedido?.id) return res.status(400).json({ error: 'pedido.id required' })

    const data = gerarBytes(pedido)
    const tmpFile = path.join(__dirname, `_print_${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)

    const exe = path.join(__dirname, 'RawPrinter.exe')
    const cmd = `"${exe}" "${tmpFile}" "${PRINTER_NAME}"`

    exec(cmd, { timeout: 20000 }, (err, stdout, stderr) => {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
      const out = (stdout || '').trim()
      if (err) {
        console.error('Print error:', (stderr || err.message).trim())
        return res.status(500).json({ error: (stderr || err.message).trim() })
      }
      console.log('RawPrinter:', out)
      res.json({ ok: true, pedido: pedido.id })
    })
  } catch (e) {
    console.error('Print exception:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/test', (req, res) => {
  try {
    const data = Buffer.from([
      0x1B, 0x40,                  // Initialize
      0x1B, 0x61, 0x01,            // Center
      0x1B, 0x21, 0x30,            // Double size
      0x54, 0x45, 0x53, 0x54, 0x45, 0x0A, // TESTE\n
      0x1B, 0x21, 0x00,            // Normal
      0x1B, 0x61, 0x00,            // Left
      0x53, 0x65, 0x20, 0x76, 0x6F, 0x63, 0x65, 0x20, 0x65, 0x73, 0x74, 0x61, 0x20, 0x6C, 0x65, 0x6E, 0x64, 0x6F, 0x0A, // Se voce esta lendo\n
      0x61, 0x20, 0x69, 0x6D, 0x70, 0x72, 0x65, 0x73, 0x73, 0x6F, 0x72, 0x61, 0x20, 0x65, 0x73, 0x74, 0x61, 0x20, 0x4F, 0x4B, 0x21, 0x0A, // a impressora esta OK!\n
      0x0A, 0x0A, 0x0A,            // feed
      0x1B, 0x64, 0x03,            // Feed 3
      0x1D, 0x56, 0x01,            // Cut
    ])
    const tmpFile = path.join(__dirname, `_test_${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)

    const exe = path.join(__dirname, 'RawPrinter.exe')
    const cmd = `"${exe}" "${tmpFile}" "${PRINTER_NAME}"`

    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
      const out = (stdout || '').trim()
      if (err) return res.status(500).json({ error: (stderr || err.message).trim() })
      res.json({ ok: true, rawPrinter: out })
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/status', (req, res) => {
  res.json({ ok: true, printerName: PRINTER_NAME })
})

app.listen(PORT, () => {
  console.log(`Print server rodando em http://localhost:${PORT}`)
  console.log(`Impressora: ${PRINTER_NAME}`)
})
