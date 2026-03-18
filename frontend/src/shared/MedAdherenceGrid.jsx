/**
 * Medication adherence grid — schedule-based, 7-day view with actual dates.
 * Receives `schedule` from GET /api/patients/:id/med-schedule
 */
export default function MedAdherenceGrid({ schedule = [], mode = 'trend' }) {
  if (!schedule.length) {
    return <p className="text-xs text-gray-400 text-center py-4">No medication schedule found.</p>
  }

  function getLocalIsoDate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatSlotTime(time24h) {
    if (!time24h) return '--:--'
    return time24h
  }

  function statusBadge(status) {
    if (status === 'taken') return 'bg-green-100 text-green-700'
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700'
    if (status === 'delayed') return 'bg-orange-100 text-orange-700'
    if (status === 'missed' || status === 'skipped') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (mode === 'today') {
    const today = getLocalIsoDate()
    const todaySlots = schedule
      .filter(slot => slot.date === today)
      .sort((a, b) => `${a.time_24h}-${a.medication_name}`.localeCompare(`${b.time_24h}-${b.medication_name}`))

    const takenSlots = todaySlots.filter(slot => slot.status === 'taken')
    const toTakeSlots = todaySlots.filter(slot => slot.status !== 'taken')

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-700">To Take</p>
            <p className="mt-1 text-2xl font-bold text-yellow-800">{toTakeSlots.length}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Already Taken</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{takenSlots.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">To Take</h3>
            {toTakeSlots.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">All done for today 🎉</p>
            ) : (
              <div className="space-y-2">
                {toTakeSlots.map(slot => (
                  <div key={`${slot.medication_name}-${slot.time_24h}-${slot.date}`} className="rounded-lg border bg-white px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{slot.medication_name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-gray-500">{formatSlotTime(slot.time_24h)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(slot.status)}`}>
                        {slot.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Already Taken</h3>
            {takenSlots.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">No medications taken yet.</p>
            ) : (
              <div className="space-y-2">
                {takenSlots.map(slot => (
                  <div key={`${slot.medication_name}-${slot.time_24h}-${slot.date}`} className="rounded-lg border bg-white px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{slot.medication_name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-gray-500">{formatSlotTime(slot.time_24h)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(slot.status)}`}>
                        taken
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
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
