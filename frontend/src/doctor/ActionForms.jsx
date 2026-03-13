import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createDoctorAction } from '../shared/api'

const TITLES = {
  prescribe_medication: 'Prescribe Medication',
  lifestyle_change: 'Lifestyle Change',
  request_history: 'Request History',
  referral: 'Referral',
}

const FREQUENCY_OPTIONS = ['1x daily AM', '1x daily PM', '2x daily', '3x daily']
const GOAL_TYPES = [
  { value: 'daily_carb_limit', label: 'Daily carb limit', unit: 'grams_per_day' },
  { value: 'exercise_target', label: 'Exercise target', unit: 'minutes_per_day' },
  { value: 'weight_target', label: 'Weight target', unit: 'kg' },
  { value: 'meal_timing', label: 'Meal timing', unit: 'hours' },
]
const REFERRAL_TYPES = ['Eye screening', 'Foot exam', 'Blood test', 'Specialist', 'Dietitian']
const HISTORY_SUGGESTIONS = ['Family history of diabetes', 'Previous surgeries', 'Current supplements']

export default function ActionForms({ actionType, patientId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => {
    if (actionType === 'prescribe_medication') return { medication_name: '', dosage: '', frequency: '2x daily', notes: '' }
    if (actionType === 'lifestyle_change') return { goal_type: GOAL_TYPES[0].value, target_value: '', target_unit: GOAL_TYPES[0].unit, description: '' }
    if (actionType === 'request_history') return { request_text: '' }
    if (actionType === 'referral') return { referral_type: REFERRAL_TYPES[0], description: '', suggested_date: '' }
    return {}
  })

  function update(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createDoctorAction(patientId, { action_type: actionType, action_data: form })
    setLoading(false)
    if (!error) onSuccess()
    else alert(error)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-gray-800">{TITLES[actionType]}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {actionType === 'prescribe_medication' && (
            <>
              <Field label="Medication name">
                <input value={form.medication_name} onChange={e => update('medication_name', e.target.value)} required className={INPUT} placeholder="e.g. Metformin" />
              </Field>
              <Field label="Dosage">
                <input value={form.dosage} onChange={e => update('dosage', e.target.value)} required className={INPUT} placeholder="e.g. 500mg" />
              </Field>
              <Field label="Frequency">
                <select value={form.frequency} onChange={e => update('frequency', e.target.value)} className={INPUT}>
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={INPUT + ' h-20 resize-none'} />
              </Field>
            </>
          )}

          {actionType === 'lifestyle_change' && (
            <>
              <Field label="Goal type">
                <select
                  value={form.goal_type}
                  onChange={e => {
                    const gt = GOAL_TYPES.find(g => g.value === e.target.value)
                    setForm(f => ({ ...f, goal_type: gt.value, target_unit: gt.unit }))
                  }}
                  className={INPUT}
                >
                  {GOAL_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
              <Field label={`Target value (${form.target_unit})`}>
                <input type="number" value={form.target_value} onChange={e => update('target_value', e.target.value)} required className={INPUT} />
              </Field>
              <Field label="Description for patient">
                <textarea value={form.description} onChange={e => update('description', e.target.value)} required className={INPUT + ' h-20 resize-none'} placeholder="What should the patient aim for?" />
              </Field>
            </>
          )}

          {actionType === 'request_history' && (
            <>
              <Field label="What information do you need?">
                <textarea value={form.request_text} onChange={e => update('request_text', e.target.value)} required className={INPUT + ' h-24 resize-none'} placeholder="Please provide your..." />
              </Field>
              <div className="flex flex-wrap gap-2">
                {HISTORY_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('request_text', s)}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {actionType === 'referral' && (
            <>
              <Field label="Referral type">
                <select value={form.referral_type} onChange={e => update('referral_type', e.target.value)} className={INPUT}>
                  {REFERRAL_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={e => update('description', e.target.value)} required className={INPUT + ' h-20 resize-none'} placeholder="Reason for referral..." />
              </Field>
              <Field label="Suggested date">
                <input type="date" value={form.suggested_date} onChange={e => update('suggested_date', e.target.value)} className={INPUT} />
              </Field>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition flex items-center justify-center gap-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
