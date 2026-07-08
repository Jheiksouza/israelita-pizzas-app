Guia de implementação
Este guia mostra como integrar o módulo de Order, cobrindo todo o ciclo de vida do pedido.
1. Pré-requisitos
Entenda os Fundamentos (tipos de pedido, categorias, SLA)
Tenha um token de autenticação válido
Escolha seu método de consumo de eventos (polling ou webhook)
2. Receber novos pedidos
Os pedidos chegam como eventos. Escolha seu método de consumo:
Polling (recomendado para começar)
Consulte a cada 30 segundos:

curl -X GET "https://merchant-api.ifood.com.br/order/v1.0/orders:polling" \
  -H "Authorization: Bearer YOUR_TOKEN"
Resposta (200 OK):

{
  "events": [
    {
      "id": "evt_123",
      "code": "CONFIRMED",
      "fullCode": "ORDER_CONFIRMED",
      "orderId": "ord_456",
      "createdAt": "2024-04-25T18:00:00Z",
      "metadata": {
        "id": "ord_456",
        "status": "CONFIRMED",
        "category": "FOOD",
        "orderType": "DELIVERY",
        "items": [...]
      }
    }
  ]
}
Webhooks (escalável)
Configure seu endpoint para receber eventos diretamente. iFood enviará POST com a mesma estrutura acima.
Implementação no JavaScript:

const express = require('express');
const app = express();
app.post('/webhooks/orders', express.json(), (req, res) => {
  const { events } = req.body;
  events.forEach((event) => {
    if (event.code === 'CONFIRMED') {
      // Process new order
      console.log(`Novo pedido: ${event.metadata.id}`);
    }
  });
  // Acknowledge immediately
  res.status(200).json({ acknowledged: true });
});
app.listen(3000);
Próximo passo: Após receber evento, confirme a leitura com /acknowledgment.
3. Confirmar leitura de eventos
Após processar eventos, confirme que foram consumidos:

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders:acknowledgment" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "acknowledgedEventIds": ["evt_123", "evt_124"]
  }'
Resposta (202 Accepted)
Importante: Confirme apenas eventos que processou com sucesso. Eventos não confirmados voltarão na próxima consulta.
4. Obter detalhes do pedido
Obtenha os detalhes do pedido antes de confirmar ou cancelar. Use GET /orders/{id} para verificar itens, disponibilidade e endereço de entrega.
Requisição:

curl -X GET "https://merchant-api.ifood.com.br/order/v1.0/orders/{id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
Retorna 200 com todos os detalhes do pedido (itens, pagamento, endereço, etc.). Retorna 404 para IDs inválidos, pedidos indisponíveis ou antigos.
Pedido ainda não disponível
O evento PLACED pode chegar antes dos detalhes. Se receber 404, implemente retry com exponential backoff por até 10 minutos. Não faça retentativas infinitas para evitar bloqueios.
Pedidos antigos
A API mantém detalhes por apenas 7 dias. Evite consultar repetidamente pedidos antigos para não sofrer rate limiting.
Detalhes de um pedido
Consulte todos os campos disponíveis
5. Imprimir comanda
Antes de confirmar, imprima a comanda para a cozinha:
Use a estrutura do pedido obtida no passo anterior. Inclua:
ID do pedido (displayId)
Itens com observações especiais
Modo de entrega (endereço/pickup)
CPF/CNPJ do cliente (se obrigatório)
Template recomendado: Ver exemplo
6. Confirmar pedido
Confirme o recebimento em 8 minutos. Veja prazo de confirmação para detalhes.

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/confirm" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
Resposta (202 Accepted)
A API retorna imediatamente. Próxima consulta mostra resultado:

