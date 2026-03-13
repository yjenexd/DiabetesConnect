import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Mic, Camera, Bot, User, ArrowLeft } from 'lucide-react'
import { sendChatMessage, getChatHistory } from '../shared/api'
import VoiceRecorder from './VoiceRecorder'
import PhotoUpload from './PhotoUpload'

export default function ChatInterface() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { loadHistory() }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadHistory() {
    const { data } = await getChatHistory(id)
    if (data?.messages) {
      setMessages(data.messages.map(m => ({
        role: m.role === 'patient' ? 'user' : 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      })))
    }
  }

  async function handleSend(text = input, inputType = 'text', audioBase64 = null, imageBase64 = null) {
    if (!text?.trim() && !audioBase64 && !imageBase64) return

    const userMsg = { role: 'user', content: text || (audioBase64 ? '🎤 Voice message' : '📷 Photo'), timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const { data, error } = await sendChatMessage(id, text || '', inputType, audioBase64, imageBase64)
    setLoading(false)

    if (data?.response) {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, timestamp: new Date().toISOString() }])
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: error || 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() }])
    }
  }

  function handleVoiceComplete(audioBase64) {
    setShowVoice(false)
    handleSend('', 'voice', audioBase64, null)
  }

  function handlePhotoComplete(imageBase64) {
    setShowPhoto(false)
    handleSend('Analyse this meal photo', 'photo', null, imageBase64)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(`/patient/${id}`)} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Health Companion</h1>
          <p className="text-xs text-primary-200">Your diabetes care assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <Bot className="w-12 h-12 mx-auto mb-2 text-primary-300" />
            <p className="text-sm">Hello! How can I help you today?</p>
            <p className="text-xs mt-1">Tell me what you ate, report your glucose, or ask a question.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-white text-gray-800 shadow-sm rounded-bl-md border'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                {msg.role === 'user'
                  ? <User className="w-3 h-3" />
                  : <Bot className="w-3 h-3 text-primary-500" />
                }
                <span className="text-[10px] opacity-70">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Voice / Photo overlays */}
      {showVoice && <VoiceRecorder onComplete={handleVoiceComplete} onCancel={() => setShowVoice(false)} />}
      {showPhoto && <PhotoUpload onComplete={handlePhotoComplete} onCancel={() => setShowPhoto(false)} />}

      {/* Input bar */}
      <div className="bg-white border-t px-3 py-3 flex items-center gap-2 shrink-0">
        <button onClick={() => setShowPhoto(true)} className="p-2 text-gray-500 hover:text-primary-600 transition" title="Take photo">
          <Camera className="w-6 h-6" />
        </button>
        <button onClick={() => setShowVoice(true)} className="p-2 text-gray-500 hover:text-primary-600 transition" title="Voice message">
          <Mic className="w-6 h-6" />
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="p-2 bg-primary-600 text-white rounded-full disabled:opacity-50 transition hover:bg-primary-700"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
