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
    fields: a.getConfigFields()
  }))
}

module.exports = { register, getAdapter, getAllAdapters, getConfigDefaults, getPlatformInfo }
