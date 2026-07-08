const crypto = require('crypto')
const MarketplaceAdapter = require('../shared/MarketplaceAdapter')

class IfoodAdapter extends MarketplaceAdapter {
  constructor() {
    super()
    this._token = null
    this._tokenExpiresAt = 0
  }

  get platform() { return 'ifood' }
  get displayName() { return 'iFood' }
  get color() { return '#E53935' }

  getDefaultConfig() {
    return {
      enabled: false,
      client_id: '',
      client_secret: '',
      merchant_id: ''
    }
  }

  getConfigFields() {
    return [
      { key: 'enabled', label: 'Habilitar integração', type: 'toggle' },
      { key: 'client_id', label: 'Client ID', type: 'text', section: 'credentials' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', section: 'credentials' },
      { key: 'merchant_id', label: 'Merchant ID (Código da Loja)', type: 'text', section: 'credentials', hint: 'Encontrado no Portal do Desenvolvedor iFood em "Meus Apps"' }
    ]
  }

  async getAccessToken(config) {
    if (this._token && Date.now() < this._tokenExpiresAt) {
      return this._token
    }
    const params = new URLSearchParams({
      grantType: 'client_credentials',
      clientId: config.client_id,
      clientSecret: config.client_secret
    })
    const res = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
      throw new Error(err.error?.message || 'Falha na autenticação iFood')
    }
    const data = await res.json()
    this._token = data.accessToken
    this._tokenExpiresAt = Date.now() + (data.expiresIn || 21600) * 1000
    return this._token
  }

  async validateWebhook(req, config) {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return { valid: false }
    }

    // Validar assinatura HMAC SHA256 (exigido pelo iFood)
    const signature = req.headers['x-ifood-signature']
    if (signature && config.client_secret) {
      const rawBody = JSON.stringify(body)
      const expected = crypto.createHmac('sha256', config.client_secret).update(rawBody).digest('hex')
      if (signature !== expected) {
        return { valid: false }
      }
    }

    const event = body.event || body.eventType || body.type || ''

    // Evento de presença — iFood testa se o webhook está vivo
    if (event === 'PRESENCE' || event === 'presence') {
      return { valid: true, eventType: 'PRESENCE', rawPayload: body }
    }

    const isNewOrder = !event || event === 'ORDER_CREATED' || event === 'PLACED' || body.status === 'PLACED' || body.status === 'CONFIRMED'
    return {
      valid: true,
      eventType: isNewOrder ? 'ORDER_CREATED' : 'OTHER',
      rawPayload: body
    }
  }

  async testConnection(config) {
    if (!config.client_id) return { success: false, message: 'Client ID não informado' }
    if (!config.client_secret) return { success: false, message: 'Client Secret não informado' }
    if (!config.merchant_id) return { success: false, message: 'Merchant ID não informado' }
    try {
      const token = await this.getAccessToken(config)
      const tokenPreview = token ? token.substring(0, 20) + '...' : 'não obtido'
      return { success: true, message: `Conectado ao iFood (token: ${tokenPreview})` }
    } catch (err) {
      return { success: false, message: err.message || 'Erro de autenticação' }
    }
  }

  async toInternalOrder(rawPayload, config) {
    const orderData = rawPayload.order || rawPayload
    const customerData = orderData.customer || orderData.client || {}
    const addressData = customerData.deliveryAddress || customerData.address || {}
    const itemsData = orderData.items || orderData.products || []
    const orderCode = rawPayload.code || rawPayload.fullCode || rawPayload.orderId || rawPayload.id || ''

    const orderAmount = orderData.total?.orderAmount || orderData.total || orderData.orderAmount || 0
    const deliveryFee = orderData.total?.deliveryFee || orderData.deliveryFee || 0
    const discount = orderData.total?.discount || orderData.discount || 0
    const total = parseFloat(orderAmount) + parseFloat(deliveryFee) - parseFloat(discount)

    return {
      cliente: {
        nome: customerData.name || 'Cliente iFood',
        telefone: customerData.phone || '',
        endereco: addressData.streetName
          ? `${addressData.streetName || ''}, ${addressData.streetNumber || ''}${addressData.neighborhood ? ` - ${addressData.neighborhood}` : ''}`
          : 'Endereço iFood',
        origem: 'ifood',
        marketplace_order_id: orderCode
      },
      itens: itemsData.map((item, idx) => ({
        id: `ifood_${orderCode}_${idx}`,
        qtd: item.quantity || 1,
        nome: item.name || item.product || 'Item iFood',
        preco: parseFloat(item.unitPrice || item.price || 0),
        total: parseFloat(item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0) || 0)
      })),
      total: isNaN(total) ? 0 : total,
      entrega_lat: addressData.coordinates?.latitude || addressData.latitude ? parseFloat(addressData.coordinates?.latitude || addressData.latitude) : null,
      entrega_lng: addressData.coordinates?.longitude || addressData.longitude ? parseFloat(addressData.coordinates?.longitude || addressData.longitude) : null
    }
  }
}

module.exports = IfoodAdapter
