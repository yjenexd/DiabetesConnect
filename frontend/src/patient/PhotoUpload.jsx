import { useState, useRef } from 'react'
import { Camera, Upload, X, Check } from 'lucide-react'

export default function PhotoUpload({ onComplete, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [base64, setBase64] = useState(null)
  const fileRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result)
      setBase64(reader.result.split(',')[1])
    }
    reader.readAsDataURL(file)
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

        {preview ? (
          <div className="mb-4">
            <img src={preview} alt="Meal preview" className="w-full h-48 object-cover rounded-xl" />
            <button onClick={() => { setPreview(null); setBase64(null) }} className="mt-2 text-sm text-gray-500 hover:text-gray-700">
              Retake
            </button>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.capture = 'environment'
                input.onchange = e => handleFile(e.target.files[0])
                input.click()
              }}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl hover:border-primary-400 hover:bg-primary-50 transition"
            >
              <Camera className="w-8 h-8 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Camera</span>
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = e => handleFile(e.target.files[0])
                input.click()
              }}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl hover:border-primary-400 hover:bg-primary-50 transition"
            >
              <Upload className="w-8 h-8 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Gallery</span>
            </button>
          </div>
        )}

        {base64 && (
          <button
            onClick={() => onComplete(base64)}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> Analyse Photo
          </button>
        )}
      </div>
    </div>
  )
}
