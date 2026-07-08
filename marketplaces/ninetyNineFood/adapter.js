const MarketplaceAdapter = require('../shared/MarketplaceAdapter')

class NinetyNineFoodAdapter extends MarketplaceAdapter {
  get platform() { return '99food' }
  get displayName() { return '99Food' }
  get color() { return '#FF6D00' }

  getDefaultConfig() {
    return {
      enabled: false,
      api_key: '',
      store_id: '',
      webhook_secret: ''
    }
  }

  getConfigFields() {
    return [
      { key: 'enabled', label: 'Habilitar integração', type: 'toggle' },
      { key: 'api_key', label: 'API Key', type: 'password', section: 'credentials' },
      { key: 'store_id', label: 'Store ID', type: 'text', section: 'credentials', hint: 'ID da sua loja no 99Food' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', section: 'webhook', hint: 'Token para validar requisições do webhook' }
    ]
  }

  async validateWebhook(req, config) {
    const body = req.body
    if (!body || (!body.orderId && !body.id && !body.order_id)) {
      return { valid: false }
    }
    const secret = req.headers['x-webhook-secret'] || req.query.secret
    if (config.webhook_secret && secret !== config.webhook_secret) {
      return { valid: false }
    }
    const event = body.event || body.eventType || body.type || ''
    const isNewOrder = !event || event === 'order.created' || event === 'ORDER_CREATED' || event === 'new_order'
    return {
      valid: true,
      eventType: isNewOrder ? 'ORDER_CREATED' : 'OTHER',
      rawPayload: body
    }
  }

  async toInternalOrder(rawPayload, config) {
    const orderData = rawPayload.order || rawPayload
    const orderCode = rawPayload.orderId || rawPayload.id || rawPayload.order_id || ''

    return {
      cliente: {
        nome: orderData.customer?.name || orderData.client?.name || 'Cliente 99Food',
        telefone: orderData.customer?.phone || orderData.client?.phone || '',
        endereco: orderData.delivery_address?.street
          ? `${orderData.delivery_address.street || ''}, ${orderData.delivery_address.number || ''}${orderData.delivery_address.neighborhood ? ` - ${orderData.delivery_address.neighborhood}` : ''}`
          : orderData.address || 'Endereço 99Food',
        origem: '99food',
        marketplace_order_id: orderCode
      },
      itens: (orderData.items || orderData.products || []).map((item, idx) => ({
        id: `99food_${orderCode}_${idx}`,
        qtd: item.quantity || item.qty || 1,
        nome: item.name || item.product_name || item.product || 'Item 99Food',
        preco: parseFloat(item.unit_price || item.unitPrice || item.price || 0),
        total: parseFloat(item.total_price || item.totalPrice || (item.quantity || item.qty || 1) * (item.unit_price || item.unitPrice || item.price || 0) || 0)
      })),
      total: parseFloat(orderData.total_amount || orderData.totalAmount || orderData.total || 0),
      entrega_lat: orderData.delivery_address?.latitude || orderData.latitude || null,
      entrega_lng: orderData.delivery_address?.longitude || orderData.longitude || null
    }
  }
}

module.exports = NinetyNineFoodAdapter
