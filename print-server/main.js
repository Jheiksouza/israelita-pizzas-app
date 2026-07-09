const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron')
const path = require('path')
const { exec } = require('child_process')
const { startServer, setPrinterName, getPrinterName, getPort, getServerStatus, setExePath } = require('./server')

let tray = null
let settingsWindow = null
let serverStarted = false

function getExePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'RawPrinter.exe')
    : path.join(__dirname, 'RawPrinter.exe')
}

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
    title: 'Israelita Print Server',
    icon: path.join(__dirname, 'icon.png'),
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
        if (settingsWindow) settingsWindow.show()
        else createSettingsWindow()
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

  tray.setToolTip('Israelita Print Server')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (settingsWindow) settingsWindow.show()
    else createSettingsWindow()
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

  startServer()
  serverStarted = true

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
