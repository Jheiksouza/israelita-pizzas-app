class MarketplaceAdapter {
  get platform() {
    throw new Error('Subclass must implement platform getter')
  }

  get displayName() {
    throw new Error('Subclass must implement displayName getter')
  }

  get color() {
    throw new Error('Subclass must implement color getter')
  }

  getDefaultConfig() {
    return { enabled: false }
  }

  getConfigFields() {
    return []
  }

  async validateWebhook(req, config) {
    return { valid: true, eventType: null, rawPayload: req.body }
  }

  async toInternalOrder(rawPayload, config) {
    throw new Error('Subclass must implement toInternalOrder')
  }

  async updateStatus(orderId, status, config) {
  }

  async testConnection(config) {
    const missing = this.getConfigFields()
      .filter(f => f.section === 'credentials' && !config[f.key])
      .map(f => f.label)
    if (missing.length > 0) {
      return { success: false, message: `Campos obrigatórios pendentes: ${missing.join(', ')}` }
    }
    return { success: true, message: 'Configuração válida' }
  }
}

module.exports = MarketplaceAdapter
