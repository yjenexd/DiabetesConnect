import { useState, useRef, useEffect } from 'react'
import { Mic, Square, X } from 'lucide-react'

export default function VoiceRecorder({ onComplete, onCancel }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const MAX_SECONDS = 30

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
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
      alert('Could not access microphone. Please allow microphone permission.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    setRecording(false)
  }

  const formatted = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center w-72 shadow-xl">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
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

        {!recording ? (
          <button onClick={startRecording} className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="w-full py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition flex items-center justify-center gap-2">
            <Square className="w-4 h-4" /> Stop & Send
          </button>
        )}

        <button onClick={onCancel} className="mt-3 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  )
}
