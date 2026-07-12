export const DOMAINS = {
  QUERO_PIZZA: 'queropizza.com',
  ISRAELITA: 'israelita.queropizza.com',
}

export function getCurrentDomain() {
  return window.location.hostname
}

export function isLandingPage() {
  const host = getCurrentDomain()
  return host === DOMAINS.QUERO_PIZZA || host === `www.${DOMAINS.QUERO_PIZZA}`
}

export function isIsraelitaPage() {
  const host = getCurrentDomain()
  return host === DOMAINS.ISRAELITA
}

export function getIsraelitaLoginUrl() {
  return `https://${DOMAINS.ISRAELITA}`
}
