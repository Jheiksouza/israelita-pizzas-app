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

  async getCancellationReasons(orderId, config) {
    const res = await this.apiFetch(`/order/v1.0/orders/${orderId}/cancellationReasons`, config)
    return res.json()
  }

  async requestCancellation(orderId, reasonCode, config) {
    await this.apiFetch(`/order/v1.0/orders/${orderId}/requestCancellation`, config, {
      method: 'POST',
      body: JSON.stringify({ reason: reasonCode })
    })
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

    // iFood envia o evento diretamente no body (não dentro de { events: [...] })
    // Formato: { id, code, fullCode, orderId, createdAt, metadata }
    // ou { events: [...] } (menos comum)
    const events = body.events
      ? body.events
      : body.id
        ? [body]
        : []

    if (events.length === 0) {
      return { valid: false, eventType: 'INVALID' }
    }

    return {
      valid: true,
      eventType: 'EVENTS',
      rawPayload: body,
      parsedEvents: events.map(e => ({
        id: e.id,
        code: e.fullCode || e.code || '',
        orderId: e.orderId || e.metadata?.orderId || '',
        createdAt: e.createdAt,
        metadata: e.metadata || e
      }))
    }
  }

  async toInternalOrder(rawPayload, config) {
    const orderData = rawPayload.order || rawPayload
    const orderCode = rawPayload.code || rawPayload.fullCode || rawPayload.orderId || rawPayload.id || ''

    const customerData = orderData.customer || orderData.client || {}
    const addressData = orderData.delivery?.deliveryAddress || orderData.deliveryAddress || customerData.deliveryAddress || customerData.address || {}
    const itemsData = orderData.items || orderData.products || []

    const formatPhone = (phone) => {
      if (!phone) return ''
      if (typeof phone === 'object') return phone.number || phone.phone || ''
      return String(phone)
    }

    const formatAddress = (addr) => {
      if (!addr) return 'Endereço iFood'
      let end = addr.streetName
        ? `${addr.streetName}, ${addr.streetNumber || 's/n'}`
        : addr.formattedAddress || 'Endereço iFood'
      if (addr.neighborhood) end += ` - ${addr.neighborhood}`
      if (addr.complement) end += ` (${addr.complement})`
      if (addr.city || addr.state) end += `, ${addr.city || ''}${addr.state ? `/${addr.state}` : ''}`
      if (addr.reference) end += ` [${addr.reference}]`
      return end
    }

    const formatPayments = (payments) => {
      if (!payments || !payments.methods || payments.methods.length === 0) return null
      return payments.methods.map(m => ({
        metodo: m.method || m.type || '',
        bandeira: m.brand || '',
        valor: m.value || 0,
        prepago: m.prepaid || false,
        troco: m.changeFor || 0
      }))
    }

    const flattenItems = (items) => {
      const result = []
      items.forEach((item, idx) => {
        const qtd = item.quantity || 1
        const nome = item.name || item.product || 'Item iFood'
        const preco = parseFloat(item.unitPrice || item.price || 0)
        const total = parseFloat(item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0) || 0)
        result.push({
          id: `ifood_${orderCode}_${idx}`,
          qtd,
          nome,
          preco,
          total
        })
        if (item.subItems && item.subItems.length > 0) {
          item.subItems.forEach((sub, subIdx) => {
            result.push({
              id: `ifood_${orderCode}_${idx}_sub_${subIdx}`,
              qtd: sub.quantity || 1,
              nome: `  ➥ ${sub.name || sub.product || 'Adicional'}`,
              preco: parseFloat(sub.unitPrice || sub.price || 0),
              total: parseFloat(sub.totalPrice || (sub.quantity || 1) * (sub.unitPrice || sub.price || 0) || 0)
            })
          })
        }
        if (item.options && item.options.length > 0) {
          item.options.forEach((opt, optIdx) => {
            result.push({
              id: `ifood_${orderCode}_${idx}_opt_${optIdx}`,
              qtd: 1,
              nome: `  ➥ ${opt.name || 'Opção'}: ${opt.optionName || opt.value || ''}`,
              preco: parseFloat(opt.price || 0),
              total: parseFloat(opt.price || 0)
            })
          })
        }
      })
      return result
    }

    const orderAmount = orderData.total?.orderAmount || orderData.total?.subTotal || orderData.total || orderData.orderAmount || 0
    const deliveryFee = orderData.total?.deliveryFee || orderData.deliveryFee || 0
    const discount = orderData.total?.discount || orderData.discount || 0
    const total = parseFloat(typeof orderAmount === 'object' ? orderAmount.total || 0 : orderAmount) + parseFloat(deliveryFee) - parseFloat(discount)

    const pagamento = formatPayments(orderData.payments)
    const delivery = orderData.delivery || {}

    return {
      cliente: {
        nome: customerData.name || 'Cliente iFood',
        telefone: formatPhone(customerData.phone),
        endereco: formatAddress(addressData),
        origem: 'ifood',
        marketplace_order_id: orderCode,
        cpf: customerData.cpf || '',
        pagamento,
        observacoes: delivery.observations || orderData.observations || '',
        codigo_coleta: delivery.pickupCode || '',
        metodo_entrega: delivery.deliveredBy || delivery.mode || '',
        teste: orderData.isTest || false
      },
      itens: flattenItems(itemsData),
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
