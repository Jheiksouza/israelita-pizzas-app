const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setPrinter: (name) => ipcRenderer.invoke('set-printer', name),
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  selectExeFolder: () => ipcRenderer.invoke('select-exe-folder'),
  onRefresh: (cb) => {
    ipcRenderer.on('refresh', cb)
    return () => ipcRenderer.removeListener('refresh', cb)
  },
  testPrint: () => ipcRenderer.invoke('test-print')
})
