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

const styles = {
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
  panel: { flex: '0 0 340px', minWidth: 280, fontSize: 13 },
  panelTitle: { fontSize: 14, margin: 0, marginBottom: 6, fontWeight: 700 },
  entry: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }
}

function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour12: false })
}

function shortId(id) {
  if (!id) return '-'
  return id.length > 12 ? id.slice(0, 12) + '…' : id
}

export default function TesteIfood() {
  const [pedidos, setPedidos] = useState([])
  const [log, setLog] = useState([])
  const [syncLog, setSyncLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [resposta, setResposta] = useState('')

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
        await carregarSyncLog()
      }, 800)
    } catch (e) {
      setResposta(`Erro ao enviar: ${e.message}`)
    }
  }

  const ifoodReconheceu = (entry) => {
    if (entry.status !== 'ok') return null
    if (entry.type === 'requestCancellation') return 'iFood reconheceu: pedido cancelado ✓'
    if (entry.ifoodStatus) return `iFood reconheceu: ${entry.ifoodStatus.toUpperCase()} ✓`
    return null
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>🍕 Teste iFood — Pedidos</h1>
      <div style={styles.hint}>
        <b>Como testar:</b> crie um pedido de teste no portal do iFood → ele aparece abaixo. Clique em{" "}
        <b>"Cancelar (simular)"</b> para simular o iFood cancelando, ou mude o status no admin e veja aqui o que foi{" "}
        <b>enviado para o iFood</b> (painel da direita). A página atualiza sozinha a cada 5s.
      </div>

      <div style={styles.bar}>
        <button style={{ ...styles.button, background: '#409EFF', color: '#fff' }} onClick={() => { carregar(); carregarLog(); carregarSyncLog() }}>
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

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>📤 Enviado para o iFood (sincronização)</h2>
          {syncLog.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>Nada enviado ainda. Mude um status de um pedido iFood no admin.</p>
          ) : syncLog.slice(0, 12).map((e, i) => (
            <div key={i} style={styles.entry}>
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
              {ifoodReconheceu(e) && <div style={{ fontSize: 12, color: '#67C23A', marginTop: 3, fontWeight: 700 }}>{ifoodReconheceu(e)}</div>}
            </div>
          ))}
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>📥 Último webhook recebido</h2>
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
