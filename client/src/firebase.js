import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyAUfOVepmu0aMZzobg31LwjersgIb3Nz8g",
  authDomain: "notificacao-da-pizzaria.firebaseapp.com",
  projectId: "notificacao-da-pizzaria",
  storageBucket: "notificacao-da-pizzaria.firebasestorage.app",
  messagingSenderId: "337293502334",
  appId: "1:337293502334:web:4e1728f0010296486f752f",
  measurementId: "G-04P24GH9NP"
}

const VAPID_KEY = 'BG6gnw_oAKJhwkj4BaKuGHSrre-740AGp6lslN5P95pVJbMsQEU6-h4vxk08KmBV5d3UFgOL4s7CmMOuyZjEX10'

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

export async function registerFCMToken(userId, role) {
  try {
    if (!('Notification' in window)) return null
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })

    await fetch('/api/fcm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId, platform: 'web', role })
    })

    return token
  } catch {
    return null
  }
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, callback)
}