# Próximo polling retornará:
{
  "events": [
    {
      "code": "CONFIRMED",  // Sucesso
      "orderId": "ord_456"
    }
  ]
}
# OU em caso de falha:
{
  "events": [
    {
      "code": "CANCELLATION_REQUEST_FAILED",  // Rejeição
      "orderId": "ord_456",
      "metadata": {
        "reason": "Estoque insuficiente"
      }
    }
  ]
}
Erros comuns:
Confirmação após 8 minutos → Pedido já cancelado
Confirmação duplicada → Ignorado (idempotente)
Token expirado → 401 Unauthorized
Melhor prática: Armazene o orderId e timestamp de confirmação para auditoria.
7. Ciclo de vida do pedido
FOOD
PLACED
CONFIRMED
PREPARATION_STARTED
DISPATCHED
READY_TO_PICKUP
CONCLUDED
CANCELLED
Estados:
PLACED — Pedido criado
CONFIRMED — Pedido confirmado
PREPARATION_STARTED — Preparo iniciado (opcional)
DISPATCHED — Saiu para entrega
READY_TO_PICKUP — Pronto para retirada
CONCLUDED — Concluído
CANCELLED — Cancelado
FOOD_SELF_SERVICE
PLACED
CONFIRMED
CONCLUDED
CANCELLED
READY_TO_PICKUP
DELIVERED
Estados:
PLACED — Pedido criado
CONFIRMED — Pedido confirmado
READY_TO_PICKUP — Pronto para retirada
DELIVERED — Entregue
CONCLUDED — Concluído
CANCELLED — Cancelado
ANOTAI
PLACED
CONFIRMED
CONCLUDED
CANCELLED
DISPATCHED
Estados:
PLACED — Pedido criado
CONFIRMED — Pedido confirmado
DISPATCHED — Saiu para entrega
CONCLUDED — Concluído
CANCELLED — Cancelado
8. Momento do pedido
Alguns pedidos devem ser preparados imediatamente, enquanto outros são agendados para uma data ou horário específico.
orderTiming	Descrição
IMMEDIATE	Prepare e entregue o mais breve possível
SCHEDULED	Respeite o horário agendado. Saiba mais sobre pedidos agendados
9. Preparar pedido
Pedidos de food passam por etapas específicas de preparação. Veja o diagrama abaixo:
API
Client
API
Client
1- Get new orders
2- Received events
Acknowledgment
3- Get order details
​
4- Confirm order
Get result of
confirm request
5- Start Preparation
6- Order is ready to
delivery or takeout
GET /events:polling
Events (without ACK)
POST /events/acknowledgment
GET /orders/{id}
order details
POST /orders/{id}/confirm
GET /events:polling
CONFIRMED (CFM)
POST /orders/{id}/startPreparation
POST /orders/{id}/dispatch or /orders/{id}/readyToPickup
Confirmar pedido
Use POST /orders/{id}/confirm para confirmar o pedido.
Requisição:

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/{id}/confirm" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
Retorna 202 Accepted.
Iniciar preparo
Use POST /orders/{id}/startPreparation para iniciar o preparo.
Requisição:

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/{id}/startPreparation" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
Retorna 202 Accepted.
Pedido pronto para entrega
Notifique quando o preparo estiver completo. A ação depende do tipo de entrega:
Obrigatório para pedidos **TAKEOUT** e **DINE_IN**. Opcional para pedidos **DELIVERY** com entregador iFood.
Para Takeout, Dine-in e Delivery com entregador iFood:
Use POST /orders/{id}/readyToPickup para notificar que o pedido está pronto para coleta.

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/{id}/readyToPickup" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
Para Delivery com entrega própria
Use POST /orders/{id}/dispatch para notificar que o pedido foi despachado para entrega.

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/{id}/dispatch" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
10. Rastrear entrega (iFood)
Para pedidos entregues por iFood, rastreie em tempo real:
Pré-requisito: Receba evento ASSIGN_DRIVER (entregador atribuído)

curl -X GET "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/tracking" \
  -H "Authorization: Bearer YOUR_TOKEN"
Resposta:

{
  "latitude": -23.5505,
  "longitude": -46.6333,
  "expectedDelivery": "2024-04-25T18:30:00Z",
  "pickupEtaStart": 120,
  "deliveryEtaEnd": 600,
  "trackDate": "2024-04-25T18:15:00Z"
}
Limitações:
Uma requisição a cada 30 segundos (respeite rate limiting)
Pode retornar 404 antes de estar disponível
Apenas durante entrega ativa
11. Cancelamento de pedido
Verificar motivos válidos

