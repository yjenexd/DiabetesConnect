import { useState } from 'react'
import { Plus, Utensils, Droplet, Pill, X, MessageCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

export default function FloatingActionButton({ onSelect }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [open, setOpen] = useState(false)

  const actions = [
    { id: 'meal', label: 'Log Meal', icon: Utensils, color: 'bg-orange-500' },
    { id: 'glucose', label: 'Log Glucose', icon: Droplet, color: 'bg-blue-500' },
    { id: 'medication', label: 'Log Medication', icon: Pill, color: 'bg-green-500' },
  ]

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Expanded actions */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-20 right-0 mb-2 flex flex-col gap-3 items-end">
            {actions.map((a, i) => (
              <button
                key={a.id}
                onClick={() => { setOpen(false); onSelect(a.id) }}
                className="flex items-center gap-2 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="bg-white shadow-md rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700">
                  {a.label}
                </span>
                <span className={`w-12 h-12 ${a.color} rounded-full flex items-center justify-center shadow-lg text-white`}>
                  <a.icon className="w-5 h-5" />
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Chat button */}
      <button
        onClick={() => navigate(`/patient/${id}/chat`)}
        className="mb-3 h-16 w-16 rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg flex items-center justify-center text-white transition hover:scale-110 active:scale-95"
      >
        <MessageCircle className="w-7 h-7" />
      </button>

      {/* Main + button */}
      <button
        onClick={() => setOpen(!open)}
        className={`h-16 w-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
          open ? 'bg-gray-600 rotate-45' : 'bg-primary-600 hover:bg-primary-700'
        } text-white`}
      >
        {open ? <X className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
      </button>
    </div>
  )
}
