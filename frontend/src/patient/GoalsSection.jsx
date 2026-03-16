import { Target, CheckCircle2, Circle } from 'lucide-react'

export default function GoalsSection({ goals = [] }) {
  if (!goals.length) return null

  return (
    <div className="bg-white rounded-2xl border p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary-600" />
        <h3 className="font-bold text-gray-800">My Goals</h3>
      </div>
      <div className="space-y-3">
        {goals.map((goal) => {
          const progress = goal.compliance_rate != null
            ? Math.max(0, Math.min(100, Math.round(goal.compliance_rate * 100)))
            : null

          return (
            <div key={goal.id} className="flex items-start gap-3">
              {progress === 100
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">{goal.description || goal.goal_type}</p>
                {goal.target_value != null && (
                  <p className="text-xs text-gray-500">
                    Target: {goal.target_value} {goal.target_unit || ''}
                  </p>
                )}
                {progress != null && (
                  <>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{progress}% compliance</p>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
