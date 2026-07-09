let config = {}
let printers = []

const $ = id => document.getElementById(id)

async function carregarConfig() {
  try {
    config = await window.electronAPI.getConfig()
    $('status-text').textContent = config.status || 'Rodando'
    $('status-indicator').className = 'status-indicator online'
    $('port-display').textContent = config.port || 13001
    $('chk-autostart').checked = config.autoStart || false
  } catch (e) {
    $('status-text').textContent = 'Erro ao carregar'
    $('status-indicator').className = 'status-indicator offline'
  }
}

async function carregarImpressoras() {
  try {
    printers = await window.electronAPI.getPrinters()
    const select = $('printer-select')
    select.innerHTML = ''
    printers.forEach(p => {
      const opt = document.createElement('option')
      opt.value = p
      opt.textContent = p
      if (p === config.printerName) opt.selected = true
      select.appendChild(opt)
    })
    if (!printers.includes(config.printerName)) {
      const opt = document.createElement('option')
      opt.value = config.printerName
      opt.textContent = config.printerName
      opt.selected = true
      select.appendChild(opt)
    }
  } catch (e) {
    console.error('Erro ao listar impressoras:', e)
  }
}

function mostrarToast(msg, tipo) {
  const toast = $('toast')
  toast.textContent = msg
  toast.className = `toast show ${tipo || ''}`
  setTimeout(() => toast.className = 'toast', 3000)
}

$('printer-select').addEventListener('change', async (e) => {
  const printer = e.target.value
  try {
    await window.electronAPI.setPrinter(printer)
    config.printerName = printer
    mostrarToast(`Impressora alterada para "${printer}"`, 'success')
  } catch {
    mostrarToast('Erro ao salvar impressora', 'error')
  }
})

$('chk-autostart').addEventListener('change', async (e) => {
  try {
    await window.electronAPI.setAutoStart(e.target.checked)
    mostrarToast(
      e.target.checked ? 'Iniciará com o Windows' : 'Auto-start desativado',
      'success'
    )
  } catch {
    mostrarToast('Erro ao configurar auto-start', 'error')
  }
})

$('btn-testar').addEventListener('click', async () => {
  try {
    const res = await fetch(`http://localhost:${config.port || 13001}/test`)
    if (res.ok) {
      mostrarToast('Impressão de teste enviada!', 'success')
    } else {
      const err = await res.json()
      mostrarToast(`Erro: ${err.error}`, 'error')
    }
  } catch (e) {
    mostrarToast('Servidor não está rodando', 'error')
  }
})

$('btn-refresh').addEventListener('click', () => {
  carregarImpressoras()
  mostrarToast('Lista atualizada', 'success')
})

$('btn-fechar').addEventListener('click', () => {
  window.close()
})

const unsub = window.electronAPI.onRefresh(() => {
  carregarConfig()
  carregarImpressoras()
})

carregarConfig()
carregarImpressoras()
