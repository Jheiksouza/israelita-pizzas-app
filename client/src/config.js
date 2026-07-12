export const DOMAINS = {
  QUERO_PIZZA: 'queropizza.com',
}

export function getCurrentDomain() {
  return window.location.hostname
}

export function isLandingPage() {
  const host = getCurrentDomain()
  return host === DOMAINS.QUERO_PIZZA || host === `www.${DOMAINS.QUERO_PIZZA}`
}

export function getStoreSlug() {
  const host = getCurrentDomain()
  const match = host.match(/^(.+)\.queropizza\.com$/)
  return match ? match[1] : null
}

export function getStoreUrl(slug) {
  return `https://${slug}.queropizza.com`
}

export function getIsraelitaLoginUrl() {
  return getStoreUrl('israelita')
}

// API headers including store slug for multi-tenant detection
export function apiHeaders(extra = {}) {
  const slug = getStoreSlug()
  const headers = { 'Content-Type': 'application/json', ...extra }
  if (slug) headers['X-Store-Slug'] = slug
  return headers
}
