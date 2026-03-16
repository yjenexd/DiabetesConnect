import { useState } from 'react'
import { X, Utensils, Droplet, Pill, Sparkles } from 'lucide-react'
import { logMealManual as logMeal, logGlucoseManual as logGlucose, logMedicationManual as logMedication, lookupMealNutrition } from '../shared/api'

const TABS = {
  meal: { label: 'Log Meal', icon: Utensils, color: 'text-orange-500' },
  glucose: { label: 'Log Glucose', icon: Droplet, color: 'text-blue-500' },
  medication: { label: 'Log Medication', icon: Pill, color: 'text-green-500' },
}

export default function ManualLogModal({ mode, patientId, medications = [], onClose, onSuccess }) {
  const [tab, setTab] = useState(mode || 'meal')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mealForm, setMealForm] = useState({ food_name: '', calories_estimate: '', carbs_grams: '', protein_grams: '', fat_grams: '', meal_type: 'lunch' })
  const [lookingUp, setLookingUp] = useState(false)
  const [glucoseForm, setGlucoseForm] = useState({ value_mmol: '', context: 'pre_meal' })
  const [medForm, setMedForm] = useState({ medication_name: medications[0]?.name || '', action: 'taken' })

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    let result
    if (tab === 'meal') {
      result = await logMeal(patientId, {
        food_name: mealForm.food_name,
        calories_estimate: mealForm.calories_estimate ? parseInt(mealForm.calories_estimate, 10) : null,
        carbs_grams: mealForm.carbs_grams ? parseFloat(mealForm.carbs_grams) : null,
        protein_grams: mealForm.protein_grams ? parseFloat(mealForm.protein_grams) : null,
        fat_grams: mealForm.fat_grams ? parseFloat(mealForm.fat_grams) : null,
        meal_type: mealForm.meal_type,
      })
    } else if (tab === 'glucose') {
      result = await logGlucose(patientId, {
        value_mmol: parseFloat(glucoseForm.value_mmol),
        context: glucoseForm.context,
      })
    } else {
      result = await logMedication(patientId, medForm)
    }
    setLoading(false)
    if (!result.error) {
      setSuccess(true)
      window.setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 900)
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Quick Log</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            Saved successfully.
          </div>
        )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Food name</label>
                <div className="flex gap-2">
                  <input
                    value={mealForm.food_name}
                    onChange={e => setMealForm({ ...mealForm, food_name: e.target.value })}
                    placeholder="e.g. chicken rice"
                    className="flex-1 border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    disabled={!mealForm.food_name.trim() || lookingUp}
                    onClick={async () => {
                      setLookingUp(true)
                      const { data } = await lookupMealNutrition(mealForm.food_name)
                      if (data) {
                        setMealForm(f => ({
                          ...f,
                          calories_estimate: data.calories ?? f.calories_estimate,
                          carbs_grams: data.carbs_grams ?? f.carbs_grams,
                          protein_grams: data.protein_grams ?? f.protein_grams,
                          fat_grams: data.fat_grams ?? f.fat_grams,
                        }))
                      }
                      setLookingUp(false)
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 disabled:opacity-40 transition shrink-0"
                    title="AI Lookup"
                  >
                    <Sparkles className="w-4 h-4" />
                    {lookingUp ? '…' : 'AI'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input
                    type="number"
                    min="0"
                    value={mealForm.calories_estimate}
                    onChange={e => setMealForm({ ...mealForm, calories_estimate: e.target.value })}
                    className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={mealForm.carbs_grams}
                    onChange={e => setMealForm({ ...mealForm, carbs_grams: e.target.value })}
                    className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={mealForm.protein_grams}
                    onChange={e => setMealForm({ ...mealForm, protein_grams: e.target.value })}
                    className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={mealForm.fat_grams}
                    onChange={e => setMealForm({ ...mealForm, fat_grams: e.target.value })}
                    className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  />
                </div>
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
                  value={glucoseForm.value_mmol}
                  onChange={e => setGlucoseForm({ ...glucoseForm, value_mmol: e.target.value })}
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
                  <option value="pre_meal">Before meal</option>
                  <option value="post_meal">After meal (2h)</option>
                  <option value="bedtime">Bedtime</option>
                </select>
              </div>
            </>
          )}

          {tab === 'medication' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication name</label>
                <select
                  value={medForm.medication_name}
                  onChange={e => setMedForm({ ...medForm, medication_name: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-[16px] focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  required
                >
                  <option value="">Select medication</option>
                  {medications.map((medication) => (
                    <option key={medication.id} value={medication.name}>{medication.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMedForm({ ...medForm, action: 'taken' })}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${medForm.action === 'taken' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Taken ✓
                </button>
                <button
                  type="button"
                  onClick={() => setMedForm({ ...medForm, action: 'skipped' })}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${medForm.action === 'skipped' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Skipped ✗
                </button>
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
