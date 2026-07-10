const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron')
const path = require('path')
const { exec } = require('child_process')
const { startServer, setPrinterName, getPrinterName, getPort, getServerStatus, setExePath, getExePath } = require('./server')

let tray = null
let settingsWindow = null
let serverStarted = false

function getStorePath() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'store.json')
    : path.join(__dirname, 'store.json')
}

function loadStore() {
  try {
    const fs = require('fs')
    if (fs.existsSync(getStorePath())) {
      return JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'))
    }
  } catch {}
  return {}
}

function saveStore(data) {
  try {
    const fs = require('fs')
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2))
  } catch {}
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'QueroPizza Print Server',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  settingsWindow.loadFile('settings.html')
  settingsWindow.setMenu(null)

  settingsWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      settingsWindow.hide()
    }
  })

  settingsWindow.on('show', () => settingsWindow.webContents.send('refresh'))
}

function createTray() {
  const iconSize = process.platform === 'darwin' ? 16 : 32
  const canvas = Buffer.from(
    `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAIASURBVFiF7Ze9S8N AFMYf0dBBkS4dBBcXQRB0cHFw8B9w0j9AEEEQdHBRcHBRcHBRcHBRcHBRcHAQBEEQBBdxcXARdH ARBEEQBEGp0g/S0nMNjY0YGuOVBw5y97489/veexNyOBz4T4QQA1TT6QwAoNfroa+vD0II9Ho9ZLNZEkJgtVqRTCbhdDphtVpRKBQQjUbh9/sRDAYBAF6vF+l0GqFQCA6HA4VCAYlEAk6nE6lUCtlsFgAgiqJOp9OZm5uT0+k0VFWVZVnOZDLy0tKSTBAESVVVWVVVORaLyevr6/La2poMAIVCQdY0TY5Go/Lm5qacTqflWq0GAOj3+zSdTlNVVSqVChVFoel0mk6nU0ajUQqCQEqSREFVVQqCQKqqkuFwmIIgUBAEWq1WqdPpUBAEWq/XKQgC9Xo9CseWnZ0dyufz1O/3Z4Zh3DqOSqUSmc1mkSzLN4lE4iaRSJwDwNXV1U2pVDoGAKfT+WZZlmmz2bx7enqidrudVqvVg1wudwAA8/Pzz0tLS29LS0tvAPD8/Pz28vLyDgDZbPaz2WySqqrdZrN5YJomAUBRFFqv1ykIAhUEgZbLZSoIApVlmURRpCiK1G63kxACQggMw4BlWZBlGQ6HA4qiIJvNQtE0kCQJ8/PzME0TnU4Huq5DkiS0Wi0YhgFVVUEIgSiK0DQNqqqC1+tFr9dDq9WCw+GA3++Hoiio1WowTROiKGJhYQGqqsI0TfT7fQiCgH6/j3q9Dk3T4Pf7IUkSCoUCVFWFLMvQNA2ZTAayLKNer0PTNAwGA8iyjHw+D13XIQgCqtUqKpUKJEmCJElIp9NoNpsYj8fQNA2FQgHj8Riz2QyVSgXpdBqWZbYT5H8B+W4I5Y0c0u0AAAAASUVORK5CYII=`,
    'base64'
  )

  const icon = nativeImage.createFromBuffer(canvas)
  tray = new Tray(icon.resize({ width: iconSize, height: iconSize }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Configurações',
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.show()
        else { settingsWindow = null; createSettingsWindow() }
      }
    },
    { type: 'separator' },
    { label: 'Status do Servidor', enabled: false },
    { label: `  ${serverStarted ? 'Rodando' : 'Parado'}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('QueroPizza Print Server')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show()
    } else {
      settingsWindow = null
      createSettingsWindow()
    }
  })
}

app.whenReady().then(() => {
  const store = loadStore()
  const printer = store.printerName || 'POS-80'
  setPrinterName(printer)

  const exePath = app.isPackaged
    ? path.join(process.resourcesPath, 'RawPrinter.exe')
    : path.join(__dirname, 'RawPrinter.exe')
  setExePath(exePath)
  console.log('RawPrinter.exe path:', exePath, 'exists:', require('fs').existsSync(exePath))

  startServer()
  serverStarted = true
  console.log('Express server started on port', getPort())

  createSettingsWindow()
  createTray()


})

app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  app.isQuitting = true
})

ipcMain.handle('get-config', () => {
  const store = loadStore()
  return {
    printerName: getPrinterName(),
    autoStart: app.getLoginItemSettings().openAtLogin,
    port: getPort(),
    status: getServerStatus()
  }
})

ipcMain.handle('set-printer', (event, printerName) => {
  setPrinterName(printerName)
  const store = loadStore()
  store.printerName = printerName
  saveStore(store)
  return true
})

ipcMain.handle('set-auto-start', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe')
  })
  return true
})

ipcMain.handle('get-printers', async () => {
  return new Promise((resolve) => {
    exec(
      'powershell -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"',
      { timeout: 10000 },
      (err, stdout) => {
        if (err) return resolve(['POS-80'])
        const printers = stdout
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0)
        resolve(printers.length > 0 ? printers : ['POS-80'])
      }
    )
  })
})

ipcMain.handle('select-exe-folder', async () => {
  const result = await dialog.showOpenDialog(settingsWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta do RawPrinter.exe'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const exePath = path.join(result.filePaths[0], 'RawPrinter.exe')
    if (require('fs').existsSync(exePath)) {
      const store = loadStore()
      store.customExePath = result.filePaths[0]
      saveStore(store)
      return result.filePaths[0]
    }
  }
  return null
})

ipcMain.handle('test-print', async () => {
  const { gerarBytes } = require('./server')
  const fs = require('fs')
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
    const tmpFile = path.join(app.getPath('temp'), `_print_test_${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)

    const exe = getExePath()
    if (!fs.existsSync(exe)) {
      return { success: false, error: `RawPrinter.exe não encontrado em: ${exe}` }
    }

    // Save a copy on desktop for debugging
    const debugFile = path.join(app.getPath('desktop'), 'print_debug.bin')
    try { fs.copyFileSync(tmpFile, debugFile) } catch {}

    return new Promise((resolve) => {
      exec(`"${exe}" "${tmpFile}" "${getPrinterName()}"`, { timeout: 20000 }, (err, stdout, stderr) => {
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
        if (err) {
          resolve({ success: false, error: (stderr || err.message).trim(), debugFile })
        } else {
          resolve({ success: true, output: (stdout || '').trim(), debugFile })
        }
      })
    })
  } catch (e) {
    return { success: false, error: e.message }
  }
})
