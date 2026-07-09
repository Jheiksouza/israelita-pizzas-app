const express = require('express')
const usb = require('usb')

const PORT = process.env.PORT || 13001
const USB_VID = process.env.USB_VID ? parseInt(process.env.USB_VID, 16) : null
const USB_PID = process.env.USB_PID ? parseInt(process.env.USB_PID, 16) : null

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function findPrinter() {
  const devices = usb.getDeviceList()
  return devices.find(d => {
    if (USB_VID && d.deviceDescriptor.idVendor !== USB_VID) return false
    if (USB_PID && d.deviceDescriptor.idProduct !== USB_PID) return false
    return true
  })
}

function sendRaw(data) {
  return new Promise((resolve, reject) => {
    const device = findPrinter()
    if (!device) return reject(new Error('Impressora nao encontrada USB'))

    try {
      device.open()
      const iface = device.interface(0)
      iface.claim()

      const outEndpoint = iface.endpoints.find(ep => ep.direction === 'out')
      if (!outEndpoint) {
        device.close()
        return reject(new Error('Endpoint OUT nao encontrado'))
      }

      outEndpoint.transfer(data, err => {
        iface.release(err2 => {
          device.close()
          if (err) return reject(new Error('Erro ao enviar: ' + err.message))
          resolve(true)
        })
      })
    } catch (e) {
      try { device.close() } catch {}
      reject(new Error('Erro USB: ' + e.message))
    }
  })
}

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
    await sendRaw(data)
    console.log('Printed OK:', pedido.id)
    res.json({ ok: true, pedido: pedido.id })
  } catch (e) {
    console.error('Print error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/test', async (req, res) => {
  try {
    const data = Buffer.from([
      0x1B, 0x40,
      0x1B, 0x64, 0x03,
      0x54, 0x45, 0x53, 0x54, 0x45, 0x0A,
      0x1B, 0x64, 0x03,
      0x1D, 0x56, 0x01,
    ])
    await sendRaw(data)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/status', (req, res) => {
  const printer = findPrinter()
  res.json({
    ok: true,
    printerFound: !!printer,
    vid: printer ? '0x' + printer.deviceDescriptor.idVendor.toString(16).padStart(4, '0') : null,
    pid: printer ? '0x' + printer.deviceDescriptor.idProduct.toString(16).padStart(4, '0') : null,
    config: {
      usbVid: USB_VID ? '0x' + USB_VID.toString(16) : 'auto',
      usbPid: USB_PID ? '0x' + USB_PID.toString(16) : 'auto',
    },
  })
})

app.listen(PORT, () => {
  console.log(`Print server rodando em http://localhost:${PORT}`)
  const printer = findPrinter()
  if (printer) {
    const vid = '0x' + printer.deviceDescriptor.idVendor.toString(16).padStart(4, '0')
    const pid = '0x' + printer.deviceDescriptor.idProduct.toString(16).padStart(4, '0')
    console.log(`Impressora detectada: VID:${vid} PID:${pid}`)
  } else {
    console.log('Nenhuma impressora POS-80 detectada!')
    console.log('Execute: node detect.js')
    console.log('Depois: $env:USB_VID="0xXXXX"; $env:USB_PID="0xXXXX"; node server.js')
  }
})
