import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Utensils } from 'lucide-react'
import { getMeals } from '../shared/api'
import MealDetailModal from './MealDetailModal'

function fmt24h(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'Past Month' },
  { value: 'year', label: 'Past Year' },
  { value: 'all', label: 'All Time' },
]

export default function MealHistoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('month')
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState(null)

  useEffect(() => { loadMeals() }, [id, period])

  async function loadMeals() {
    setLoading(true)
    const { data } = await getMeals(id, period)
    setMeals(data?.meals || [])
    setLoading(false)
  }

  // Group meals by date
  const grouped = meals.reduce((acc, meal) => {
    const day = meal.meal_time?.slice(0, 10) || 'Unknown'
    if (!acc[day]) acc[day] = []
    acc[day].push(meal)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/patient/${id}`)} className="text-primary-200 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Meal History</h1>
            <p className="text-primary-100 text-xs mt-0.5">All logged meals</p>
          </div>
        </div>
      </div>

      {/* Period filter */}
      <div className="px-4 py-3 bg-white border-b sticky top-0 z-10">
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                period === p.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : meals.length === 0 ? (
          <div className="text-center pt-10 text-gray-400 text-sm">No meals logged for this period.</div>
        ) : (
          Object.entries(grouped).map(([day, dayMeals]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{fmtDate(`${day}T00:00:00`)}</p>
              <div className="bg-white rounded-xl shadow-sm divide-y">
                {dayMeals.map(meal => (
                  <button
                    key={meal.id}
                    onClick={() => setSelectedMeal(meal)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <Utensils className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{meal.food_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">{meal.meal_type} · {fmt24h(meal.meal_time)}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 shrink-0 ml-2">
                      {meal.carbs_grams != null && <span className="block">{meal.carbs_grams}g carbs</span>}
                      {meal.calories_estimate > 0 && <span className="block">{meal.calories_estimate} kcal</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          patientId={id}
          onClose={() => setSelectedMeal(null)}
          onUpdated={() => { setSelectedMeal(null); loadMeals() }}
        />
      )}
    </div>
  )
}
