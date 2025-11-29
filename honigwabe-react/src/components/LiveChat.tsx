import { useState, useEffect, useRef } from 'react'
import { Send, AlertCircle, Loader } from 'lucide-react'
import { chatService, ChatMessage } from '../services/chat.service'
import { useAuthStore } from '../store/authStore'
import { awsConfig } from '../config/aws-config'

interface LiveChatProps {
  isStreamLive: boolean
}

export const LiveChat = ({ isStreamLive }: LiveChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isStreamLive && isAuthenticated && user) {
      connectToChat()
    }

    return () => {
      chatService.disconnect()
    }
  }, [isStreamLive, isAuthenticated, user])

  useEffect(() => {
    // Auto-scroll zu neuen Nachrichten
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const connectToChat = async () => {
    if (!user) return

    setIsConnecting(true)
    setError(null)

    try {
      // Hole Chat-Token vom Backend
      const response = await fetch(`${awsConfig.api.chat}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.email,
          username: user.username || user.email.split('@')[0], // Verwende Username oder E-Mail-Teil
          capabilities: ['SEND_MESSAGE']
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get chat token')
      }

      const { token } = await response.json()

      // Verbinde zum Chat
      await chatService.connect(token, user.username || user.email.split('@')[0])

      // Registriere Message Handler
      chatService.onMessage((message) => {
        setMessages(prev => {
          const newMessages = [...prev, message]
          // Behalte nur die letzten 50 Nachrichten
          return newMessages.slice(-50)
        })
      })

      setIsConnected(true)
      setIsConnecting(false)
    } catch (err) {
      console.error('Failed to connect to chat:', err)
      setError('Verbindung zum Chat fehlgeschlagen')
      setIsConnecting(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !isConnected) return

    try {
      await chatService.sendMessage(newMessage)
      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Nachricht konnte nicht gesendet werden')
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Zeige Login-Aufforderung wenn nicht eingeloggt (auch wenn Stream live ist)
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full">
        {/* Zeige dass Stream live ist */}
        {isStreamLive && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Stream ist live
            </span>
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <AlertCircle size={48} className="mx-auto mb-4 text-primary-500" />
            <p className="text-dark-400 mb-4">Melde dich an, um am Chat teilzunehmen</p>
            <a href="/login" className="btn-primary inline-block">
              Jetzt anmelden
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Wenn eingeloggt aber Stream nicht live
  if (!isStreamLive) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <AlertCircle size={48} className="mx-auto mb-4 text-dark-500" />
          <p className="text-dark-400">Chat ist verfügbar wenn der Stream live ist</p>
        </div>
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader size={48} className="mx-auto mb-4 text-primary-500 animate-spin" />
          <p className="text-dark-400">Verbinde zum Chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={connectToChat} className="btn-secondary">
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-dark-500 py-8">
            <p>Noch keine Nachrichten</p>
            <p className="text-sm mt-2">Sei der Erste, der etwas schreibt! 👋</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-dark-800 rounded-lg p-3 hover:bg-dark-750 transition-colors"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-primary-400 text-sm font-semibold">
                  {msg.username}
                </span>
                <span className="text-dark-500 text-xs">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-dark-200 break-words">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage(e)
            }
          }}
          placeholder="Schreibe eine Nachricht..."
          className="input flex-1"
          maxLength={500}
          disabled={!isConnected}
        />
        <button 
          type="submit" 
          className="btn-primary px-4"
          disabled={!isConnected || !newMessage.trim()}
        >
          <Send size={20} />
        </button>
      </form>

      {/* Connection Status */}
      {isConnected && (
        <div className="mt-2 text-xs text-center text-green-500 flex items-center justify-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Verbunden
        </div>
      )}
    </div>
  )
}
