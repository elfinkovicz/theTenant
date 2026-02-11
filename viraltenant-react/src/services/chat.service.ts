import { ChatRoom, ConnectionState, ChatToken } from 'amazon-ivs-chat-messaging'

export interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp: Date
  userId?: string
  attributes?: Record<string, string>
}

export interface ChatUser {
  id: string
  username: string
  attributes?: Record<string, string>
}

class ChatService {
  private chatRoom: ChatRoom | null = null
  private messageHandlers: Set<(message: ChatMessage) => void> = new Set()
  private connectionHandlers: Set<(state: ConnectionState) => void> = new Set()
  private currentUser: ChatUser | null = null

  /**
   * Initialisiert den Chat mit AWS IVS Chat
   * Benötigt ein Chat-Token vom Backend
   */
  async connect(chatToken: string, username: string): Promise<void> {
    try {
      // Erstelle Chat Room
      const token: ChatToken = {
        token: chatToken,
        sessionExpirationTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 Stunden
        tokenExpirationTime: new Date(Date.now() + 3 * 60 * 60 * 1000)
      }

      this.chatRoom = new ChatRoom({
        regionOrUrl: 'eu-central-1',
        tokenProvider: () => Promise.resolve(token)
      })

      this.currentUser = {
        id: chatToken.split(':')[0] || 'anonymous',
        username
      }

      // Event Listener
      this.chatRoom.addListener('connect', () => {
        console.log('Chat connected')
        this.notifyConnectionHandlers('connected' as ConnectionState)
      })

      this.chatRoom.addListener('disconnect', () => {
        console.log('Chat disconnected')
        this.notifyConnectionHandlers('disconnected' as ConnectionState)
      })

      this.chatRoom.addListener('message', (message: any) => {
        // Extrahiere Username aus Attributes (vom Backend gesetzt)
        const username = message.sender?.attributes?.username || 
                        message.attributes?.username || 
                        message.sender?.userId?.split('@')[0] || 
                        'Anonymous'
        
        const chatMessage: ChatMessage = {
          id: message.id,
          username: username,
          message: message.content || '',
          timestamp: new Date(message.sendTime),
          userId: message.sender?.userId,
          attributes: message.attributes
        }
        this.notifyMessageHandlers(chatMessage)
      })

      // Verbinde zum Chat
      await this.chatRoom.connect()
    } catch (error) {
      console.error('Failed to connect to chat:', error)
      throw error
    }
  }

  /**
   * Sendet eine Nachricht
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.chatRoom) {
      throw new Error('Chat not connected')
    }

    try {
      const request = {
        action: 'SEND_MESSAGE' as const,
        content: message,
        requestId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      await this.chatRoom.sendMessage(request)
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  /**
   * Trennt die Chat-Verbindung
   */
  disconnect(): void {
    if (this.chatRoom) {
      this.chatRoom.disconnect()
      this.chatRoom = null
    }
    this.currentUser = null
  }

  /**
   * Registriert einen Message Handler
   */
  onMessage(handler: (message: ChatMessage) => void): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  /**
   * Registriert einen Connection State Handler
   */
  onConnectionStateChange(handler: (state: ConnectionState) => void): () => void {
    this.connectionHandlers.add(handler)
    return () => this.connectionHandlers.delete(handler)
  }

  private notifyMessageHandlers(message: ChatMessage): void {
    this.messageHandlers.forEach(handler => handler(message))
  }

  private notifyConnectionHandlers(state: ConnectionState): void {
    this.connectionHandlers.forEach(handler => handler(state))
  }

  getCurrentUser(): ChatUser | null {
    return this.currentUser
  }

  isConnected(): boolean {
    return this.chatRoom !== null
  }
}

export const chatService = new ChatService()
