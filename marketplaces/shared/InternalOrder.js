function createInternalOrder({ cliente, itens, total, entrega_lat, entrega_lng }) {
  return {
    data: new Date().toISOString(),
    status: 'pendente',
    updatedAt: new Date().toISOString(),
    cliente,
    itens,
    total,
    user_id: null,
    entrega_lat: entrega_lat || null,
    entrega_lng: entrega_lng || null
  }
}

module.exports = { createInternalOrder }