curl -X GET "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/cancellationReasons" \
  -H "Authorization: Bearer YOUR_TOKEN"
Resposta:

{
  "reasons": [
    { "code": "501", "description": "Erro no sistema" },
    { "code": "502", "description": "Pedido duplicado" },
    { "code": "503", "description": "Item indisponível" }
    // ... mais códigos
  ]
}
Solicitar cancelamento

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/requestCancellation" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "503"
  }'
Resposta (202 Accepted)
O resultado chega no próximo polling:

{
  "events": [
    {
      "code": "CANCELLED", // Sucesso
      "orderId": "ord_456"
    }
  ]
}
Restrições:
Cancelamentos excessivos geram penalidades
Após certo ponto, a loja é temporariamente fechada
Alguns períodos têm limite de cancelamentos
Fluxo com diagrama:
Service
API
Client
Service
API
Client
GET /cancellationReasons
Códigos válidos
POST /requestCancellation
Accepted (202)
Validar cancelamento
Aprovado/Rejeitado
GET /polling
CANCELLED ou CANCELLATION_REQUEST_FAILED
12. Validar coleta (Pickup)
Se habilitado, o entregador fornece código de coleta:

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/validatePickupCode" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
Validação: Compare com pickupCode nos detalhes do pedido.
Resposta (200 OK):

{ "valid": true }
13. Confirmar entrega
Entrega iFood
Automático — entregador confirma via app.
Entrega própria
Compartilhe link com entregador:

https://confirmacao-entrega-propria.ifood.com.br/
Imprima o localizador (phone.localizer) na comanda para referência.
Validar entrega

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/orders/ord_456/verifyDeliveryCode" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "654321"
  }'
Resposta (200 OK):

{ "valid": true }
Após validação, sistema marca automaticamente como CONCLUDED.
14. Processar modificações de pedido
Cliente remove/adiciona itens após confirmação:

{
  "events": [
    {
      "code": "ORDER_PATCHED",
      "orderId": "ord_456",
      "metadata": {
        "changeType": "DELETE_ITEMS",
        "items": [
          {
            "id": "item_789",
            "name": "Burger",
            "quantity": 1
          }
        ]
      }
    }
  ]
}
Ações necessárias:
Atualizar comanda na cozinha (remover item)
Atualizar sistema de billing
Confirmar leitura do evento
15. Processar disputas pós-entrega
Cliente disputa após entrega? Responda na negociação:

curl -X POST "https://merchant-api.ifood.com.br/order/v1.0/disputes/dispute_123/accept" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "CUSTOMER_SATISFACTION",
    "detailReason": "Reembolso por cortesia"
  }'
Opções de resposta:
/accept — Concordar com cancelamento
/reject — Discordar da proposta
/alternative — Oferecer reembolso ou tempo adicional
Crítico: Você tem até expiresAt para responder. Sem resposta = ação automática (reembolso).
Saiba mais: Plataforma de Negociação
16. Conclusão automática
iFood marca automaticamente como CONCLUDED após:
Tipo	Imediato	Agendado
Restaurante + iFood	Entrega ou 6h	6h após scheduling.to
Restaurante + Própria	4h	4h após scheduling.to
Mercado/Farmácia	13h	13h após scheduling.to
Todos incluem deliveryTimeInSeconds (configuração da loja).
Você receberá evento CONCLUDED:

{
  "code": "CONCLUDED",
  "orderId": "ord_456",
  "createdAt": "2024-04-25T19:00:00Z"
}
17. Checklist de implementação
Use isso para validar se cobriu todos os casos:
 Consumindo eventos (polling ou webhook)
 Confirmando leitura com /acknowledgment
 Obtendo detalhes do pedido
 Confirmando dentro de 8 minutos
 Iniciando preparação
 Notificando pronto (TAKEOUT/DINE_IN obrigatório)
 Despachando entrega própria
 Rastreando entregador iFood
 Validando códigos de coleta/entrega
 Cancelando pedidos com motivo válido
 Processando ORDER_PATCHED
 Respondendo a disputas (Handshake)
 Tratando erros comuns