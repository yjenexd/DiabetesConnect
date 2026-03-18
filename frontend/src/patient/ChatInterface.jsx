import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Mic, Camera, Bot, User, ArrowLeft, RefreshCw, AlertTriangle, Wrench, Check, X } from 'lucide-react'
import { sendChatMessage, getChatHistory, confirmMealLog, logMedicationManual } from '../shared/api'
import VoiceRecorder from './VoiceRecorder'
import PhotoUpload from './PhotoUpload'

function normaliseMealName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupePendingMeals(meals = []) {
  const bestByName = new Map()
  const score = (meal) => ['calories_estimate', 'carbs_grams', 'protein_grams', 'fat_grams']
    .reduce((count, key) => count + ((meal?.[key] || 0) > 0 ? 1 : 0), 0)

  meals.forEach((meal) => {
    const key = normaliseMealName(meal?.food_name)
    if (!key) return

    const current = bestByName.get(key)
    if (!current || score(meal) > score(current)) {
      bestByName.set(key, meal)
    }
  })

  return Array.from(bestByName.values())
}

function normaliseMedicationKey(item) {
  const name = (item?.medication_name || '').toLowerCase().trim()
  const action = (item?.action || 'taken').toLowerCase().trim()
  return `${name}|${action}`
}

function dedupePendingMedications(items = []) {
  const unique = new Map()
  items.forEach((item) => {
    const key = normaliseMedicationKey(item)
    if (!key || key === '|') return
    if (!unique.has(key)) unique.set(key, item)
  })
  return Array.from(unique.values())
}

function getPhotoPreviewSrc(imageBase64) {
  if (!imageBase64) return ''
  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
}

function notifyDashboardRefresh(patientId) {
  const payload = JSON.stringify({ patientId, timestamp: Date.now() })
  localStorage.setItem('dashboard-refresh', payload)
  window.dispatchEvent(new CustomEvent('dashboard-refresh', { detail: { patientId } }))
}

function MealConfirmCard({ meal, patientId, onDone }) {
  const [status, setStatus] = useState(null) // null | 'logging' | 'logged' | 'skipped'

  async function handleLog() {
    setStatus('logging')
    await confirmMealLog(patientId, {
      food_name: meal.food_name,
      calories_estimate: meal.calories_estimate || 0,
      carbs_grams: meal.carbs_grams || 0,
      protein_grams: meal.protein_grams || 0,
      fat_grams: meal.fat_grams || 0,
      meal_type: meal.meal_type || 'meal',
      cultural_context: meal.cultural_context || 'hawker_food',
    })
    notifyDashboardRefresh(patientId)
    setStatus('logged')
    setTimeout(() => onDone(), 1500)
  }

  return (
    <div className="flex justify-start mt-1">
      <div className="max-w-[80%] rounded-2xl rounded-bl-md border bg-orange-50 px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold text-orange-600 uppercase mb-1">Meal detected</p>
        <p className="text-sm font-medium text-gray-800">{meal.food_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {meal.calories_estimate > 0 && `~${meal.calories_estimate} kcal · `}{meal.carbs_grams > 0 && `${meal.carbs_grams}g carbs`}
        </p>
        {status === 'logged' ? (
          <p className="mt-2 text-xs font-medium text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Logged!</p>
        ) : status === 'skipped' ? (
          <p className="mt-2 text-xs text-gray-400">Skipped</p>
        ) : (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleLog}
              disabled={status === 'logging'}
              className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> {status === 'logging' ? 'Logging…' : 'Log this meal'}
            </button>
            <button
              onClick={() => { setStatus('skipped'); setTimeout(() => onDone(), 800) }}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              <X className="w-3 h-3" /> Skip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MedicationConfirmCard({ medication, patientId, onDone }) {
  const [status, setStatus] = useState(null) // null | 'logging' | 'logged' | 'skipped'

  async function handleLog() {
    setStatus('logging')
    await logMedicationManual(patientId, {
      medication_name: medication.medication_name,
      action: medication.action || 'taken',
      reason: medication.reason_if_skipped || null,
      scheduled_time: medication.scheduled_time || null,
    })
    notifyDashboardRefresh(patientId)
    setStatus('logged')
    setTimeout(() => onDone(), 1500)
  }

  return (
    <div className="flex justify-start mt-1">
      <div className="max-w-[80%] rounded-2xl rounded-bl-md border bg-green-50 px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold text-green-600 uppercase mb-1">Medication confirmation</p>
        <p className="text-sm font-medium text-gray-800">{medication.medication_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">Action: {medication.action || 'taken'}</p>
        {status === 'logged' ? (
          <p className="mt-2 text-xs font-medium text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Logged!</p>
        ) : status === 'skipped' ? (
          <p className="mt-2 text-xs text-gray-400">Skipped</p>
        ) : (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleLog}
              disabled={status === 'logging'}
              className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> {status === 'logging' ? 'Logging…' : 'Log medication'}
            </button>
            <button
              onClick={() => { setStatus('skipped'); setTimeout(() => onDone(), 800) }}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              <X className="w-3 h-3" /> Skip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
    const pendingMeals = dedupePendingMeals(data?.pending_meals || [])
    const pendingMedications = dedupePendingMedications(data?.pending_medications || [])
    return {
      role: 'assistant',
      content: data?.response || fallbackContent,
      timestamp: new Date().toISOString(),
      toolsCalled: data?.tools_called || [],
      alertsGenerated: data?.alerts_generated || [],
      pendingMeals,
      pendingMedications,
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
      content: trimmedText || (isVoice ? '🎙️ Recording…' : '📷 Meal photo'),
      timestamp: new Date().toISOString(),
      isVoice,
      imageBase64: inputType === 'photo' ? imageBase64 : null,
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
    <div className="h-screen flex flex-col bg-gray-50 animate-slide-up-screen">
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
          <div key={i}>
          <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'user' && msg.imageBase64 && (
                <img
                  src={getPhotoPreviewSrc(msg.imageBase64)}
                  alt="Uploaded meal"
                  className="mt-2 max-h-52 w-full rounded-xl object-cover"
                />
              )}
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
          {/* Meal confirmation cards */}

          {msg.role === 'assistant' && dedupePendingMeals(msg.pendingMeals || []).map((meal, mealIdx) => (
            <MealConfirmCard
              key={`${i}-meal-${mealIdx}`}
              meal={meal}
              patientId={id}
              onDone={() => {
                setMessages(prev => prev.map((m, mi) => {
                  if (mi !== i) return m
                  const targetKey = normaliseMealName(meal.food_name)
                  const updated = (m.pendingMeals || []).filter(
                    pendingMeal => normaliseMealName(pendingMeal.food_name) !== targetKey,
                  )
                  return { ...m, pendingMeals: updated }
                }))
              }}
            />
          ))}

          {msg.role === 'assistant' && dedupePendingMedications(msg.pendingMedications || []).map((medication, medIdx) => (
            <MedicationConfirmCard
              key={`${i}-med-${medIdx}`}
              medication={medication}
              patientId={id}
              onDone={() => {
                setMessages(prev => prev.map((m, mi) => {
                  if (mi !== i) return m
                  const targetKey = normaliseMedicationKey(medication)
                  const updated = (m.pendingMedications || []).filter(
                    pendingMedication => normaliseMedicationKey(pendingMedication) !== targetKey,
                  )
                  return { ...m, pendingMedications: updated }
                }))
              }}
            />
          ))}
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
