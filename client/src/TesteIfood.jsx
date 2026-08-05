import React, { useState, useEffect, useCallback } from 'react'

const API = '/api'

const STATUS_LABELS = {
  pendente: 'Pendente',
  aceito: 'Em preparo',
  liberado: 'Saiu p/ entrega',
  em_rota: 'Em rota',
  entregador_proximo: 'Chegando!',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
}

const STATUS_COLORS = {
  pendente: '#E6A23C',
  aceito: '#409EFF',
  liberado: '#9254de',
  em_rota: '#E6A23C',
  entregador_proximo: '#E6A23C',
  entregue: '#67C23A',
  cancelado: '#F56C6C'
}

const IFOOD_STATUS_LABELS = {
  confirmed: 'CONFIRMED',
  preparation_started: 'PREPARATION_STARTED',
  dispatched: 'DISPATCHED',
  ready_to_pickup: 'READY_TO_PICKUP',
  requestCancellation: 'CANCELLED (solicitado)'
}

const s = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: 20, color: '#111' },
  h1: { fontSize: 20 },
  hint: { background: '#fff3cd', border: '1px solid #ffc107', padding: '10px 12px', borderRadius: 6, fontSize: 13, lineHeight: 1.5 },
  bar: { display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' },
  button: { padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #ddd', background: '#f5f5f5' },
  td: { padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 600 },
  mpid: { fontFamily: 'monospace', fontSize: 11, color: '#777', wordBreak: 'break-all' },
  msg: { fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#111', color: '#0f0', padding: 10, borderRadius: 6, maxHeight: 300, overflow: 'auto' },
  section: { background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, padding: 14, marginBottom: 14 },
  sectionTitle: { margin: 0, marginBottom: 10, fontSize: 14, fontWeight: 700 },
  input: { padding: '6px 8px', border: '1px solid #ccc', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' },
  label: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#555' },
  hintText: { fontSize: 11, color: '#777', fontStyle: 'italic', lineHeight: 1.3 },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 },
  itemBox: { border: '1px dashed #ccc', borderRadius: 6, padding: 10, marginBottom: 10 },
  panelTitle: { fontSize: 14, margin: 0, marginBottom: 6, fontWeight: 700 },
  entry: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, padding: '8px 10px', marginBottom: 6 },
  panel: { flex: '1 1 380px', minWidth: 280, fontSize: 13 }
}

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour12: false })
}

function shortId(id) {
  if (!id) return '-'
  return id.length > 12 ? id.slice(0, 12) + '…' : id
}

function isRetirada(p) {
  const c = p?.cliente || {}
  const modo = (c.orderType || c.deliveryMode || c.metodo_entrega || '').toUpperCase()
  const categoria = (c.category || '').toUpperCase()
  return ['TAKEOUT', 'PICKUP', 'SELF_SERVICE', 'INDOOR'].includes(modo) || categoria === 'FOOD_SELF_SERVICE'
}

const campo = (label, valor, onChange, props = {}) => (
  <label style={s.label}>
    {label}
    <input
      style={s.input}
      value={valor}
      onChange={e => onChange(e.target.value)}
      {...props}
    />
  </label>
)

const ORDERTYPE_OPCOES = [
  { value: 'DELIVERY', desc: 'Entrega: a loja entrega na casa do cliente.' },
  { value: 'TAKEOUT', desc: 'Retirada: o cliente vai retirar na loja.' },
  { value: 'INDOOR', desc: 'Consumo no local (balcão/mesa da loja).' }
]

const CATEGORY_OPCOES = [
  { value: 'FOOD', desc: 'Pedido de comida normal (entrega ou retirada).' },
  { value: 'FOOD_SELF_SERVICE', desc: 'Autoatendimento na loja (kiosque/balcão).' },
  { value: 'ANOTAI', desc: 'Pedido anotai (cardápio digital do restaurante).' }
]

const TIMING_OPCOES = [
  { value: 'IMMEDIATE', desc: 'Preparar e entregar o mais breve possível.' },
  { value: 'SCHEDULED', desc: 'Preparar no horário agendado (pedido programado).' }
]

const CHANNEL_OPCOES = [
  { value: 'IFOOD', desc: 'Pedido feito pelo app do iFood.' },
  { value: 'PHONE', desc: 'Pedido feito por telefone.' },
  { value: 'MERCHANT', desc: 'Pedido feito na própria loja (balcão).' }
]

