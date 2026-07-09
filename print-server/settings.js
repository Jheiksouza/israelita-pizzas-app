const $ = id => document.getElementById(id)

let config = {}
let printers = []

function addLog(msg, tipo) {
  const container = $('log-container')
  const entry = document.createElement('div')
  entry.className = `log-entry ${tipo || ''}`
  const time = new Date().toLocaleTimeString('pt-BR')
  entry.textContent = `[${time}] ${msg}`
  container.appendChild(entry)
  container.scrollTop = container.scrollHeight
  // Remove empty placeholder if present
  const empty = container.querySelector('.log-empty')
  if (empty) empty.remove()
}

$('btn-limpar-logs').addEventListener('click', () => {
  const container = $('log-container')
  container.innerHTML = '<div class="log-empty">Nenhum log ainda</div>'
})

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
  addLog(msg, tipo === 'error' ? 'error' : tipo === 'success' ? 'success' : 'info')
}

$('printer-select').addEventListener('change', async (e) => {
  const printer = e.target.value
  addLog(`Alterando impressora para: ${printer}`, 'info')
  try {
    await window.electronAPI.setPrinter(printer)
    config.printerName = printer
    mostrarToast(`Impressora alterada para "${printer}"`, 'success')
  } catch {
    mostrarToast('Erro ao salvar impressora', 'error')
  }
})

$('chk-autostart').addEventListener('change', async (e) => {
  addLog(e.target.checked ? 'Ativando auto-start' : 'Desativando auto-start', 'info')
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
  addLog('Iniciando impressão de teste...', 'info')
  try {
    addLog(`Impressora: ${config.printerName}`, 'info')
    const result = await window.electronAPI.testPrint()
    if (result.success) {
      addLog(`RawPrinter: ${result.output || 'OK'}`, 'success')
      mostrarToast('Impressão de teste enviada!', 'success')
    } else {
      addLog(`Falha: ${result.error}`, 'error')
      mostrarToast(`Erro: ${result.error}`, 'error')
    }
  } catch (e) {
      addLog(`Exceção: ${e.message}`, 'error')
    mostrarToast(`Erro: ${e.message}`, 'error')
  }
})

$('btn-refresh').addEventListener('click', () => {
  carregarImpressoras()
  mostrarToast('Lista atualizada', 'success')
})

$('btn-fechar').addEventListener('click', () => {
  window.close()
})

const unsubRefresh = window.electronAPI.onRefresh(() => {
  carregarConfig()
  carregarImpressoras()
})

const unsubLog = window.electronAPI.onLog((msg, type) => {
  addLog(msg, type || 'info')
})

addLog('Configurações carregadas', 'info')
carregarConfig()
carregarImpressoras()
