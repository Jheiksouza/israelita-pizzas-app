const CP850_MAP = {
  'á': 0xA0, 'à': 0xA1, 'â': 0xA2, 'ã': 0xA3, 'ä': 0xA4,
  'é': 0x82, 'è': 0x8A, 'ê': 0x83, 'ë': 0x89,
  'í': 0xA8, 'ì': 0x8D, 'î': 0x8E, 'ï': 0x8F,
  'ó': 0xE0, 'ò': 0xE1, 'ô': 0xE2, 'õ': 0xE3, 'ö': 0xE4,
  'ú': 0x82, 'ù': 0xEB, 'û': 0xEE, 'ü': 0x81,
  'ç': 0x87, 'Ç': 0x80,
  'ñ': 0xA5, 'Ñ': 0xA6,
  'º': 0xA7, 'ª': 0xAB,
  '°': 0xF8,
  '¹': 0xB9, '²': 0xB2, '³': 0xB3,
  '¢': 0x9B, '£': 0x9C,
  '—': 0x2D, '–': 0x2D,
  '─': 0x2D,
}

function cp850Encode(str) {
  const bytes = []
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    if (code < 128) {
      bytes.push(code)
    } else if (CP850_MAP[ch] !== undefined) {
      bytes.push(CP850_MAP[ch])
    } else {
      bytes.push(0x3F)
    }
  }
  return new Uint8Array(bytes)
}

function textEncoder(str) {
  return cp850Encode(str)
}

const CMD = {
  INIT: new Uint8Array([0x1B, 0x40]),
  LF: new Uint8Array([0x0A]),
  TAB: new Uint8Array([0x09]),
  BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
  DOUBLE_ON: new Uint8Array([0x1B, 0x21, 0x30]),
  DOUBLE_OFF: new Uint8Array([0x1B, 0x21, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1D, 0x56, 0x01]),
  CUT_FULL: new Uint8Array([0x1D, 0x56, 0x00]),
  FEED: (n) => new Uint8Array([0x1B, 0x64, n]),
  ALIGN_CENTER: new Uint8Array([0x1B, 0x61, 0x01]),
  ALIGN_LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
}

function line(str = '') {
  const bytes = []
  bytes.push(...textEncoder(str))
  bytes.push(...CMD.LF)
  return new Uint8Array(bytes)
}

function center(str, bold = false) {
  const bytes = []
  bytes.push(...CMD.ALIGN_CENTER)
  if (bold) bytes.push(...CMD.BOLD_ON)
  bytes.push(...textEncoder(str))
  bytes.push(...CMD.LF)
  if (bold) bytes.push(...CMD.BOLD_OFF)
  bytes.push(...CMD.ALIGN_LEFT)
  return new Uint8Array(bytes)
}

function doubleLine(str) {
  const bytes = []
  bytes.push(...CMD.ALIGN_CENTER)
  bytes.push(...CMD.DOUBLE_ON)
  bytes.push(...textEncoder(str))
  bytes.push(...CMD.LF)
  bytes.push(...CMD.DOUBLE_OFF)
  bytes.push(...CMD.ALIGN_LEFT)
  return new Uint8Array(bytes)
}

function separator() {
  return line('─'.repeat(32))
}

function boldLine(label, value) {
  const bytes = []
  bytes.push(...CMD.BOLD_ON)
  bytes.push(...textEncoder(label + ' '))
  bytes.push(...CMD.BOLD_OFF)
  bytes.push(...textEncoder(value))
  bytes.push(...CMD.LF)
  return new Uint8Array(bytes)
}

export function buildPrintData(pedido) {
  const buf = []
  buf.push(CMD.INIT)
  buf.push(CMD.FEED(2))
  buf.push(doubleLine('ISRAELITA PIZZAS'))
  buf.push(center('(27) 99999-9999'))
  buf.push(center('Vila Velha - ES'))
  buf.push(CMD.FEED(1))
  buf.push(separator())
  buf.push(CMD.FEED(1))

  buf.push(doubleLine(`PEDIDO #${pedido.id}`))
  buf.push(CMD.FEED(1))

  buf.push(boldLine('Cliente:', pedido.cliente?.nome || ''))
  if (pedido.cliente?.telefone) {
    buf.push(boldLine('Tel:', pedido.cliente.telefone))
  }
  if (pedido.cliente?.endereco) {
    buf.push(boldLine('Endereco:', pedido.cliente.endereco))
  }
  buf.push(CMD.FEED(1))
  buf.push(separator())
  buf.push(CMD.FEED(1))

  buf.push(center('--- ITENS ---', true))
  buf.push(CMD.LF)

  if (pedido.itens) {
    for (const item of pedido.itens) {
      const lineBytes = []
      lineBytes.push(...textEncoder(`${item.qtd}x ${item.nome}`))
      if (item.valor_unitario) {
        lineBytes.push(...textEncoder(`  R$ ${(item.valor_unitario * item.qtd).toFixed(2)}`))
      }
      lineBytes.push(...CMD.LF)
      buf.push(new Uint8Array(lineBytes))
    }
  }

  buf.push(CMD.FEED(1))
  buf.push(separator())
  buf.push(CMD.FEED(1))

  buf.push(boldLine('Total:', `R$ ${pedido.total?.toFixed(2)}`))

  if (pedido.cliente?.pagamento?.length > 0) {
    buf.push(CMD.LF)
    for (const p of pedido.cliente.pagamento) {
      buf.push(boldLine('Pagamento:', `${p.metodo} R$ ${p.valor?.toFixed(2)}`))
    }
  }

  if (pedido.cliente?.observacoes) {
    buf.push(CMD.LF)
    buf.push(boldLine('Obs:', pedido.cliente.observacoes))
  }

  buf.push(CMD.FEED(3))
  buf.push(CMD.CUT_PARTIAL)

  const totalLength = buf.reduce((acc, b) => acc + b.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const b of buf) {
    result.set(b, offset)
    offset += b.length
  }
  return result
}

let connectedDevice = null

export async function connectPrinter() {
  if (connectedDevice) {
    try {
      await connectedDevice.close()
    } catch {}
    connectedDevice = null
  }

  const device = await navigator.usb.requestDevice({
    filters: []
  })

  await device.open()
  if (device.configuration === null) {
    await device.selectConfiguration(1)
  }
  await device.claimInterface(0)

  connectedDevice = device
  return true
}

export async function disconnectPrinter() {
  if (connectedDevice) {
    try {
      await connectedDevice.close()
    } catch {}
    connectedDevice = null
  }
}

export function isPrinterConnected() {
  return connectedDevice !== null
}

export async function printOrder(pedido) {
  if (!connectedDevice) throw new Error('Impressora nao conectada')

  const data = buildPrintData(pedido)
  await connectedDevice.transferOut(1, data)
}

export async function printTest() {
  if (!connectedDevice) throw new Error('Impressora nao conectada')

  const testData = new Uint8Array([
    0x1B, 0x40,
    ...textEncoder('TESTE DE IMPRESSÃO\n'),
    ...textEncoder('Se esta linha apareceu\n'),
    ...textEncoder('a impressora esta OK!\n'),
    ...textEncoder('\n\n\n'),
    0x1D, 0x56, 0x01,
  ])
  await connectedDevice.transferOut(1, testData)
}
