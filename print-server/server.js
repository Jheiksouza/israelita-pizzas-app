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
  const linhas = []

  linhas.push('')
  linhas.push('')
  linhas.push('   ISRAELITA PIZZAS')
  linhas.push('   Vila Velha - ES')
  linhas.push('')
  linhas.push('--------------------------------')
  linhas.push('')
  linhas.push(`         PEDIDO #${pedido.id}`)
  linhas.push('')
  linhas.push('--------------------------------')
  linhas.push(`Cliente: ${c.nome || ''}`)
  if (c.telefone) linhas.push(`Tel: ${c.telefone}`)
  if (c.endereco) linhas.push(`End: ${c.endereco}`)
  linhas.push('--------------------------------')
  linhas.push('ITENS')
  if (pedido.itens) {
    for (const item of pedido.itens) {
      let l = ` ${item.qtd}x ${item.nome}`
      if (item.valor_unitario) l += `  R$${(item.valor_unitario * item.qtd).toFixed(2)}`
      linhas.push(l)
    }
  }
  linhas.push('--------------------------------')
  linhas.push(`TOTAL: R$${(pedido.total || 0).toFixed(2)}`)
  if (c.pagamento && c.pagamento.length > 0) {
    linhas.push('--------------------------------')
    for (const p of c.pagamento) {
      linhas.push(`${p.metodo} R$${(p.valor || 0).toFixed(2)}`)
    }
  }
  if (c.observacoes) linhas.push(`Obs: ${c.observacoes}`)
  if (c.codigo_coleta) linhas.push(`Coleta: ${c.codigo_coleta}`)
  linhas.push('')
  linhas.push('')
  linhas.push('')
  linhas.push('')
  linhas.push('')

  return cp850(linhas.join('\r\n') + '\r\n')
}

app.post('/print', async (req, res) => {
  try {
    const pedido = req.body
    if (!pedido?.id) return res.status(400).json({ error: 'pedido.id required' })

    const data = gerarBytes(pedido)
    const tmpFile = path.join(__dirname, `_print_${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)

    const cmd = `powershell -NoProfile -Command "$p = Get-CimInstance Win32_Printer -Filter \"Name='${PRINTER_NAME}'\"; if ($p -and !$p.Shared) { Set-Printer -Name '${PRINTER_NAME}' -Shared $true }; [System.IO.File]::WriteAllBytes('\\\\localhost\\${PRINTER_NAME}', [System.IO.File]::ReadAllBytes('${tmpFile}')); Remove-Item '${tmpFile}'"`

    exec(cmd, { timeout: 20000 }, (err, stdout, stderr) => {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
      if (err) {
        console.error('Print error:', stderr || err.message)
        return res.status(500).json({ error: (stderr || err.message).trim() })
      }
      console.log('Printed OK:', pedido.id)
      res.json({ ok: true, pedido: pedido.id })
    })
  } catch (e) {
    console.error('Print exception:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/test', (req, res) => {
  try {
    const data = cp850('TESTE DE IMPRESSÃO\r\n\r\nSe voce esta lendo isso\r\na impressora esta OK!\r\n\r\n\r\n\r\n')
    const tmpFile = path.join(__dirname, `_test_${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)

    const cmd = `powershell -NoProfile -Command "$p = Get-CimInstance Win32_Printer -Filter \"Name='${PRINTER_NAME}'\"; if ($p -and !$p.Shared) { Set-Printer -Name '${PRINTER_NAME}' -Shared $true }; [System.IO.File]::WriteAllBytes('\\\\localhost\\${PRINTER_NAME}', [System.IO.File]::ReadAllBytes('${tmpFile}')); Remove-Item '${tmpFile}'"`

    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
      if (err) return res.status(500).json({ error: (stderr || err.message).trim() })
      res.json({ ok: true })
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
