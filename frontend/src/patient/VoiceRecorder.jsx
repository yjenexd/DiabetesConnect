import { useState, useRef, useEffect } from 'react'
import { Mic, Square, X } from 'lucide-react'

export default function VoiceRecorder({ onComplete, onCancel }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const mediaRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const cancelledRef = useRef(false)
  const MAX_SECONDS = 30

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  async function startRecording() {
    try {
      cancelledRef.current = false
      setErrorMessage('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredMimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')
        ? 'audio/webm'
        : undefined
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
      streamRef.current = stream
      mediaRef.current = recorder
      chunksRef.current = []
      setSeconds(0)

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        if (cancelledRef.current) {
          chunksRef.current = []
          return
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]
          onComplete(base64)
        }
        reader.readAsDataURL(blob)
      }

      recorder.start()
      setRecording(true)
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev >= MAX_SECONDS - 1) { stopRecording(); return MAX_SECONDS }
          return prev + 1
        })
      }, 1000)
    } catch {
      setErrorMessage('Microphone access was blocked. Please allow microphone permission and try again.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    setRecording(false)
  }

  function handleCancel() {
    cancelledRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setSeconds(0)

    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop()
    } else {
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    onCancel()
  }

  const formatted = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center w-72 shadow-xl">
        <button onClick={handleCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
            recording ? 'bg-red-100 animate-pulse' : 'bg-primary-100'
          }`}>
            <Mic className={`w-10 h-10 ${recording ? 'text-red-500' : 'text-primary-600'}`} />
          </div>
        </div>

        <p className="text-2xl font-mono font-bold text-gray-800 mb-1">{formatted}</p>
        <p className="text-xs text-gray-400 mb-6">{MAX_SECONDS}s max</p>

        {errorMessage && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {!recording ? (
          <button onClick={startRecording} className="min-h-11 w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="min-h-11 w-full py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition flex items-center justify-center gap-2">
            <Square className="w-4 h-4" /> Stop & Send
          </button>
        )}

        <button onClick={handleCancel} className="mt-3 min-h-11 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  )
}
