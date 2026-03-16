import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Mic, Camera, Bot, User, ArrowLeft, RefreshCw, AlertTriangle, Wrench } from 'lucide-react'
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
  const [historyError, setHistoryError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [lastAttempt, setLastAttempt] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { loadHistory() }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadHistory() {
    setHistoryError('')
    const { data, error } = await getChatHistory(id)
    if (error) {
      setHistoryError('Could not load earlier messages. You can still start chatting.')
      return
    }

    if (data?.messages) {
      setMessages(data.messages.map(m => ({
        role: m.role === 'patient' ? 'user' : 'assistant',
        content: m.content,
        timestamp: m.timestamp,
        toolsCalled: [],
        alertsGenerated: [],
      })))
    }
  }

  function buildAssistantMessage(data, fallbackContent) {
    return {
      role: 'assistant',
      content: data?.response || fallbackContent,
      timestamp: new Date().toISOString(),
      toolsCalled: data?.tools_called || [],
      alertsGenerated: data?.alerts_generated || [],
    }
  }

  async function handleSend(text = input, inputType = 'text', audioBase64 = null, imageBase64 = null) {
    if (loading || (!text?.trim() && !audioBase64 && !imageBase64)) return

    const trimmedText = text?.trim() || ''
    const attempt = {
      text: trimmedText,
      inputType,
      audioBase64,
      imageBase64,
    }

    const isVoice = inputType === 'voice' && audioBase64
    const userMsg = {
      role: 'user',
      content: trimmedText || (isVoice ? '🎙️ Recording…' : 'Meal photo'),
      timestamp: new Date().toISOString(),
      isVoice,
    }

    setRequestError('')
    setLastAttempt(attempt)
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const { data, error } = await sendChatMessage(id, trimmedText, inputType, audioBase64, imageBase64)
    setLoading(false)

    if (data?.response) {
      // If voice input, update the user bubble with the transcribed text
      if (isVoice && data.transcribed_text) {
        setMessages(prev => {
          const updated = [...prev]
          // Find the last user voice message and update its content
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'user' && updated[i].isVoice) {
              updated[i] = { ...updated[i], content: `🎙️ "${data.transcribed_text}"` }
              break
            }
          }
          return [...updated, buildAssistantMessage(data, '')]
        })
      } else {
        setMessages(prev => [...prev, buildAssistantMessage(data, '')])
      }
    } else {
      const fallbackMessage = error || 'Sorry, something went wrong. Please try again.'
      setRequestError('The message did not go through. You can retry it.')
      // If voice, update the bubble to show it failed
      if (isVoice) {
        setMessages(prev => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'user' && updated[i].isVoice) {
              updated[i] = { ...updated[i], content: '🎙️ Voice message (failed to process)' }
              break
            }
          }
          return [...updated, buildAssistantMessage(null, fallbackMessage)]
        })
      } else {
        setMessages(prev => [...prev, buildAssistantMessage(null, fallbackMessage)])
      }
    }
  }

  function retryLastAttempt() {
    if (!lastAttempt || loading) return

    handleSend(
      lastAttempt.text,
      lastAttempt.inputType,
      lastAttempt.audioBase64,
      lastAttempt.imageBase64,
    )
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
        {historyError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start justify-between gap-3">
              <p>{historyError}</p>
              <button onClick={loadHistory} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-amber-800">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        )}
        {requestError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start justify-between gap-3">
              <p>{requestError}</p>
              <button onClick={retryLastAttempt} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-red-700">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        )}
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
              {msg.role === 'assistant' && Boolean(msg.toolsCalled?.length || msg.alertsGenerated?.length) && (
                <div className="mt-3 space-y-2">
                  {msg.toolsCalled?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.toolsCalled.map(toolName => (
                        <span key={`${i}-${toolName}`} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-[11px] text-primary-700">
                          <Wrench className="h-3 w-3" /> {toolName}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.alertsGenerated?.length > 0 && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                      <div className="mb-1 flex items-center gap-1 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> Care alerts raised
                      </div>
                      <div className="space-y-1">
                        {msg.alertsGenerated.map((alert, alertIndex) => (
                          <p key={`${i}-alert-${alertIndex}`}>{alert.title || alert.description || 'Health alert created'}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
        <button onClick={() => setShowPhoto(true)} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-primary-50 hover:text-primary-600 disabled:opacity-40" title="Take photo">
          <Camera className="w-6 h-6" />
        </button>
        <button onClick={() => setShowVoice(true)} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-primary-50 hover:text-primary-600 disabled:opacity-40" title="Voice message">
          <Mic className="w-6 h-6" />
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary-400"
          disabled={loading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