const DELIVEREDBY_OPCOES = [
  { value: 'IFOOD', desc: 'Entrega feita pelo iFood.' },
  { value: 'MERCHANT', desc: 'Entrega feita pela própria loja.' },
  { value: 'VENDOR', desc: 'Entrega feita por parceiro/fornecedor.' }
]

const METODO_OPCOES = [
  { value: 'CREDIT', desc: 'Cartão de crédito.' },
  { value: 'DEBIT', desc: 'Cartão de débito.' },
  { value: 'CASH', desc: 'Dinheiro.' },
  { value: 'PIX', desc: 'Pix.' },
  { value: 'MEAL_TICKET', desc: 'Vale refeição/alimentação.' },
  { value: 'VOUCHER', desc: 'Voucher/convênio.' },
  { value: 'GIFT', desc: 'Vale presente.' },
  { value: 'CARD', desc: 'Cartão cadastrado (method genérico).' },
  { value: 'OTHERS', desc: 'Outros.' }
]

const TIPO_OPCOES = [
  { value: 'ONLINE', desc: 'Pagamento online no app.' },
  { value: 'CARD_ON_DELIVERY', desc: 'Cartão na entrega (maquininha).' },
  { value: 'CARD_ON_PICKUP', desc: 'Cartão na retirada (maquininha na loja).' },
  { value: 'CASH', desc: 'Dinheiro na entrega/retirada.' },
  { value: 'PIX', desc: 'Pix.' },
  { value: 'MEAL_TICKET', desc: 'Vale refeição/alimentação.' },
  { value: 'VOUCHER', desc: 'Voucher/convênio.' },
  { value: 'GIFT', desc: 'Vale presente.' },
  { value: 'OTHERS', desc: 'Outros.' }
]

const CARDBRAND_OPCOES = [
  { value: 'VISA', desc: 'Visa.' },
  { value: 'MASTER', desc: 'Mastercard.' },
  { value: 'ELO', desc: 'Elo.' },
  { value: 'AMEX', desc: 'American Express.' },
  { value: 'HIPERCARD', desc: 'Hipercard.' },
  { value: 'HIPER', desc: 'Hiper.' },
  { value: 'DINERS', desc: 'Diners Club.' },
  { value: 'DISCOVER', desc: 'Discover.' },
  { value: 'VR', desc: 'VR (vale refeição).' },
  { value: 'ALELO', desc: 'Alelo (vale refeição).' },
  { value: 'SODEXO', desc: 'Sodexo (vale refeição).' },
  { value: 'CABAL', desc: 'Cabal.' }
]

const SelectField = ({ label, valor, onChange, opcoes }) => {
  const atual = opcoes.find(o => o.value === valor)
  return (
    <label style={s.label}>
      {label}
      <select style={s.input} value={valor} onChange={e => onChange(e.target.value)}>
        {opcoes.map(o => (
          <option key={o.value} value={o.value}>{o.value}</option>
        ))}
      </select>
      <span style={s.hintText}>{atual ? atual.desc : '—'}</span>
    </label>
  )
}

