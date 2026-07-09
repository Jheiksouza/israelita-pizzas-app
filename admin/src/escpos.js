function formatMoney(v) {
  return 'R$ ' + (v || 0).toFixed(2)
}

function linha(len = 32) {
  return '─'.repeat(len) + '\n'
}

export function gerarHTMLRecibo(pedido) {
  const c = pedido.cliente || {}

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pedido #${pedido.id}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 12px;
    width: 72mm;
    padding: 3mm 4mm;
    color: #000;
    background: #fff;
    line-height: 1.3;
  }
  h1 { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 2px; }
  .sub { text-align: center; font-size: 11px; margin-bottom: 4px; }
  .sep { text-align: center; letter-spacing: 2px; margin: 4px 0; }
  .pedido-num { text-align: center; font-size: 16px; font-weight: bold; margin: 4px 0; }
  .row { display: flex; margin: 1px 0; }
  .row strong { min-width: 70px; }
  .item { margin: 2px 0 2px 0; }
  .item-qtd { font-weight: bold; }
  .total { text-align: right; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .obs { margin-top: 4px; font-style: italic; }
  @media print {
    body { width: auto; }
  }
</style>
</head>
<body>
<h1>ISRAELITA PIZZAS</h1>
<div class="sub">Vila Velha - ES</div>
<div class="sep">${linha()}</div>
<div class="pedido-num">PEDIDO #${pedido.id}</div>
<div class="sep">${linha()}</div>
<div class="row"><strong>Cliente:</strong> ${c.nome || ''}</div>
${c.telefone ? `<div class="row"><strong>Tel:</strong> ${c.telefone}</div>` : ''}
${c.endereco ? `<div class="row"><strong>End:</strong> ${c.endereco}</div>` : ''}
<div class="sep">${linha()}</div>
<div><strong>ITENS</strong></div>
`

  if (pedido.itens) {
    for (const item of pedido.itens) {
      html += `<div class="item"><span class="item-qtd">${item.qtd}x</span> ${item.nome}${item.valor_unitario ? '  ' + formatMoney(item.valor_unitario * item.qtd) : ''}</div>\n`
    }
  }

  html += `<div class="sep">${linha()}</div>
<div class="total">TOTAL: ${formatMoney(pedido.total)}</div>
`

  if (c.pagamento?.length > 0) {
    html += `<div class="sep">${linha()}</div>\n`
    for (const p of c.pagamento) {
      html += `<div class="row"><strong>Pgto:</strong> ${p.metodo} ${formatMoney(p.valor)}</div>\n`
    }
  }

  if (c.observacoes) {
    html += `<div class="obs">Obs: ${c.observacoes}</div>\n`
  }

  if (c.codigo_coleta) {
    html += `<div class="row"><strong>Coleta:</strong> ${c.codigo_coleta}</div>\n`
  }

  html += `<div style="text-align:center;margin-top:8px;font-size:10px">Obrigado pela preferencia!</div>
<script>
  window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
<\/script>
</body>
</html>`

  return html
}

export async function printOrder(pedido) {
  const html = gerarHTMLRecibo(pedido)
  const win = window.open('', '_blank', 'width=400,height=600,menubar=no,toolbar=no,status=no,scrollbars=yes')
  if (!win) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'width=400,height=600')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return
  }
  win.document.write(html)
  win.document.close()
}

export function isPrinterConnected() {
  return true
}
