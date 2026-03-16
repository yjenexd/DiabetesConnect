/**
 * Medication adherence grid — schedule-based, 7-day view with actual dates.
 * Receives `schedule` from GET /api/patients/:id/med-schedule
 */
export default function MedAdherenceGrid({ schedule = [] }) {
  if (!schedule.length) {
    return <p className="text-xs text-gray-400 text-center py-4">No medication schedule found.</p>
  }

  // Collect unique dates and medication+time rows
  const dateSet = new Set()
  const rowKeySet = new Set()
  schedule.forEach(slot => {
    dateSet.add(slot.date)
    rowKeySet.add(`${slot.medication_name}|${slot.time_24h}`)
  })

  const dates = [...dateSet].sort()
  const rowKeys = [...rowKeySet].sort()

  // Build lookup: "medName|time|date" → status
  const lookup = {}
  schedule.forEach(slot => {
    lookup[`${slot.medication_name}|${slot.time_24h}|${slot.date}`] = slot.status
  })

  function cellColor(status) {
    if (status === 'taken') return 'bg-green-500'
    if (status === 'skipped' || status === 'missed') return 'bg-red-400'
    if (status === 'pending') return 'bg-yellow-300'
    if (status === 'delayed') return 'bg-orange-400'
    return 'bg-gray-200'
  }

  function fmtDateShort(isoDate) {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  }

  // Calculate overall adherence %
  const nonPending = schedule.filter(s => s.status !== 'pending')
  const taken = nonPending.filter(s => s.status === 'taken').length
  const pct = nonPending.length > 0 ? Math.round(taken / nonPending.length * 100) : 100

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-gray-500 font-medium pb-2 pr-2 whitespace-nowrap">Med / Time</th>
            {dates.map(d => (
              <th key={d} className="text-center text-gray-500 font-medium pb-2 px-1 whitespace-nowrap">
                {fmtDateShort(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map(rowKey => {
            const [medName, time] = rowKey.split('|')
            return (
              <tr key={rowKey}>
                <td className="text-gray-600 pr-2 py-1 whitespace-nowrap">
                  <span className="block font-medium">{medName}</span>
                  <span className="text-gray-400">{time}</span>
                </td>
                {dates.map(d => {
                  const status = lookup[`${medName}|${time}|${d}`] || null
                  return (
                    <td key={d} className="text-center py-1 px-1">
                      <div
                        className={`h-6 w-full rounded ${status ? cellColor(status) : 'bg-gray-100'}`}
                        title={status ? `${fmtDateShort(d)} ${time} — ${status}` : 'No data'}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Taken</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Missed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-300 inline-block" /> Pending</span>
        <span className="flex items-center gap-1 ml-auto font-bold">
          <span className={pct >= 85 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-600'}>
            {pct}% adherence
          </span>
        </span>
      </div>
    </div>
  )
}
