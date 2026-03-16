import { useState, useRef } from 'react'
import { Camera, Upload, X, Check } from 'lucide-react'

export default function PhotoUpload({ onComplete, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [base64, setBase64] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image must be under 10MB.')
      return
    }

    setErrorMessage('')

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result)
      setBase64(reader.result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!base64 || submitting) return

    setSubmitting(true)
    try {
      await onComplete(base64)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Meal Photo</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={event => handleFile(event.target.files?.[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={event => handleFile(event.target.files?.[0])}
        />

        {preview ? (
          <div className="mb-4">
            <img src={preview} alt="Meal preview" className="w-full h-48 object-cover rounded-xl" />
            <button onClick={() => { setPreview(null); setBase64(null); setErrorMessage('') }} className="mt-2 min-h-11 text-sm text-gray-500 hover:text-gray-700">
              Retake
            </button>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-24 flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl hover:border-primary-400 hover:bg-primary-50 transition"
            >
              <Camera className="w-8 h-8 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Camera</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-24 flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl hover:border-primary-400 hover:bg-primary-50 transition"
            >
              <Upload className="w-8 h-8 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Gallery</span>
            </button>
          </div>
        )}

        {base64 && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-11 w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" /> {submitting ? 'Uploading...' : 'Analyse Photo'}
          </button>
        )}
      </div>
    </div>
  )
}
