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

const styles = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: 20, color: '#111' },
  h1: { fontSize: 20 },
  hint: { background: '#fff3cd', border: '1px solid #ffc107', padding: '10px 12px', borderRadius: 6, fontSize: 13, lineHeight: 1.5 },
  bar: { display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' },
  button: { padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #ddd', background: '#f5f5f5' },
  td: { padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 600 },
  mpid: { fontFamily: 'monospace', fontSize: 11, color: '#777', wordBreak: 'break-all' },
  msg: { fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#111', color: '#0f0', padding: 10, borderRadius: 6, maxHeight: 300, overflow: 'auto' }
}

export default function TesteIfood() {
  const [pedidos, setPedidos] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [resposta, setResposta] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
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

  useEffect(() => {
    carregar()
    carregarLog()
  }, [carregar, carregarLog])

  const simularEvento = async (pedido, code) => {
    const mpid = pedido.cliente?.marketplace_order_id
    if (!mpid) {
      setResposta(`Pedido #${pedido.id} não tem marketplace_order_id (não é pedido iFood)`)
      return
    }
    const body = {
      id: `evt_sim_${code}_${Date.now()}`,
      code,
      fullCode: code,
      orderId: mpid,
      createdAt: new Date().toISOString(),
      metadata: {
        orderId: mpid,
        status: code,
        reason: 'Simulação manual pela página /testeifood'
      }
    }
    setResposta(`Enviando ${code} para o pedido #${pedido.id} (${mpid})...\n`)
    try {
      const r = await fetch(`${API}/marketplace/ifood/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const text = await r.text()
      setResposta(`Enviado ${code} para #${pedido.id} → HTTP ${r.status}\n${text}\n\nRecarregando lista...`)
      setTimeout(async () => {
        await carregar()
        await carregarLog()
      }, 800)
    } catch (e) {
      setResposta(`Erro ao enviar: ${e.message}`)
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>🍕 Teste iFood — Pedidos</h1>
      <div style={styles.hint}>
        <b>Como testar:</b> crie um pedido de teste no portal do iFood → ele aparece abaixo → clique em{" "}
        <b>"Cancelar (simular)"</b>. Isso envia para o webhook a mesma mensagem que o iFood enviaria quando um
        cliente cancela. Depois abra o admin e veja o pedido na aba <b>Cancelados</b> — sem você fazer nada.
      </div>

      <div style={styles.bar}>
        <button style={{ ...styles.button, background: '#409EFF', color: '#fff' }} onClick={() => { carregar(); carregarLog() }}>
          🔄 Atualizar
        </button>
        {loading && <span style={{ fontSize: 13, color: '#888' }}>Carregando...</span>}
      </div>

      {resposta && <pre style={styles.msg}>{resposta}</pre>}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Cliente</th>
            <th style={styles.th}>Origem</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>ID iFood</th>
            <th style={styles.th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.length === 0 && (
            <tr><td colSpan="7" style={{ ...styles.td, textAlign: 'center', padding: 20, color: '#888' }}>Nenhum pedido encontrado</td></tr>
          )}
          {pedidos.map(p => {
            const mpid = p.cliente?.marketplace_order_id
            return (
              <tr key={p.id}>
                <td style={styles.td}>#{p.id}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: STATUS_COLORS[p.status] || '#999' }}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </td>
                <td style={styles.td}>{p.cliente?.nome || '-'}</td>
                <td style={styles.td}>{p.cliente?.origem || 'site'}</td>
                <td style={styles.td}>R$ {Number(p.total || 0).toFixed(2)}</td>
                <td style={styles.td}>{mpid ? <span style={styles.mpid}>{mpid}</span> : '-'}</td>
                <td style={styles.td}>
                  {mpid ? (
                    <>
                      <button
                        style={{ ...styles.button, background: '#F56C6C', color: '#fff', marginRight: 6 }}
                        onClick={() => simularEvento(p, 'CANCELLED')}
                      >
                        ❌ Cancelar (simular)
                      </button>
                      <button
                        style={{ ...styles.button, background: '#67C23A', color: '#fff' }}
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
        </div>

        <div style={{ flex: '0 0 320px', minWidth: 260 }}>
          <h2 style={{ fontSize: 14, margin: 0, marginBottom: 6 }}>Último webhook recebido</h2>
          {log.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>Nenhum webhook registrado ainda.</p>
          ) : (
            <pre style={styles.msg}>{JSON.stringify(log[0], null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
