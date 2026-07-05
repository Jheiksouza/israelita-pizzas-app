importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyAUfOVepmu0aMZzobg31LwjersgIb3Nz8g",
  authDomain: "notificacao-da-pizzaria.firebaseapp.com",
  projectId: "notificacao-da-pizzaria",
  storageBucket: "notificacao-da-pizzaria.firebasestorage.app",
  messagingSenderId: "337293502334",
  appId: "1:337293502334:web:4e1728f0010296486f752f",
  measurementId: "G-04P24GH9NP"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.data
  self.registration.showNotification(title || 'Israelita Entregas', {
    body: body || '',
    icon: '/logo-israelita.png'
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/motoboy'))
})
