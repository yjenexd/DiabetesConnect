import { X, Utensils } from 'lucide-react'

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

export default function MealDetailModal({ meal, onClose }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <Utensils className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{meal.food_name}</h3>
              <p className="text-xs text-gray-400">{mealTypeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & time */}
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

        {/* Nutrition */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Nutrition</p>
          <MacroBar label="Calories" value={meal.calories_estimate} unit="kcal" color="text-orange-600" />
          <MacroBar label="Carbohydrates" value={meal.carbs_grams} unit="g" color="text-yellow-600" />
          <MacroBar label="Protein" value={meal.protein_grams} unit="g" color="text-blue-600" />
          <MacroBar label="Fat" value={meal.fat_grams} unit="g" color="text-red-500" />
        </div>

        {/* Meta */}
        <div className="flex justify-between text-xs text-gray-400">
          <span>{contextLabel}</span>
          <span>Logged via {loggedViaLabel}</span>
        </div>
      </div>
    </div>
  )
}
