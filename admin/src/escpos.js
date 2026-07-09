const PRINT_SERVER = 'http://localhost:13001'

export async function printOrder(pedido) {
  const res = await fetch(`${PRINT_SERVER}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao imprimir')
  }
}
