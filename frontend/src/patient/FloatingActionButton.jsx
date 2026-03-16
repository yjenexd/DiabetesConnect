import { useState } from 'react'
import { Plus, Utensils, Droplet, Pill, X } from 'lucide-react'

export default function FloatingActionButton({ onSelect }) {
  const [open, setOpen] = useState(false)

  const actions = [
    { id: 'meal', label: 'Log Meal', icon: Utensils, color: 'bg-orange-500' },
    { id: 'glucose', label: 'Log Glucose', icon: Droplet, color: 'bg-blue-500' },
    { id: 'medication', label: 'Log Medication', icon: Pill, color: 'bg-green-500' },
  ]

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      {/* Expanded actions */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-20 left-1/2 mb-2 flex -translate-x-1/2 flex-col gap-3 items-center">
            {actions.map(a => (
              <button
                key={a.id}
                onClick={() => { setOpen(false); onSelect(a.id) }}
                className="flex items-center gap-2"
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

      {/* Main button */}
      <button
        onClick={() => setOpen(!open)}
        className={`h-16 w-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-gray-600 rotate-45' : 'bg-primary-600 hover:bg-primary-700'
        } text-white`}
      >
        {open ? <X className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
      </button>
    </div>
  )
}