export default function TesteIfood() {
  const [pedidos, setPedidos] = useState([])
  const [log, setLog] = useState([])
  const [syncLog, setSyncLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [resposta, setResposta] = useState('')

  const [form, setForm] = useState(() => ({
    oid: `pedido_teste_${Date.now()}`,
    displayId: 'Teste-001',
    orderType: 'DELIVERY',
    category: 'FOOD',
    orderTiming: 'IMMEDIATE',
    salesChannel: 'IFOOD',
    isTest: true,
    deliveryFee: '0',
    benefits: '0',
    merchant: { id: 'loja_teste_001', name: 'Israelita Pizzas' },
    cliente: { nome: 'Cliente Teste', telefone: '11999999999', phoneLocalizer: '+55', cpf: '12345678901', documentType: 'CPF' },
    endereco: { streetName: 'Rua Teste', streetNumber: '123', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', complement: 'Apto 1', reference: 'Próximo ao mercado', postalCode: '01000-000', lat: '', lng: '' },
    entrega: { mode: 'DELIVERY', deliveredBy: 'IFOOD', obs: '', pickupCode: '', table: '', data: '' },
    pagamentos: [{ method: 'CREDIT', type: 'ONLINE', value: '', prepaid: true, changeFor: '0', cardBrand: 'VISA', authorizationCode: '123456', installments: '1' }],
    itens: [{ nome: 'Pizza Calabresa', qtd: 1, unitPrice: '50', externalCode: 'menu_1', observacoes: '', adicionais: [], opcoes: [] }]
  }))

  const setF = (path) => (valor) => {
    const keys = path.split('.')
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      let ref = next
      for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]]
      ref[keys[keys.length - 1]] = valor
      return next
    })
  }

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/orders`)
      const data = await r.json()
      const arr = Array.isArray(data) ? data : []
      arr.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
      setPedidos(arr)
    } catch (e) {
      setResposta('Erro ao carregar pedidos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarLog = useCallback(async () => {
    try {
      const r = await fetch(`${API}/marketplace/debug/log`)
      const data = await r.json()
      setLog(Array.isArray(data) ? data : [])
    } catch (_) {}
  }, [])

  const carregarSyncLog = useCallback(async () => {
    try {
      const r = await fetch(`${API}/marketplace/debug/sync-log`)
      const data = await r.json()
      setSyncLog(Array.isArray(data) ? data : [])
    } catch (_) {}
  }, [])

  useEffect(() => {
    carregar()
    carregarLog()
    carregarSyncLog()
    const id = setInterval(() => {
      carregar()
      carregarLog()
      carregarSyncLog()
    }, 5000)
    return () => clearInterval(id)
  }, [carregar, carregarLog, carregarSyncLog])

  const simularEvento = async (pedido, fullCode) => {
    const mpid = pedido.cliente?.marketplace_order_id
    if (!mpid) {
      setResposta(`Pedido #${pedido.id} não tem marketplace_order_id (não é pedido iFood)`)
      return
    }
    const codigos = { CANCELLED: 'CAN', CONCLUDED: 'CON' }
    const code = codigos[fullCode] || fullCode
    const body = {
      id: `evt_sim_${fullCode}_${Date.now()}`,
      code,
      fullCode,
      orderId: mpid,
      createdAt: new Date().toISOString(),
      metadata: { orderId: mpid, status: fullCode, reason: 'Simulação manual pela página /testeifood' }
    }
    setResposta(`Enviando ${fullCode} para o pedido #${pedido.id} (${mpid})...\n`)
    try {
      const r = await fetch(`${API}/marketplace/ifood/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const text = await r.text()
      setResposta(`Enviado ${fullCode} para #${pedido.id} → HTTP ${r.status}\n${text}\n\nRecarregando lista...`)
      setTimeout(async () => {
        await carregar()
        await carregarLog()
        await carregarSyncLog()
      }, 800)
    } catch (e) {
      setResposta(`Erro ao enviar: ${e.message}`)
    }
  }

  const totalCalculado = form.itens.reduce((acc, it) => {
    const base = (parseFloat(it.qtd) || 0) * (parseFloat(it.unitPrice) || 0)
    const ad = (it.adicionais || []).reduce((a, x) => a + (parseFloat(x.qtd) || 0) * (parseFloat(x.unitPrice) || 0), 0)
    const op = (it.opcoes || []).reduce((a, x) => a + (parseFloat(x.qtd) || 0) * (parseFloat(x.unitPrice) || 0), 0)
    return acc + base + ad + op
  }, 0)

  const totalOrder = totalCalculado + (parseFloat(form.deliveryFee) || 0) - (parseFloat(form.benefits) || 0)
  const totalPago = form.pagamentos.reduce((acc, p) => acc + (parseFloat(p.value) || 0), 0)
  const restante = totalOrder - totalPago

  const criarPedido = async () => {
    const itens = form.itens.map(it => ({
      name: it.nome,
      quantity: parseInt(it.qtd) || 1,
      unitPrice: parseFloat(it.unitPrice) || 0,
      totalPrice: (parseInt(it.qtd) || 1) * (parseFloat(it.unitPrice) || 0),
      externalCode: it.externalCode || '',
      observations: it.observacoes || '',
      type: 'PRODUCT',
      subItems: (it.adicionais || []).filter(a => a.nome).map(a => ({
        name: a.nome,
        quantity: parseInt(a.qtd) || 1,
        unitPrice: parseFloat(a.unitPrice) || 0,
        totalPrice: (parseInt(a.qtd) || 1) * (parseFloat(a.unitPrice) || 0),
        externalCode: a.externalCode || ''
      })),
      options: (it.opcoes || []).filter(o => o.nome).map(o => ({
        id: `op_${it.nome || 'item'}_${o.nome}`,
        name: o.nome,
        groupName: o.grupo || '',
        quantity: parseInt(o.qtd) || 1,
        unitPrice: parseFloat(o.unitPrice) || 0,
        price: parseFloat(o.unitPrice) || 0,
        totalPrice: (parseInt(o.qtd) || 1) * (parseFloat(o.unitPrice) || 0),
        addition: 0,
        externalCode: ''
      }))
    }))

    const pagamentosValidos = form.pagamentos.filter(p => p.method)
    let assigned = 0
    const methods = pagamentosValidos.map(p => {
      let valor = parseFloat(p.value)
      if (!(valor > 0)) valor = Math.max(0, totalOrder - assigned)
      assigned += valor
      const m = {
        method: p.method,
        type: p.type,
        value: valor,
        prepaid: !!p.prepaid,
        currency: 'BRL'
      }
      const changeFor = parseFloat(p.changeFor) || 0
      if (changeFor > 0) m.cash = { changeFor }
      const parcelas = parseInt(p.installments) || 0
      if (p.cardBrand || parcelas > 1) m.card = { ...(p.cardBrand ? { brand: p.cardBrand } : {}), ...(parcelas > 1 ? { installments: parcelas } : {}) }
      if (p.authorizationCode) m.transaction = { authorizationCode: p.authorizationCode }
      return m
    })
    const hasPayment = methods.length > 0
    const prepagoTotal = methods.reduce((a, m) => a + (m.prepaid ? m.value : 0), 0)

    const nowIso = new Date().toISOString()
    const deliveryDateTime = form.entrega.data ? new Date(form.entrega.data).toISOString() : nowIso

    const body = {
      id: form.oid,
      code: 'PLC',
      fullCode: 'PLACED',
      orderId: form.oid,
      createdAt: nowIso,
      metadata: { orderId: form.oid, status: 'PLACED', orderType: form.orderType, category: form.category, isTest: form.isTest },
      displayId: form.displayId,
      orderType: form.orderType,
      category: form.category,
      orderTiming: form.orderTiming,
      salesChannel: form.salesChannel,
      isTest: form.isTest,
      merchant: { id: form.merchant.id, name: form.merchant.name },
      customer: {
        name: form.cliente.nome,
        cpf: form.cliente.cpf,
        documentNumber: form.cliente.cpf,
        documentType: form.cliente.documentType,
        phone: { number: form.cliente.telefone, localizer: form.cliente.phoneLocalizer }
      },
      items: itens,
      total: {
        orderAmount: totalOrder,
        subTotal: totalCalculado,
        deliveryFee: parseFloat(form.deliveryFee) || 0,
        benefits: parseFloat(form.benefits) || 0,
        additionalFees: 0
      },
      additionalFees: [],
      payments: hasPayment ? { methods, prepaid: prepagoTotal, pending: Math.max(0, totalOrder - prepagoTotal) } : null,
      delivery: {
        mode: form.entrega.mode,
        deliveredBy: form.entrega.deliveredBy,
        observations: form.entrega.obs,
        pickupCode: form.entrega.pickupCode,
        deliveryDateTime,
        deliveryAddress: {
          streetName: form.endereco.streetName,
          streetNumber: form.endereco.streetNumber,
          neighborhood: form.endereco.neighborhood,
          city: form.endereco.city,
          state: form.endereco.state,
          complement: form.endereco.complement,
          reference: form.endereco.reference,
          postalCode: form.endereco.postalCode,
          coordinates: { latitude: parseFloat(form.endereco.lat) || null, longitude: parseFloat(form.endereco.lng) || null }
        }
      },
      ...(form.orderType === 'TAKEOUT'
        ? { takeout: { mode: form.entrega.mode, pickupCode: form.entrega.pickupCode, takeoutDateTime: deliveryDateTime } }
        : {}),
      ...(form.orderType === 'INDOOR'
        ? { indoor: { mode: form.entrega.mode, table: form.entrega.table, deliveryDateTime } }
        : {})
    }

    setResposta(`Enviando pedido de teste (${form.oid}) para o webhook...\n`)
    try {
      const r = await fetch(`${API}/marketplace/ifood/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const text = await r.text()
      setResposta(`Pedido enviado → HTTP ${r.status}\n${text}\n\nTotal enviado: R$ ${totalOrder.toFixed(2)}\nRecarregando lista...`)
      setTimeout(async () => {
        await carregar()
        await carregarLog()
      }, 800)
    } catch (e) {
      setResposta(`Erro ao enviar: ${e.message}`)
    }
  }

  const setItem = (idx, campoNome, valor) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.itens[idx][campoNome] = valor
      return next
    })
  }

  const addItem = () => {
    setForm(prev => ({ ...prev, itens: [...prev.itens, { nome: '', qtd: 1, unitPrice: '', externalCode: '', observacoes: '', adicionais: [], opcoes: [] }] }))
  }

  const remItem = (idx) => {
    setForm(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }))
  }

  const setAdicional = (iIdx, aIdx, campoNome, valor) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.itens[iIdx].adicionais[aIdx][campoNome] = valor
      return next
    })
  }

  const setOpcao = (iIdx, oIdx, campoNome, valor) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.itens[iIdx].opcoes[oIdx][campoNome] = valor
      return next
    })
  }

  const setPagamento = (idx, campoNome, valor) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.pagamentos[idx][campoNome] = valor
      return next
    })
  }

  const addPagamento = () => {
    setForm(prev => ({ ...prev, pagamentos: [...prev.pagamentos, { method: 'CREDIT', type: 'ONLINE', value: '', prepaid: true, changeFor: '0', cardBrand: '', authorizationCode: '', installments: '1' }] }))
  }

  const remPagamento = (idx) => {
    setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.filter((_, i) => i !== idx) }))
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>🍕 Teste iFood — Pedidos</h1>
      <div style={s.hint}>
        <b>Como testar:</b> use o formulário abaixo para criar um pedido no padrão iFood (ele aparece na plataforma
        como pedido do iFood). Depois mude o status no admin e veja no painel <b>📤 Enviado para o iFood</b> o que foi
        sincronizado. A página atualiza sozinha a cada 5s.
      </div>

      {/* ===== FORMULÁRIO DE CRIAÇÃO ===== */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>➕ Criar pedido no padrão iFood</h2>

        <div style={s.row}>
          {campo('ID iFood (orderId)', form.oid, setF('oid'))}
          {campo('Display ID', form.displayId, setF('displayId'))}
          <SelectField label="Order Type" valor={form.orderType} onChange={setF('orderType')} opcoes={ORDERTYPE_OPCOES} />
          <SelectField label="Category" valor={form.category} onChange={setF('category')} opcoes={CATEGORY_OPCOES} />
          <SelectField label="Order Timing" valor={form.orderTiming} onChange={setF('orderTiming')} opcoes={TIMING_OPCOES} />
          <SelectField label="Sales Channel" valor={form.salesChannel} onChange={setF('salesChannel')} opcoes={CHANNEL_OPCOES} />
          <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={!!form.isTest} onChange={e => setF('isTest')(e.target.checked)} />
            Pedido de teste (isTest)
          </label>
        </div>

        <h3 style={{ fontSize: 13, margin: '6px 0' }}>Loja (merchant)</h3>
        <div style={s.row}>
          {campo('Merchant ID', form.merchant.id, setF('merchant.id'))}
          {campo('Merchant Name', form.merchant.name, setF('merchant.name'))}
        </div>

        <h3 style={{ fontSize: 13, margin: '6px 0' }}>Cliente</h3>
        <div style={s.row}>
          {campo('Nome', form.cliente.nome, setF('cliente.nome'))}
          {campo('Telefone (number)', form.cliente.telefone, setF('cliente.telefone'))}
          {campo('DDI (localizer)', form.cliente.phoneLocalizer, setF('cliente.phoneLocalizer'), { style: { ...s.input, width: 70 } })}
          {campo('CPF/Documento', form.cliente.cpf, setF('cliente.cpf'))}
          {campo('Tipo Documento', form.cliente.documentType, setF('cliente.documentType'))}
        </div>

        <h3 style={{ fontSize: 13, margin: '6px 0' }}>Endereço de entrega</h3>
        <div style={s.row}>
          {campo('Rua', form.endereco.streetName, setF('endereco.streetName'))}
          {campo('Número', form.endereco.streetNumber, setF('endereco.streetNumber'))}
          {campo('Bairro', form.endereco.neighborhood, setF('endereco.neighborhood'))}
          {campo('Cidade', form.endereco.city, setF('endereco.city'))}
          {campo('UF', form.endereco.state, setF('endereco.state'), { style: { ...s.input, width: 60 } })}
          {campo('Complemento', form.endereco.complement, setF('endereco.complement'))}
          {campo('Referência', form.endereco.reference, setF('endereco.reference'))}
          {campo('CEP', form.endereco.postalCode, setF('endereco.postalCode'))}
          {campo('Lat', form.endereco.lat, setF('endereco.lat'))}
          {campo('Lng', form.endereco.lng, setF('endereco.lng'))}
        </div>

        <h3 style={{ fontSize: 13, margin: '6px 0' }}>Entrega (delivery)</h3>
        <div style={s.row}>
          <SelectField label="Modo (delivery.mode)" valor={form.entrega.mode} onChange={setF('entrega.mode')} opcoes={ORDERTYPE_OPCOES} />
          <SelectField label="Entregue por (deliveredBy)" valor={form.entrega.deliveredBy} onChange={setF('entrega.deliveredBy')} opcoes={DELIVEREDBY_OPCOES} />
          {campo('Observações', form.entrega.obs, setF('entrega.obs'))}
          {campo('Código de coleta', form.entrega.pickupCode, setF('entrega.pickupCode'))}
          {form.orderType === 'INDOOR' && campo('Mesa (indoor.table)', form.entrega.table, setF('entrega.table'))}
          {campo('Data/hora entrega', form.entrega.data, setF('entrega.data'), { type: 'datetime-local' })}
          {campo('Taxa de entrega', form.deliveryFee, setF('deliveryFee'))}
          {campo('Desconto (benefits)', form.benefits, setF('benefits'))}
        </div>

        <h3 style={{ fontSize: 13, margin: '6px 0' }}>Itens</h3>
        {form.itens.map((it, i) => (
          <div key={i} style={s.itemBox}>
            <div style={s.row}>
              {campo('Nome', it.nome, v => setItem(i, 'nome', v))}
              {campo('Qtd', it.qtd, v => setItem(i, 'qtd', v), { style: { ...s.input, width: 60 } })}
              {campo('Preço unitário', it.unitPrice, v => setItem(i, 'unitPrice', v), { style: { ...s.input, width: 90 } })}
              {campo('External Code', it.externalCode, v => setItem(i, 'externalCode', v))}
              {campo('Observações', it.observacoes, v => setItem(i, 'observacoes', v))}
            </div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
              Subtotal: R$ {((parseInt(it.qtd) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2)}
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Adicionais (subItems)</strong>
              {(it.adicionais || []).map((a, ai) => (
                <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', margin: '6px 0' }}>
                  {campo('Nome', a.nome, v => setAdicional(i, ai, 'nome', v))}
                  {campo('Qtd', a.qtd, v => setAdicional(i, ai, 'qtd', v), { style: { ...s.input, width: 55 } })}
                  {campo('Preço', a.unitPrice, v => setAdicional(i, ai, 'unitPrice', v), { style: { ...s.input, width: 80 } })}
                  <button style={s.button} onClick={() => setForm(prev => { const n = JSON.parse(JSON.stringify(prev)); n.itens[i].adicionais = n.itens[i].adicionais.filter((_, x) => x !== ai); return n })}>✕</button>
                </div>
              ))}
              <button style={{ ...s.button, background: '#eee', fontSize: 12 }} onClick={() => setForm(prev => { const n = JSON.parse(JSON.stringify(prev)); n.itens[i].adicionais = [...(n.itens[i].adicionais || []), { nome: '', qtd: 1, unitPrice: '' }]; return n })}>+ Adicional</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>Opções (options)</strong>
              {(it.opcoes || []).map((o, oi) => (
                <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', margin: '6px 0' }}>
                  {campo('Nome', o.nome, v => setOpcao(i, oi, 'nome', v))}
                  {campo('Grupo', o.grupo, v => setOpcao(i, oi, 'grupo', v))}
                  {campo('Qtd', o.qtd, v => setOpcao(i, oi, 'qtd', v), { style: { ...s.input, width: 55 } })}
                  {campo('Preço', o.unitPrice, v => setOpcao(i, oi, 'unitPrice', v), { style: { ...s.input, width: 80 } })}
                  <button style={s.button} onClick={() => setForm(prev => { const n = JSON.parse(JSON.stringify(prev)); n.itens[i].opcoes = n.itens[i].opcoes.filter((_, x) => x !== oi); return n })}>✕</button>
                </div>
              ))}
              <button style={{ ...s.button, background: '#eee', fontSize: 12 }} onClick={() => setForm(prev => { const n = JSON.parse(JSON.stringify(prev)); n.itens[i].opcoes = [...(n.itens[i].opcoes || []), { nome: '', grupo: '', qtd: 1, unitPrice: '' }]; return n })}>+ Opção</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button style={{ ...s.button, background: '#F56C6C', color: '#fff', fontSize: 12 }} onClick={() => remItem(i)}>🗑 Remover item</button>
            </div>
          </div>
        ))}
        <button style={{ ...s.button, background: '#eee' }} onClick={addItem}>+ Adicionar item</button>

        <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>Pagamento</h3>
        {form.pagamentos.map((pg, i) => (
          <div key={i} style={s.itemBox}>
            <div style={s.row}>
              <SelectField label="Método (method)" valor={pg.method} onChange={v => setPagamento(i, 'method', v)} opcoes={METODO_OPCOES} />
              <SelectField label="Tipo (type)" valor={pg.type} onChange={v => setPagamento(i, 'type', v)} opcoes={TIPO_OPCOES} />
              <SelectField label="Card Brand (card.brand)" valor={pg.cardBrand} onChange={v => setPagamento(i, 'cardBrand', v)} opcoes={CARDBRAND_OPCOES} />
              {campo('Parcelas (installments)', pg.installments, v => setPagamento(i, 'installments', v), { style: { ...s.input, width: 70 } })}
              {campo('Valor', pg.value, v => setPagamento(i, 'value', v), { style: { ...s.input, width: 110 } })}
              {campo('Troco para (cash.changeFor)', pg.changeFor, v => setPagamento(i, 'changeFor', v), { style: { ...s.input, width: 90 } })}
              {campo('Auth Code (transaction)', pg.authorizationCode, v => setPagamento(i, 'authorizationCode', v))}
              <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!pg.prepaid} onChange={e => setPagamento(i, 'prepaid')(e.target.checked)} />
                Pré-pago
              </label>
              {form.pagamentos.length > 1 && (
                <button style={{ ...s.button, background: '#F56C6C', color: '#fff', fontSize: 12, alignSelf: 'flex-end' }} onClick={() => remPagamento(i)}>✕ Remover</button>
              )}
            </div>
            <div style={s.hintText}>
              Estrutura enviada: <b>cash.changeFor</b> (troco), <b>card.brand</b> + <b>card.installments</b>, <b>transaction.authorizationCode</b>, <b>currency: BRL</b>. Deixe <b>Valor</b> em branco para usar automaticamente o valor restante do pedido.
            </div>
          </div>
        ))}
        <button style={{ ...s.button, background: '#eee' }} onClick={addPagamento}>+ Adicionar forma de pagamento</button>

        <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0f9eb', border: '1px solid #b7eb8f', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>
          Total do pedido: R$ {totalOrder.toFixed(2)}
          <span style={{ fontWeight: 400, marginLeft: 14, color: '#555' }}>Pago: R$ {totalPago.toFixed(2)}</span>
          <span style={{ fontWeight: 700, marginLeft: 14, color: restante > 0.009 ? '#E6A23C' : restante < -0.009 ? '#F56C6C' : '#67C23A' }}>
            {restante > 0.009 ? `Faltam: R$ ${restante.toFixed(2)}` : restante < -0.009 ? `Excede: R$ ${Math.abs(restante).toFixed(2)}` : '✓ Coberto'}
          </span>
        </div>

        <div style={{ marginTop: 12 }}>
          <button style={{ ...s.button, background: '#409EFF', color: '#fff', padding: '10px 18px', fontSize: 15 }} onClick={criarPedido}>
            🚀 Criar pedido de teste
          </button>
        </div>
      </div>

      {resposta && <pre style={s.msg}>{resposta}</pre>}

      {/* ===== PEDIDOS ===== */}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Cliente</th>
            <th style={s.th}>Origem</th>
            <th style={s.th}>Total</th>
            <th style={s.th}>ID iFood</th>
            <th style={s.th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.length === 0 && (
            <tr><td colSpan="7" style={{ ...s.td, textAlign: 'center', padding: 20, color: '#888' }}>Nenhum pedido encontrado</td></tr>
          )}
          {pedidos.map(p => {
            const mpid = p.cliente?.marketplace_order_id
            return (
              <tr key={p.id}>
                <td style={s.td}>#{p.id}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: STATUS_COLORS[p.status] || '#999' }}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </td>
                <td style={s.td}>{p.cliente?.nome || '-'}</td>
                <td style={s.td}>{p.cliente?.origem || 'site'}
                  {isRetirada(p) && <span style={{ display: 'block', fontSize: 11, color: '#B45309', fontWeight: 700 }}>🛍️ Retirada</span>}
                </td>
                <td style={s.td}>R$ {Number(p.total || 0).toFixed(2)}</td>
                <td style={s.td}>{mpid ? <span style={s.mpid}>{mpid}</span> : '-'}</td>
                <td style={s.td}>
                  {mpid ? (
                    <>
                      <button
                        style={{ ...s.button, background: '#F56C6C', color: '#fff', marginRight: 6 }}
                        onClick={() => simularEvento(p, 'CANCELLED')}
                      >
                        ❌ Cancelar (simular)
                      </button>
                      <button
                        style={{ ...s.button, background: '#67C23A', color: '#fff' }}
                        onClick={() => simularEvento(p, 'CONCLUDED')}
                      >
                        ✅ Entregar (simular)
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: '#bbb' }}>sem simulação</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ===== PAINÉIS (abaixo da tabela, posição fixa) ===== */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
        <div style={s.panel}>
          <h2 style={s.panelTitle}>📤 Enviado para o iFood (sincronização)</h2>
          {syncLog.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>Nada enviado ainda. Mude um status de um pedido iFood no admin.</p>
          ) : syncLog.slice(0, 12).map((e, i) => (
            <div key={i} style={s.entry}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{fmtHora(e.timestamp)}</strong>
                <span style={{ fontSize: 12 }}>
                  {e.status === 'ok' && <span style={{ color: '#67C23A', fontWeight: 700 }}>✓ ok</span>}
                  {e.status === 'enviando' && <span style={{ color: '#E6A23C', fontWeight: 700 }}>⚠ enviando</span>}
                  {e.status === 'erro' && <span style={{ color: '#F56C6C', fontWeight: 700 }}>✗ erro</span>}
                </span>
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {e.type === 'requestCancellation' ? (
                  <>
                    Pedido <b>{shortId(e.orderId)}</b>: local <b>cancelado</b> → iFood <b>{IFOOD_STATUS_LABELS.requestCancellation}</b>
                    {e.reason ? ` (reason ${e.reason})` : ''}
                  </>
                ) : (
                  <>
                    Pedido <b>{shortId(e.orderId)}</b>: local <b>{STATUS_LABELS[e.localStatus] || e.localStatus}</b> → iFood{" "}
                    <b>{IFOOD_STATUS_LABELS[e.ifoodStatus] || e.ifoodStatus}</b>
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 3, wordBreak: 'break-all' }}>
                POST {e.endpoint}
              </div>
              {e.error && <div style={{ fontSize: 11, color: '#F56C6C', marginTop: 3 }}>{e.error}</div>}
              {e.status === 'ok' && (
                <div style={{ fontSize: 12, color: '#67C23A', marginTop: 3, fontWeight: 700 }}>
                  {e.type === 'requestCancellation' ? 'iFood reconheceu: pedido cancelado ✓' : `iFood reconheceu: ${e.ifoodStatus.toUpperCase()} ✓`}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={s.panel}>
          <h2 style={s.panelTitle}>📥 Último webhook recebido</h2>
          {log.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>Nenhum webhook registrado ainda.</p>
          ) : (
            <pre style={s.msg}>{JSON.stringify(log[0], null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
