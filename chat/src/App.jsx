import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Settings, Sun, Moon, Pizza, Wifi, WifiOff, ExternalLink, Check, ChevronRight } from 'lucide-react'
import { cn } from './lib/utils'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'

const API = '/api'

function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('chatDark') === 'true')
  const [config, setConfig] = useState(null)
  const [widgetId, setWidgetId] = useState('')
  const [savedWidgetId, setSavedWidgetId] = useState('')
  const [status, setStatus] = useState('configuring')
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('chatDark', darkMode)
  }, [darkMode])

  useEffect(() => {
    fetch(`${API}/config/chat`)
      .then(r => r.json())
      .then(data => {
        if (data.widgetId) {
          setWidgetId(data.widgetId)
          setSavedWidgetId(data.widgetId)
          setStatus('ready')
        }
      })
      .catch(() => {})
    fetch(`${API}/orders`)
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data.filter(o => o.cliente?.origem === 'ifood') : []))
      .catch(() => {})
  }, [])

  const saveConfig = async () => {
    await fetch(`${API}/config/chat`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetId })
    })
    setSavedWidgetId(widgetId)
    setShowSettings(false)
    if (widgetId) setStatus('ready')
  }

  const initWidget = useCallback(() => {
    if (!savedWidgetId || typeof window.iFoodWidget === 'undefined') return
    window.iFoodWidget.init({
      widgetId: savedWidgetId,
      merchantIds: ['87338588-ed69-4b80-82fc-bb6c0b76a1c8'],
      autoShow: true
    })
  }, [savedWidgetId])

  useEffect(() => {
    if (status === 'ready' && savedWidgetId) {
      if (typeof window.iFoodWidget !== 'undefined') {
        initWidget()
      } else {
        const check = setInterval(() => {
          if (typeof window.iFoodWidget !== 'undefined') {
            initWidget()
            clearInterval(check)
          }
        }, 500)
        return () => clearInterval(check)
      }
    }
  }, [status, savedWidgetId, initWidget])

  if (!savedWidgetId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Chat iFood</CardTitle>
            <CardDescription>
              Configure o Widget do iFood para conversar com seus clientes diretamente do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Como obter seu Widget ID:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Acesse o <a href="https://developer.ifood.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Portal do Desenvolvedor iFood</a></li>
                <li>Crie uma aplicação do tipo <strong>Widget</strong></li>
                <li>Ative o módulo de <strong>Chat</strong> nas configurações</li>
                <li>Copie o <strong>Widget ID</strong> gerado</li>
              </ol>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Widget ID</label>
              <Input
                placeholder="Cole seu Widget ID aqui..."
                value={widgetId}
                onChange={e => setWidgetId(e.target.value)}
              />
            </div>
            <Button className="w-full" size="lg" onClick={saveConfig} disabled={!widgetId}>
              <Check className="h-4 w-4" />
              Salvar e Ativar Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Pizza className="h-5 w-5 text-primary" />
              <span className="font-serif font-semibold text-base">Israelita Pizzas</span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:inline">|</span>
            <span className="text-sm text-muted-foreground hidden sm:inline flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              Chat iFood
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {status === 'ready' ? (
                <><Wifi className="h-3 w-3 text-green-500" /> Conectado</>
              ) : (
                <><WifiOff className="h-3 w-3 text-destructive" /> Desconectado</>
              )}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="w-72 border-r bg-card hidden md:flex flex-col">
          <div className="p-3 border-b">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Pedidos iFood</h2>
            <Input placeholder="Buscar pedido..." className="h-8 text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum pedido iFood encontrado
              </div>
            ) : (
              orders.map(order => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg text-sm transition-colors",
                    selectedOrder?.id === order.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Pedido #{order.id}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {order.cliente?.nome || 'Cliente'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R$ {order.total?.toFixed(2)} · {order.status === 'pendente' ? 'Pendente' : order.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {showSettings ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Configuração do Widget</CardTitle>
                  <CardDescription>Altere o Widget ID do iFood Chat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Widget ID</label>
                    <Input
                      placeholder="Cole seu Widget ID aqui..."
                      value={widgetId}
                      onChange={e => setWidgetId(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={saveConfig}>
                    <Check className="h-4 w-4" />
                    Salvar
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4" id="ifood-chat-container">
              <Card className="w-full max-w-lg text-center">
                <CardContent className="pt-10 pb-10">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5">
                    <MessageCircle className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Chat iFood</h2>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    O Widget do iFood será carregado aqui. Selecione um pedido ao lado para iniciar uma conversa com o cliente.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => window.open('https://developer.ifood.com.br', '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                    Abrir Portal iFood
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
