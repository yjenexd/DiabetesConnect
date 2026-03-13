export default function PatientList({ patients = [], selectedId, onSelect }) {
  function riskColor(level) {
    if (level === 'high' || level === 'critical') return 'bg-red-500'
    if (level === 'medium' || level === 'warning') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  function summary(p) {
    const parts = []
    if (p.latest_glucose > 10) parts.push('Glucose elevated')
    else if (p.latest_glucose > 8) parts.push('Glucose rising')
    else parts.push('Glucose stable')

    if (p.adherence_pct != null && p.adherence_pct < 80) parts.push(`${Math.round(p.adherence_pct)}% adherence`)
    if (p.unacknowledged_alerts > 0) parts.push(`${p.unacknowledged_alerts} alert${p.unacknowledged_alerts > 1 ? 's' : ''}`)

    return parts.join(' · ') || 'On track'
  }

  if (!patients.length) {
    return <div className="p-4 text-center text-gray-400 text-sm">No patients found</div>
  }

  return (
    <div className="divide-y">
      {patients.map(p => (
        <button
          key={p.patient_id}
          onClick={() => onSelect(p.patient_id)}
          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${
            selectedId === p.patient_id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${riskColor(p.risk_level)}`} />
            <span className="font-semibold text-sm text-gray-800 truncate">{p.name}</span>
            <span className="text-xs text-gray-400 ml-auto">{p.age}{p.gender ? `/${p.gender[0].toUpperCase()}` : ''}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-4 truncate">{summary(p)}</p>
        </button>
      ))}
    </div>
  )
}
