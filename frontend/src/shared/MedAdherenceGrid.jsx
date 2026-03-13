/**
 * Medication adherence grid — shows 7-day AM/PM adherence.
 */
export default function MedAdherenceGrid({ medLogs = [], medications = [] }) {
  // Build a 7-day grid from the most recent logs
  const now = new Date()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const dayLabels = days.map(d => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-SG', { weekday: 'short' })
  })

  // Group logs by day + AM/PM
  const grid = {}
  days.forEach(d => { grid[d] = { am: null, pm: null } })

  medLogs.forEach(log => {
    const logDate = (log.scheduled_time || log.actual_time || '').slice(0, 10)
    if (!grid[logDate]) return
    const hour = parseInt((log.scheduled_time || log.actual_time || '12:00').slice(11, 13) || '12', 10)
    const period = hour < 14 ? 'am' : 'pm'
    if (log.action === 'taken') grid[logDate][period] = 'taken'
    else if (log.action === 'skipped') grid[logDate][period] = 'skipped'
    else if (!grid[logDate][period]) grid[logDate][period] = 'unknown'
  })

  // Calculate adherence %
  let total = 0, taken = 0
  medLogs.forEach(l => { total++; if (l.action === 'taken') taken++ })
  const pct = total > 0 ? Math.round(taken / total * 100) : 100

  const cellColor = (status) => {
    if (status === 'taken') return 'bg-green-500'
    if (status === 'skipped') return 'bg-red-500'
    return 'bg-gray-200'
  }

  return (
    <div>
      <div className="grid grid-cols-8 gap-1 text-xs text-center">
        <div></div>
        {dayLabels.map((d, i) => <div key={i} className="font-medium text-gray-600">{d}</div>)}
        <div className="font-medium text-gray-600 text-right pr-1">AM</div>
        {days.map((d, i) => (
          <div key={`am-${i}`} className={`h-7 rounded ${cellColor(grid[d]?.am)}`} title={`${d} AM: ${grid[d]?.am || 'N/A'}`}></div>
        ))}
        <div className="font-medium text-gray-600 text-right pr-1">PM</div>
        {days.map((d, i) => (
          <div key={`pm-${i}`} className={`h-7 rounded ${cellColor(grid[d]?.pm)}`} title={`${d} PM: ${grid[d]?.pm || 'N/A'}`}></div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Taken</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"></span> Skipped</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block"></span> N/A</span>
        </div>
        <span className={`font-bold ${pct >= 85 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
          {pct}% adherence
        </span>
      </div>
    </div>
  )
}
