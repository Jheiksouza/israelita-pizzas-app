const APIS = [
  {
    url: (cep) => `https://brasilapi.com.br/api/cep/v1/${cep}`,
    parse: (d) => ({ cep: d.cep, rua: d.street || '', bairro: d.neighborhood || '', cidade: d.city || '', estado: d.state || '' })
  },
  {
    url: (cep) => `https://brasilapi.com.br/api/cep/v2/${cep}`,
    parse: (d) => ({ cep: d.cep, rua: d.street || '', bairro: d.neighborhood || '', cidade: d.city || '', estado: d.state || '' })
  },
  {
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
    parse: (d) => ({ cep: d.cep, rua: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', estado: d.uf || '' })
  },
  {
    url: (cep) => `https://opencep.com/v1/${cep}.json`,
    parse: (d) => ({ cep: d.cep, rua: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', estado: d.uf || '' })
  }
]

export async function buscarCEP(cepRaw) {
  const cep = cepRaw.replace(/\D/g, '')
  if (cep.length !== 8) return null
  for (const api of APIS) {
    try {
      const r = await fetch(api.url(cep))
      if (!r.ok) continue
      const data = await r.json()
      if (data.erro || data.error) continue
      return api.parse(data)
    } catch {}
  }
  return null
}

export function formatCEP(value) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function formatEndereco(addr) {
  if (!addr) return ''
  if (addr.rua && addr.bairro) {
    let s = `${addr.rua}${addr.numero ? ', ' + addr.numero : ''}`
    if (addr.referencia) s += ` (${addr.referencia})`
    s += ` - ${addr.bairro}${addr.cidade ? ', ' + addr.cidade : ''}${addr.estado ? ' - ' + addr.estado : ''}`
    if (addr.cep) s += ` - CEP: ${addr.cep}`
    return s
  }
  return addr.rua || addr || ''
}
