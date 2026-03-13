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
    <div className="fixed bottom-20 right-4 z-40">
      {/* Expanded actions */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 items-end mb-2">
            {actions.map(a => (
              <button
                key={a.id}
                onClick={() => { setOpen(false); onSelect(a.id) }}
                className="flex items-center gap-2 animate-fade-in"
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
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-gray-600 rotate-45' : 'bg-primary-600 hover:bg-primary-700'
        } text-white`}
      >
        {open ? <X className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
      </button>
    </div>
  )
}
