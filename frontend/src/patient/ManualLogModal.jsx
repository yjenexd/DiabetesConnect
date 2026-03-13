import { useState } from 'react'
import { X, Utensils, Droplet, Pill } from 'lucide-react'
import { logMealManual as logMeal, logGlucoseManual as logGlucose, logMedicationManual as logMedication } from '../shared/api'

const TABS = {
  meal: { label: 'Log Meal', icon: Utensils, color: 'text-orange-500' },
  glucose: { label: 'Log Glucose', icon: Droplet, color: 'text-blue-500' },
  medication: { label: 'Log Medication', icon: Pill, color: 'text-green-500' },
}

export default function ManualLogModal({ mode, patientId, onClose, onSuccess }) {
  const [tab, setTab] = useState(mode || 'meal')
  const [loading, setLoading] = useState(false)
  const [mealForm, setMealForm] = useState({ description: '', meal_type: 'lunch', notes: '' })
  const [glucoseForm, setGlucoseForm] = useState({ value: '', context: 'before_meal', notes: '' })
  const [medForm, setMedForm] = useState({ medication_name: '', taken: true })

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    let result
    if (tab === 'meal') {
      result = await logMeal(patientId, mealForm)
    } else if (tab === 'glucose') {
      result = await logGlucose(patientId, { ...glucoseForm, value: parseFloat(glucoseForm.value) })
    } else {
      result = await logMedication(patientId, medForm)
    }
    setLoading(false)
    if (!result.error) {
      onSuccess?.()
      onClose()
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Quick Log</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
          {Object.entries(TABS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === key ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              <t.icon className={`w-4 h-4 ${tab === key ? t.color : ''}`} />
              {t.label.split(' ')[1]}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'meal' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What did you eat?</label>
                <textarea
                  value={mealForm.description}
                  onChange={e => setMealForm({ ...mealForm, description: e.target.value })}
                  placeholder="e.g. chicken rice with extra chilli"
                  className="w-full border rounded-xl px-4 py-3 text-[16px] resize-none h-20 focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal type</label>
                <select
                  value={mealForm.meal_type}
                  onChange={e => setMealForm({ ...mealForm, meal_type: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  value={mealForm.notes}
                  onChange={e => setMealForm({ ...mealForm, notes: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                />
              </div>
            </>
          )}

          {tab === 'glucose' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Glucose reading (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="35"
                  value={glucoseForm.value}
                  onChange={e => setGlucoseForm({ ...glucoseForm, value: e.target.value })}
                  placeholder="e.g. 7.8"
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                <select
                  value={glucoseForm.context}
                  onChange={e => setGlucoseForm({ ...glucoseForm, context: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                >
                  <option value="fasting">Fasting</option>
                  <option value="before_meal">Before meal</option>
                  <option value="after_meal">After meal (2h)</option>
                  <option value="bedtime">Bedtime</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  value={glucoseForm.notes}
                  onChange={e => setGlucoseForm({ ...glucoseForm, notes: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                />
              </div>
            </>
          )}

          {tab === 'medication' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication name</label>
                <input
                  value={medForm.medication_name}
                  onChange={e => setMedForm({ ...medForm, medication_name: e.target.value })}
                  placeholder="e.g. Metformin 500mg"
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Taken?</label>
                <button
                  type="button"
                  onClick={() => setMedForm({ ...medForm, taken: !medForm.taken })}
                  className={`relative w-12 h-6 rounded-full transition ${medForm.taken ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${medForm.taken ? 'left-6' : 'left-0.5'}`} />
                </button>
                <span className="text-sm text-gray-600">{medForm.taken ? 'Yes' : 'No'}</span>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
