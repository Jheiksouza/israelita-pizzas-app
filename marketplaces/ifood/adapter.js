const MarketplaceAdapter = require('../shared/MarketplaceAdapter')

class IfoodAdapter extends MarketplaceAdapter {
  get platform() { return 'ifood' }
  get displayName() { return 'iFood' }
  get color() { return '#E53935' }

  getDefaultConfig() {
    return {
      enabled: false,
      client_id: '',
      client_secret: '',
      merchant_id: '',
      webhook_secret: ''
    }
  }

  getConfigFields() {
    return [
      { key: 'enabled', label: 'Habilitar integração', type: 'toggle' },
      { key: 'client_id', label: 'Client ID', type: 'text', section: 'credentials' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', section: 'credentials' },
      { key: 'merchant_id', label: 'Merchant ID (Código da Loja)', type: 'text', section: 'credentials', hint: 'Encontrado no Portal do Parceiro iFood em "Minha Loja"' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', section: 'webhook', hint: 'Envie este valor no header X-iFood-Webhook-Secret ao configurar o webhook' }
    ]
  }

  async validateWebhook(req, config) {
    const body = req.body
    if (!body || (!body.orderId && !body.id)) {
      return { valid: false }
    }
    const webhookSecret = req.headers['x-ifood-webhook-secret'] || req.query.secret
    if (config.webhook_secret && webhookSecret !== config.webhook_secret) {
      return { valid: false }
    }
    const event = body.event || body.eventType || ''
    const isNewOrder = !event || event === 'ORDER_CREATED' || event === 'PLACED' || body.status === 'PLACED' || body.status === 'CONFIRMED'
    return {
      valid: true,
      eventType: isNewOrder ? 'ORDER_CREATED' : 'OTHER',
      rawPayload: body
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
