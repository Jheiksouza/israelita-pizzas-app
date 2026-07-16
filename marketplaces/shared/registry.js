const adapters = new Map()

function register(adapter) {
  adapters.set(adapter.platform, adapter)
}

function getAdapter(platform) {
  return adapters.get(platform)
}

function getAllAdapters() {
  return Array.from(adapters.values())
}

function getConfigDefaults() {
  const defaults = {}
  for (const adapter of getAllAdapters()) {
    defaults[adapter.platform] = adapter.getDefaultConfig()
  }
  return defaults
}

function getPlatformInfo() {
  return getAllAdapters().map(a => ({
    platform: a.platform,
    displayName: a.displayName,
    color: a.color,
    supportsPolling: typeof a.pollOrders === 'function',
    supportsMenuSync: typeof a.syncMenu === 'function',
    fields: a.getConfigFields()
  }))
}

function getPlatformStatuses(allConfigs) {
  const statuses = {}
  for (const adapter of getAllAdapters()) {
    const cfg = allConfigs[adapter.platform]
    if (!cfg) {
      statuses[adapter.platform] = { status: 'not_configured', label: 'Não configurado' }
    } else if (!cfg.enabled) {
      statuses[adapter.platform] = { status: 'disabled', label: 'Desabilitado' }
    } else {
      const fields = adapter.getConfigFields().filter(f => f.section === 'credentials')
      const hasAll = fields.every(f => cfg[f.key])
      statuses[adapter.platform] = hasAll
        ? { status: 'configured', label: 'Configurado' }
        : { status: 'not_configured', label: 'Configuração incompleta' }
    }
  }
  return statuses
}

module.exports = { register, getAdapter, getAllAdapters, getConfigDefaults, getPlatformInfo, getPlatformStatuses }
