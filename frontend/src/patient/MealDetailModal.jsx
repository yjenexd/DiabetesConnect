import { useState } from 'react'
import { X, Utensils, Pencil, Trash2 } from 'lucide-react'
import { updateMeal, deleteMeal } from '../shared/api'

function fmt24h(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MacroBar({ label, value, unit, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value != null && value > 0 ? `${value} ${unit}` : '—'}
      </span>
    </div>
  )
}

export default function MealDetailModal({ meal, patientId, onClose, onUpdated }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'confirmDelete'
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    food_name: meal.food_name || '',
    calories_estimate: meal.calories_estimate ?? '',
    carbs_grams: meal.carbs_grams ?? '',
    protein_grams: meal.protein_grams ?? '',
    fat_grams: meal.fat_grams ?? '',
    sodium_mg: meal.sodium_mg ?? '',
    sugar_grams: meal.sugar_grams ?? '',
    meal_type: meal.meal_type || 'snack',
  })

  if (!meal) return null

  const mealTypeLabel = meal.meal_type
    ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
    : 'Meal'

  const contextLabel = {
    hawker_food: 'Hawker food',
    home_cooked: 'Home cooked',
    restaurant: 'Restaurant',
  }[meal.cultural_context] || meal.cultural_context || '—'

  const loggedViaLabel = {
    chatbot: 'Chat',
    manual: 'Manual entry',
    photo: 'Photo',
  }[meal.logged_via] || meal.logged_via || '—'

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await updateMeal(patientId, meal.id, {
      food_name: form.food_name,
      calories_estimate: form.calories_estimate ? parseInt(form.calories_estimate, 10) : null,
      carbs_grams: form.carbs_grams ? parseFloat(form.carbs_grams) : null,
      protein_grams: form.protein_grams ? parseFloat(form.protein_grams) : null,
      fat_grams: form.fat_grams ? parseFloat(form.fat_grams) : null,
      sodium_mg: form.sodium_mg ? parseFloat(form.sodium_mg) : null,
      sugar_grams: form.sugar_grams ? parseFloat(form.sugar_grams) : null,
      meal_type: form.meal_type,
    })
    setSaving(false)
    if (error) { alert(error); return }
    onUpdated?.()
    onClose()
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await deleteMeal(patientId, meal.id)
    setSaving(false)
    if (error) { alert(error); return }
    onUpdated?.()
    onClose()
  }

  const inputCls = "w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <Utensils className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {mode === 'edit' ? 'Edit Meal' : meal.food_name}
              </h3>
              <p className="text-xs text-gray-400">{mealTypeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && (
              <>
                <button onClick={() => setMode('edit')} className="text-gray-400 hover:text-primary-600 transition">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setMode('confirmDelete')} className="text-gray-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View mode */}
        {mode === 'view' && (
          <>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex justify-between text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date</p>
                <p className="font-medium text-gray-800">{fmtDate(meal.meal_time)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Time</p>
                <p className="font-medium text-gray-800">{fmt24h(meal.meal_time)}</p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Nutrition</p>
              <MacroBar label="Calories" value={meal.calories_estimate} unit="kcal" color="text-orange-600" />
              <MacroBar label="Carbohydrates" value={meal.carbs_grams} unit="g" color="text-yellow-600" />
              <MacroBar label="Protein" value={meal.protein_grams} unit="g" color="text-blue-600" />
              <MacroBar label="Fat" value={meal.fat_grams} unit="g" color="text-red-500" />
              <MacroBar label="Sodium" value={meal.sodium_mg} unit="mg" color="text-purple-600" />
              <MacroBar label="Sugar" value={meal.sugar_grams} unit="g" color="text-pink-500" />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{contextLabel}</span>
              <span>Logged via {loggedViaLabel}</span>
            </div>
          </>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Food name</label>
              <input value={form.food_name} onChange={e => setForm({ ...form, food_name: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meal type</label>
              <select value={form.meal_type} onChange={e => setForm({ ...form, meal_type: e.target.value })} className={inputCls}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'calories_estimate', label: 'Calories', unit: 'kcal', step: '1' },
                { key: 'carbs_grams', label: 'Carbs', unit: 'g', step: '0.1' },
                { key: 'protein_grams', label: 'Protein', unit: 'g', step: '0.1' },
                { key: 'fat_grams', label: 'Fat', unit: 'g', step: '0.1' },
                { key: 'sodium_mg', label: 'Sodium', unit: 'mg', step: '1' },
                { key: 'sugar_grams', label: 'Sugar', unit: 'g', step: '0.1' },
              ].map(({ key, label, unit, step }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label} ({unit})</label>
                  <input type="number" min="0" step={step} value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className={inputCls} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setMode('view')}
                className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Confirm delete */}
        {mode === 'confirmDelete' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Remove <span className="font-semibold">{meal.food_name}</span> from your history?</p>
            <div className="flex gap-2">
              <button onClick={() => setMode('view')}
                className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition">
                {saving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
