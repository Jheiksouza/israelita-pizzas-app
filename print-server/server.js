const express = require('express')
const escpos = require('escpos')
const escposUSB = require('escpos-usb')

const PRINT_VID = process.env.PRINT_VID ? parseInt(process.env.PRINT_VID, 16) : null
const PRINT_PID = process.env.PRINT_PID ? parseInt(process.env.PRINT_PID, 16) : null
const PORT = process.env.PORT || 13001

const app = express()
app.use(express.json({ limit: '1mb' }))

function imprimir(pedido) {
  return new Promise((resolve, reject) => {
    try {
      const device = new escposUSB.USB(PRINT_VID, PRINT_PID)
      device.open(err => {
        if (err) return reject(new Error('Erro ao abrir USB: ' + err.message))
        const printer = new escpos.Printer(device)

        printer
          .align('CT')
          .style('B')
          .size(1, 1)
          .text('ISRAELITA PIZZAS')
          .style('NORMAL')
          .text('Vila Velha - ES')
          .text('')
          .align('LT')
          .drawLine()
          .align('CT')
          .style('B')
          .size(1, 1)
          .text(`PEDIDO #${pedido.id}`)
          .style('NORMAL')
          .size(0, 0)
          .align('LT')
          .drawLine()
          .text(`Cliente: ${pedido.cliente?.nome || ''}`)

        if (pedido.cliente?.telefone) {
          printer.text(`Tel: ${pedido.cliente.telefone}`)
        }
        if (pedido.cliente?.endereco) {
          printer.text(`End: ${pedido.cliente.endereco}`)
        }

        printer.drawLine()
          .style('B')
          .text('ITENS')
          .style('NORMAL')

        if (pedido.itens) {
          for (const item of pedido.itens) {
            let linha = `${item.qtd}x ${item.nome}`
            if (item.valor_unitario) {
              linha += ` R$${(item.valor_unitario * item.qtd).toFixed(2)}`
            }
            printer.text(linha)
          }
        }

        printer.drawLine()
          .style('B')
          .text(`TOTAL: R$${(pedido.total || 0).toFixed(2)}`)
          .style('NORMAL')

        if (pedido.cliente?.pagamento?.length > 0) {
          printer.drawLine()
          for (const p of pedido.cliente.pagamento) {
            printer.text(`${p.metodo} R$${(p.valor || 0).toFixed(2)}`)
          }
        }

        if (pedido.cliente?.observacoes) {
          printer.text('')
          printer.text(`Obs: ${pedido.cliente.observacoes}`)
        }
        if (pedido.cliente?.codigo_coleta) {
          printer.text(`Coleta: ${pedido.cliente.codigo_coleta}`)
        }

        printer.feed(3)
          .cut(true)
          .close()

        setTimeout(() => resolve(true), 500)
      })
    } catch (e) {
      reject(e)
    }
  })
}

app.post('/print', async (req, res) => {
  try {
    const pedido = req.body
    if (!pedido?.id) return res.status(400).json({ error: 'pedido.id required' })
    await imprimir(pedido)
    res.json({ ok: true, pedido: pedido.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/status', (req, res) => {
  res.json({
    ok: true,
    printer: PRINT_VID ? { vid: '0x' + PRINT_VID.toString(16), pid: '0x' + PRINT_PID.toString(16) } : 'auto',
  })
})

app.listen(PORT, () => {
  console.log(`Print server rodando em http://localhost:${PORT}`)
  console.log(`Printer: ${PRINT_VID ? `VID=0x${PRINT_VID.toString(16)} PID=0x${PRINT_PID.toString(16)}` : 'auto-detect'}`)
})
