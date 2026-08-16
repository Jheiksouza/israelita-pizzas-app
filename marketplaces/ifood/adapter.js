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
      merchant_id: '',
      auto_confirm: true
    }
  }

  getConfigFields() {
    return [
      { key: 'enabled', label: 'Habilitar integração', type: 'toggle' },
      { key: 'client_id', label: 'Client ID', type: 'text', section: 'credentials' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', section: 'credentials' },
      { key: 'merchant_id', label: 'Merchant ID', type: 'text', section: 'credentials', hint: 'ID da sua loja no iFood' },
      { key: 'auto_confirm', label: 'Confirmar automaticamente ao receber pedido', type: 'toggle', section: 'behavior', hint: 'Evita cancelamento automático do iFood (SLA máx. de 8 min). Desligue para confirmar manualmente no admin.' }
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
    const data = await res.json()
    console.log(`[ifood] 📦 Detalhes do pedido ${orderId}:`, JSON.stringify(data, null, 2))
    return data
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
    const body = status === 'dispatched' ? { deliveredBy: 'MERCHANT' } : undefined
    const options = body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'POST' }
    await this.apiFetch(path, config, options)
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
    const token = await this.getAccessToken(config)
    const body = { events: ['PLACED', 'CONFIRMED'], groups: 'ALL' }
    if (config.merchant_id) {
      body.merchantId = config.merchant_id
    }

    const baseHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

    let res = await fetch(`${IFOOD_API}/order/v1.0/orders:polling`, {
      headers: baseHeaders,
      method: 'POST',
      body: JSON.stringify(body)
    })

    // Fallback: alguns gateways do iFood só aceitam GET /orders:polling?limit=N
    if (res.status === 404 || res.status === 405) {
      console.warn('[ifood] POST /order/v1.0/orders:polling recusado, tentando GET ?limit=100')
      res = await fetch(`${IFOOD_API}/order/v1.0/orders:polling?limit=100`, {
        headers: baseHeaders
      })
    }

    if (!res.ok) {
      if (res.status === 401) {
        this._token = null
        this._tokenExpiresAt = 0
      }
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `iFood API ${res.status}`)
    }

    const data = await res.json()
    return data.events || []
  }

  async validateWebhook(req, config) {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return { valid: false, eventType: 'INVALID' }
    }

    const signature = req.headers['x-ifood-signature']
    if (config.client_secret) {
      // Payloads do /testeifood (pedido inline ou simulação com marcador) são isentos,
      // pois o iFood real nunca manda detalhes do pedido inline no webhook.
      const isTestPayload = !!(body && (
        (body.items && Array.isArray(body.items)) ||
        String(body?.metadata?.reason || '').includes('/testeifood')
      ))
      if (!signature && !isTestPayload) {
        return { valid: false, eventType: 'INVALID' }
      }
      if (signature) {
        const rawBody = req.rawBody || JSON.stringify(body)
        const expected = crypto.createHmac('sha256', config.client_secret).update(rawBody).digest('hex')
        const a = Buffer.from(signature, 'hex')
        const b = Buffer.from(expected, 'hex')
        const valido = a.length === b.length && crypto.timingSafeEqual(a, b)
        if (!valido) {
          return { valid: false, eventType: 'INVALID' }
        }
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

    const orderUuid = orderData.id || ''
    const displayId = orderData.displayId || orderUuid.substring(0, 8) || ''

    const customerData = orderData.customer || orderData.client || {}
    const addressData = orderData.delivery?.deliveryAddress || orderData.deliveryAddress || customerData.deliveryAddress || customerData.address || {}
    const itemsData = orderData.items || orderData.products || []
    const delivery = orderData.delivery || {}

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
      if (addr.complement) end += ` ***${addr.complement}***`
      if (addr.city || addr.state) end += `, ${addr.city || ''}${addr.state ? `/${addr.state}` : ''}`
      if (addr.reference) end += ` ***${addr.reference}***`
      if (addr.postalCode) end += ` — CEP: ${addr.postalCode}`
      return end
    }

    const formatPayments = (payments) => {
      if (!payments || !payments.methods || payments.methods.length === 0) return null
      return payments.methods.map(m => ({
        metodo: m.method || m.type || '',
        bandeira: m.brand || '',
        valor: m.value || 0,
        prepago: m.prepaid || false,
        troco: m.cash?.changeFor || m.changeFor || 0,
        tipo: m.type || '',
        cardBrand: m.card?.brand || m.brand || '',
        authorizationCode: m.transaction?.authorizationCode || '',
        parcelas: m.card?.installments || 0
      }))
    }

    const itemPrefix = displayId

    const flattenItems = (items) => {
      return items.map((item, idx) => {
        const qtd = item.quantity || 1
        const nome = item.name || item.product || 'Item iFood'
        const preco = parseFloat(item.unitPrice || item.price || 0)
        const total = parseFloat(item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0) || 0)

        const adicionais = (item.subItems || []).map((sub, subIdx) => ({
          id: `ifood_${itemPrefix}_${idx}_sub_${subIdx}`,
          qtd: sub.quantity || 1,
          nome: sub.name || sub.product || 'Adicional',
          preco: parseFloat(sub.unitPrice || sub.price || 0),
          total: parseFloat(sub.totalPrice || (sub.quantity || 1) * (sub.unitPrice || sub.price || 0) || 0),
          externalCode: sub.externalCode || ''
        }))

        const precoLinha = (o) => {
          const qty = o.quantity || 1
          const price = parseFloat(o.price || 0)
          const unitPrice = parseFloat(o.unitPrice || 0)
          const addition = parseFloat(o.addition || 0)
          let unit = unitPrice + addition
          if (!unitPrice && price > 0) unit = price / qty
          const total = parseFloat(o.totalPrice || price || unit * qty)
          return { unit, total }
        }

        const opcoes = (item.options || []).flatMap((opt, optIdx) => {
          const p = precoLinha(opt)
          const base = {
            id: `ifood_${itemPrefix}_${idx}_opt_${optIdx}`,
            qtd: opt.quantity || 1,
            nome: opt.name || 'Opção',
            grupo: opt.groupName || '',
            preco: p.unit,
            total: p.total,
            externalCode: opt.externalCode || '',
            type: opt.type || ''
          }
          const customs = (opt.customizations || opt.customization || []).map((cust, custIdx) => {
            const cp = precoLinha(cust)
            return {
              id: `ifood_${itemPrefix}_${idx}_opt_${optIdx}_cust_${custIdx}`,
              qtd: cust.quantity || 1,
              nome: cust.name || 'Customização',
              grupo: opt.groupName || cust.groupName || '',
              preco: cp.unit,
              total: cp.total,
              externalCode: cust.externalCode || '',
              type: cust.type || ''
            }
          })
          return [base, ...customs]
        })

        return {
          id: `ifood_${itemPrefix}_${idx}`,
          qtd,
          nome,
          preco,
          total,
          externalCode: item.externalCode || '',
          observacoes: item.observations || '',
          type: item.type || '',
          imageUrl: item.imageUrl || '',
          adicionais,
          opcoes
        }
      })
    }

    const totalObj = orderData.total || {}
    const total = parseFloat(totalObj.orderAmount || 0) ||
      (parseFloat(totalObj.subTotal || 0) + parseFloat(totalObj.deliveryFee || 0) + parseFloat(totalObj.additionalFees || 0) - parseFloat(totalObj.benefits || 0))

    const pagamento = formatPayments(orderData.payments)

    const totalDetalhe = {
      subTotal: parseFloat(totalObj.subTotal || 0),
      deliveryFee: parseFloat(totalObj.deliveryFee || 0),
      additionalFees: parseFloat(totalObj.additionalFees || 0),
      benefits: parseFloat(totalObj.benefits || 0),
      orderAmount: isNaN(total) ? 0 : total,
      benefitsList: Array.isArray(orderData.benefits)
        ? orderData.benefits.map(b => ({
            valor: parseFloat(b.value || 0),
            alvo: b.target || '',
            targetId: b.targetId || '',
            nome: b.campaign?.name || '',
            descricao: b.campaign?.description || '',
            patrocinio: (b.sponsorshipValues || []).map(sv => ({
              nome: sv.name || '',
              valor: parseFloat(sv.value || 0)
            }))
          }))
        : [],
      additionalFeesList: Array.isArray(orderData.additionalFees)
        ? orderData.additionalFees.map(f => ({
            tipo: f.type || '',
            descricao: f.description || '',
            valor: parseFloat(f.value || 0)
          }))
        : []
    }

    const lat = addressData.coordinates?.latitude ?? addressData.latitude
    const lng = addressData.coordinates?.longitude ?? addressData.longitude

    return {
      cliente: {
        nome: customerData.name || 'Cliente iFood',
        telefone: formatPhone(customerData.phone),
        endereco: formatAddress(addressData),
        origem: 'ifood',
        marketplace_order_id: orderUuid,
        displayId,
        cpf: customerData.cpf || customerData.documentNumber || customerData.document || customerData.taxPayerIdentificationNumber || '',
        documentType: customerData.documentType || '',
        pagamento,
        observacoes: delivery.observations || orderData.observations || '',
        codigo_coleta: delivery.pickupCode || '',
        metodo_entrega: delivery.deliveredBy || delivery.mode || '',
        deliveryMode: delivery.mode || '',
        deliveryDateTime: delivery.deliveryDateTime || '',
        createdAt: orderData.createdAt || '',
        category: orderData.category || '',
        orderType: orderData.orderType || '',
        orderTiming: orderData.orderTiming || '',
        salesChannel: orderData.salesChannel || '',
        isTest: orderData.isTest || false,
        taxas_adicionais: orderData.additionalFees || [],
        merchantId: orderData.merchant?.id || '',
        merchantName: orderData.merchant?.name || '',
        phoneLocalizer: customerData.phone?.localizer || ''
      },
      itens: flattenItems(itemsData),
      total: isNaN(total) ? 0 : total,
      totalDetalhe,
      entrega_lat: lat != null ? parseFloat(lat) : null,
      entrega_lng: lng != null ? parseFloat(lng) : null
    }
  }

  async catalogFetch(path, config, options = {}) {
    const versions = ['v2.0', 'v1.0']
    let lastErr
    for (const version of versions) {
      try {
        const res = await this.apiFetch(`/catalog/${version}${path}`, config, options)
        return res
      } catch (err) {
        lastErr = err
        if (!err.message?.includes('403') && !err.message?.includes('404')) throw err
      }
    }
    // Se chegou aqui, tentou v2.0 e v1.0 e ambos falharam
    if (lastErr?.message?.includes('403')) {
      throw new Error('Acesso não autorizado. É necessário habilitar o módulo "Catalog" no Portal do Parceiro iFood (developer.ifood.com.br). Verifique também se o Client ID/Secret têm permissão de catálogo.')
    }
    throw lastErr
  }

  async getCatalogs(config) {
    const merchantId = config.merchant_id
    const res = await this.catalogFetch(`/merchants/${merchantId}/catalogs`, config)
    const data = await res.json()
    return data.catalogs || data
  }

  async getCategories(catalogId, config) {
    const merchantId = config.merchant_id
    const res = await this.catalogFetch(`/merchants/${merchantId}/catalogs/${catalogId}/categories`, config)
    const data = await res.json()
    console.error(`[ifood] getCategories raw:`, JSON.stringify(data).slice(0, 1000))
    return data.categories || data
  }

  async createCategory(catalogId, name, config) {
    const merchantId = config.merchant_id
    const res = await this.catalogFetch(`/merchants/${merchantId}/catalogs/${catalogId}/categories`, config, {
      method: 'POST',
      body: JSON.stringify({ name, status: 'AVAILABLE', template: 'DEFAULT' })
    })
    const data = await res.json()
    return data
  }

  async pushItem(itemData, config) {
    const merchantId = config.merchant_id
    const res = await this.catalogFetch(`/merchants/${merchantId}/items`, config, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    })
    return res.json()
  }

  async updateItemStatus(itemId, status, config) {
    const merchantId = config.merchant_id
    const res = await this.catalogFetch(`/merchants/${merchantId}/items/status`, config, {
      method: 'PATCH',
      body: JSON.stringify([{ id: itemId, status }])
    })
    return res.json()
  }

  async syncMenu(menuItems, config) {
    const merchantId = config.merchant_id
    const results = { created: 0, updated: 0, errors: [] }

    // 1. Get catalogs
    let catalogs
    try {
      catalogs = await this.getCatalogs(config)
    } catch (err) {
      throw new Error(`Erro ao listar catálogos: ${err.message}`)
    }
    const defaultCatalog = Array.isArray(catalogs) ? catalogs.find(c => c.catalogId || c.id) : null
    if (!defaultCatalog) throw new Error('Nenhum catálogo encontrado')

    const catalogId = defaultCatalog.catalogId || defaultCatalog.id

    // 2. Get existing categories
    let existingCategories
    try {
      existingCategories = await this.getCategories(catalogId, config)
    } catch { existingCategories = [] }

    // 3. Build category map (name → id)
    const categoryMap = {}
    if (Array.isArray(existingCategories)) {
      existingCategories.forEach(c => {
        if (c.name) categoryMap[c.name] = c.id || c.categoryId
      })
    }

    // 4. Ensure categories for our items exist
    const neededCategories = [...new Set(menuItems.map(i => i.categoria).filter(Boolean))]
    for (const catName of neededCategories) {
      if (!categoryMap[catName]) {
        try {
          const created = await this.createCategory(catalogId, catName, config)
          const catId = created.id || created.categoryId
          if (catId) categoryMap[catName] = catId
        } catch (err) {
          results.errors.push(`Erro ao criar categoria "${catName}": ${err.message}`)
        }
      }
    }

    // 5. Push each item
    for (const item of menuItems) {
      try {
        const categoryId = categoryMap[item.categoria]

        if (item.tipo === 'produto') {
          const payload = {
            merchantId,
            externalCode: `menu_${item.id}`,
            name: item.nome,
            description: item.descricao || '',
            type: 'PRODUCT',
            status: item.disponivel !== false ? 'AVAILABLE' : 'UNAVAILABLE',
            price: { value: item.preco || 0, originalValue: item.preco || 0 },
            categoryId,
            product: {
              name: item.nome,
              description: item.descricao || '',
              imageUrl: item.imagem || '',
              ean: ''
            }
          }
          await this.pushItem(payload, config)
          results.created++
        } else if (item.tipo === 'tamanho') {
          // Create one item per price tier
          const tiers = [
            { key: 'preco_tradicional', label: 'Tradicional' },
            { key: 'preco_especial', label: 'Especial' },
            { key: 'preco_nobre', label: 'Nobre' }
          ]
          for (const tier of tiers) {
            const price = item[tier.key]
            if (price != null && price > 0) {
              const payload = {
                merchantId,
                externalCode: `menu_${item.id}_${tier.label.toLowerCase()}`,
                name: `${item.nome} ${tier.label}`,
                description: item.descricao || '',
                type: 'PRODUCT',
                status: item.disponivel !== false ? 'AVAILABLE' : 'UNAVAILABLE',
                price: { value: price, originalValue: price },
                categoryId,
                product: {
                  name: `${item.nome} ${tier.label}`,
                  description: item.descricao || '',
                  imageUrl: item.imagem || '',
                  ean: ''
                }
              }
              await this.pushItem(payload, config)
              results.created++
            }
          }
        } else if (item.tipo === 'sabor') {
          // Flavors are pushed as simple items; they can be used as options via externalCode
          const payload = {
            merchantId,
            externalCode: `menu_${item.id}`,
            name: item.nome,
            description: item.descricao || '',
            type: 'PRODUCT',
            status: item.disponivel !== false ? 'AVAILABLE' : 'UNAVAILABLE',
            price: { value: 0, originalValue: 0 },
            categoryId,
            product: {
              name: item.nome,
              description: item.descricao || '',
              imageUrl: item.imagem || '',
              ean: ''
            }
          }
          await this.pushItem(payload, config)
          results.created++
        }
      } catch (err) {
        results.errors.push(`Item #${item.id} "${item.nome}": ${err.message}`)
      }
    }

    return results
  }

  async importMenu(config) {
    const catalogs = await this.getCatalogs(config)
    const defaultCatalog = Array.isArray(catalogs) ? catalogs.find(c => c.catalogId || c.id) : null
    if (!defaultCatalog) throw new Error('Nenhum catálogo encontrado')
    const catalogId = defaultCatalog.catalogId || defaultCatalog.id

    const categories = await this.getCategories(catalogId, config)
    if (!Array.isArray(categories)) throw new Error('Nenhuma categoria encontrada')

    const results = { created: 0, updated: 0, errors: [] }
    const items = []

    for (const cat of categories) {
      const catId = cat.id || cat.categoryId
      const catName = cat.name
      if (!catId || !catName) continue

      try {
        const res = await this.catalogFetch(`/merchants/${config.merchant_id}/categories/${catId}/items`, config)
        const data = await res.json()
        const fetchedItems = data.items || (Array.isArray(data) ? data : [])
        if (Array.isArray(fetchedItems)) {
          for (const fullItem of fetchedItems) {
            try {
              const item = fullItem.item || fullItem
              const product = fullItem.products?.[0] || {}
              const name = item.name || product.name || ''
              if (!name) continue
              items.push({
                nome: name,
                descricao: item.description || product.description || '',
                preco: item.price?.value || 0,
                categoria: catName,
                imagem: product.imagePath || '',
                tipo: 'produto',
                disponivel: item.status === 'AVAILABLE',
                externalCode: item.externalCode || ''
              })
            } catch (err) {
              results.errors.push(`Erro ao processar item em "${catName}": ${err.message}`)
            }
          }
        }
      } catch (err) {
        results.errors.push(`Erro ao buscar itens da categoria "${catName}": ${err.message}`)
      }
    }

    return { items, results }
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
