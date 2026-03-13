import { Target, CheckCircle2, Circle } from 'lucide-react'

export default function GoalsSection({ goals = [] }) {
  if (!goals.length) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-primary-600" />
        <h3 className="font-bold text-gray-800">My Goals</h3>
      </div>
      <div className="space-y-3">
        {goals.map((g, i) => {
          const progress = g.current_value && g.target_value
            ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
            : null

          return (
            <div key={i} className="flex items-start gap-3">
              {g.status === 'completed'
                ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{g.description || g.goal_type}</p>
                {g.target_value && (
                  <p className="text-xs text-gray-500">
                    Target: {g.target_value} {g.unit || ''}
                    {g.current_value != null && ` · Current: ${g.current_value}`}
                  </p>
                )}
                {progress != null && (
                  <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
