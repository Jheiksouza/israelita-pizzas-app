const crypto = require('crypto')
const MarketplaceAdapter = require('../shared/MarketplaceAdapter')

const IFOOD_API = 'https://merchant-api.ifood.com.br'

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
      { key: 'merchant_id', label: 'Merchant ID', type: 'text', section: 'credentials', hint: 'ID da sua loja no iFood' }
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
    const res = await fetch(`${IFOOD_API}/authentication/v1.0/oauth/token`, {
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

  async apiFetch(path, config, options = {}) {
    const token = await this.getAccessToken(config)
    const res = await fetch(`${IFOOD_API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    if (!res.ok) {
      if (res.status === 401) {
        this._token = null
        this._tokenExpiresAt = 0
      }
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `iFood API ${res.status}`)
    }
    return res
  }

  async fetchOrderDetails(orderId, config) {
    const res = await this.apiFetch(`/order/v1.0/orders/${orderId}`, config)
    return res.json()
  }

  async acknowledgeEvents(eventIds, config) {
    if (!eventIds || eventIds.length === 0) return
    await this.apiFetch('/order/v1.0/orders:acknowledgment', config, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedEventIds: eventIds })
    })
  }

  async updateOrderStatus(orderId, status, config) {
    const pathMap = {
      confirmed: `/order/v1.0/orders/${orderId}/confirm`,
      preparation_started: `/order/v1.0/orders/${orderId}/startPreparation`,
      dispatched: `/order/v1.0/orders/${orderId}/dispatch`,
      ready_to_pickup: `/order/v1.0/orders/${orderId}/readyToPickup`
    }
    const path = pathMap[status]
    if (!path) return
    await this.apiFetch(path, config, { method: 'POST' })
  }

  async pollOrders(config) {
    const body = { events: ['PLACED', 'CONFIRMED'], groups: 'ALL' }
    if (config.merchant_id) {
      body.merchantId = config.merchant_id
    }
    const res = await this.apiFetch('/order/v1.0/orders:polling', config, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    const data = await res.json()
    return data.events || []
  }

  async validateWebhook(req, config) {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return { valid: false, eventType: 'INVALID' }
    }

    const signature = req.headers['x-ifood-signature']
    if (signature && config.client_secret) {
      const rawBody = req.rawBody || JSON.stringify(body)
      const expected = crypto.createHmac('sha256', config.client_secret).update(rawBody).digest('hex')
      if (signature !== expected) {
        return { valid: false, eventType: 'INVALID' }
      }
    }

    // iFood envia { events: [...] } ou { event, orderId }
    const events = body.events || (body.event ? [body] : [])

    if (events.length === 0) {
      return { valid: false, eventType: 'INVALID' }
    }

    return {
      valid: true,
      eventType: 'EVENTS',
      rawPayload: body,
      parsedEvents: events.map(e => ({
        id: e.id,
        code: e.code || e.fullCode || '',
        orderId: e.orderId || '',
        createdAt: e.createdAt,
        metadata: e.metadata || {}
      }))
    }
  }

  async toInternalOrder(rawPayload, config) {
    const orderData = rawPayload.order || rawPayload
    const orderCode = rawPayload.code || rawPayload.fullCode || rawPayload.orderId || rawPayload.id || ''

    const customerData = orderData.customer || orderData.client || {}
    const addressData = customerData.deliveryAddress || customerData.address || {}
    const itemsData = orderData.items || orderData.products || []
    const orderAmount = orderData.total?.orderAmount || orderData.total || orderData.orderAmount || 0
    const deliveryFee = orderData.total?.deliveryFee || orderData.deliveryFee || 0
    const discount = orderData.total?.discount || orderData.discount || 0
    const total = parseFloat(orderAmount) + parseFloat(deliveryFee) - parseFloat(discount)

    return {
      cliente: {
        nome: customerData.name || customerData.customer?.name || 'Cliente iFood',
        telefone: customerData.phone || customerData.customer?.phone || '',
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

  async testConnection(config) {
    if (!config.client_id) return { success: false, message: 'Client ID não informado' }
    if (!config.client_secret) return { success: false, message: 'Client Secret não informado' }
    if (!config.merchant_id) return { success: false, message: 'Merchant ID não informado' }
    try {
      const token = await this.getAccessToken(config)
      return { success: true, message: `Conectado ao iFood` }
    } catch (err) {
      return { success: false, message: err.message || 'Erro de autenticação' }
    }
  }
}

module.exports = IfoodAdapter
