// Service worker básico: sin estrategia de cache todavía, solo deja pasar las peticiones.
// Necesario para que la PWA sea instalable; la lógica de cache se añadirá más adelante.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // no-op: passthrough al comportamiento por defecto del navegador
})
