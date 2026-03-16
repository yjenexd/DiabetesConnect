import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea } from 'recharts'

export default function GlucoseChart({ readings = [], height = 250 }) {
  const byDay = new Map()

  readings.forEach((reading) => {
    if (!reading.measurement_time) return
    const dayKey = reading.measurement_time.slice(0, 10)
    const existing = byDay.get(dayKey) || { values: [], contexts: new Set() }
    existing.values.push(Number(reading.value_mmol))
    if (reading.context) existing.contexts.add(reading.context)
    byDay.set(dayKey, existing)
  })

  const data = [...byDay.entries()]
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-7)
    .map(([dayKey, dayData]) => {
      const average = dayData.values.reduce((sum, value) => sum + value, 0) / dayData.values.length
      const dateObj = new Date(`${dayKey}T00:00:00`)
      return {
        date: dateObj.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
        fullDate: dateObj.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
        value: Number(average.toFixed(1)),
        contexts: [...dayData.contexts].join(', '),
      }
    })

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 16]} tick={{ fontSize: 12 }} label={{ value: 'mmol/L', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
          <Tooltip
            formatter={(value) => [`${value} mmol/L`]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                const { fullDate, contexts } = payload[0].payload
                return contexts ? `${fullDate} (${contexts})` : fullDate
              }
              return label
            }}
          />
          {/* Target range 4-7 */}
          <ReferenceArea y1={4} y2={7} fill="#22c55e" fillOpacity={0.1} />
          <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'High', position: 'right', fill: '#ef4444', fontSize: 11 }} />
          <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Low', position: 'right', fill: '#f59e0b', fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
