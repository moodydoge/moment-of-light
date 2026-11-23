import type { WebSocket } from 'ws'

type Client = {
  userId: string
  socket: WebSocket
}

const clients = new Set<Client>()

export function addClient(userId: string, socket: WebSocket) {
  const client = { userId, socket }
  clients.add(client)
  socket.on('close', () => clients.delete(client))
}

export function broadcastToUsers(
  userIds: string[],
  event: { type: string; payload?: unknown },
) {
  const set = new Set(userIds)
  const data = JSON.stringify(event)
  for (const client of clients) {
    if (!set.has(client.userId)) continue
    if (client.socket.readyState === 1) client.socket.send(data)
  }
}

export function broadcastAll(event: { type: string; payload?: unknown }) {
  const data = JSON.stringify(event)
  for (const client of clients) {
    if (client.socket.readyState === 1) client.socket.send(data)
  }
}
