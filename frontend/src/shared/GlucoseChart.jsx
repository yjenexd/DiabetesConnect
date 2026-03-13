import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea } from 'recharts'

export default function GlucoseChart({ readings = [], height = 250 }) {
  // Process readings for chart — take last 14 data points, sorted by time
  const sorted = [...readings]
    .sort((a, b) => new Date(a.measurement_time) - new Date(b.measurement_time))
    .slice(-14)

  const data = sorted.map(r => ({
    date: new Date(r.measurement_time).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
    time: new Date(r.measurement_time).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }),
    value: r.value_mmol,
    context: r.context,
  }))

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
              if (payload && payload[0]) return `${label} ${payload[0].payload.time} (${payload[0].payload.context})`
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
