import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea } from 'recharts'

function getLocalIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildTrendData(readings) {
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

  return data
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ---------------------------------------------------------------------------
// Postprandial glucose response curve  f(t) = (t/peak) * e^(1 – t/peak)
// ---------------------------------------------------------------------------
function postprandialCurve(minutesSinceMeal, peakMinutes = 60) {
  if (minutesSinceMeal < 0) return 0
  const t = minutesSinceMeal / peakMinutes
  return Math.max(0, t * Math.exp(1 - t))
}

// ---------------------------------------------------------------------------
// Build full-day timeline for "today" mode
//  – actual readings (blue solid line)
//  – predicted glucose from meal impacts (orange dashed)
//  – historical daily pattern (grey dotted)
// ---------------------------------------------------------------------------
function buildTodayTimeline(readings, meals, profile) {
  const todayIso = getLocalIsoDate()

  const todayReadings = readings
    .filter((r) => r.measurement_time?.startsWith(todayIso))
    .sort((a, b) => new Date(a.measurement_time) - new Date(b.measurement_time))

  const todayMeals = meals
    .filter((m) => m.meal_time?.startsWith(todayIso))
    .sort((a, b) => new Date(a.meal_time) - new Date(b.meal_time))

  const baseline = profile?.baseline_fasting ?? 5.5
  const carbFactor = profile?.carb_response_factor ?? 0.5
  const peakMin = profile?.peak_time_minutes ?? 60

  // Build a lookup from the backend's synthesised daily pattern
  const patternLookup = new Map()
  ;(profile?.daily_pattern || []).forEach((p) => patternLookup.set(p.time, p.value))

  // Generate 30-minute intervals from 06:00 to 23:30
  const points = []
  const xTicks = [] // for cleaner x-axis labels (every 2 hours)

  for (let totalMinutes = 360; totalMinutes <= 1410; totalMinutes += 30) {
    const hour = Math.floor(totalMinutes / 60)
    const minute = totalMinutes % 60
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    if (minute === 0 && hour % 2 === 0) xTicks.push(timeLabel)

    // ── Historical pattern value ──
    const historical = patternLookup.get(timeLabel) ?? null

    // ── Actual readings within 15 min of this slot ──
    const nearbyReadings = todayReadings.filter((r) => {
      const rDate = new Date(r.measurement_time)
      const rMinutes = rDate.getHours() * 60 + rDate.getMinutes()
      return Math.abs(rMinutes - totalMinutes) <= 15
    })
    const actual =
      nearbyReadings.length > 0
        ? Number((nearbyReadings.reduce((s, r) => s + Number(r.value_mmol), 0) / nearbyReadings.length).toFixed(1))
        : null

    // ── Predicted glucose: baseline + sum of postprandial curves from today's meals ──
    let predicted = baseline
    for (const meal of todayMeals) {
      const mealDate = new Date(meal.meal_time)
      const mealMinutes = mealDate.getHours() * 60 + mealDate.getMinutes()
      const minutesSinceMeal = totalMinutes - mealMinutes
      if (minutesSinceMeal >= 0 && minutesSinceMeal <= 240) {
        const carbs = meal.carbs_grams || 30
        const maxRise = carbFactor * (carbs / 10)
        predicted += maxRise * postprandialCurve(minutesSinceMeal, peakMin)
      }
    }
    predicted = Number(predicted.toFixed(1))

    // ── Meal marker ──
    const mealsAtSlot = todayMeals.filter((m) => {
      const mDate = new Date(m.meal_time)
      const mMinutes = mDate.getHours() * 60 + mDate.getMinutes()
      return Math.abs(mMinutes - totalMinutes) <= 15
    })

    points.push({
      time: timeLabel,
      actual,
      predicted: todayMeals.length > 0 ? predicted : null,
      historical,
      mealLabel: mealsAtSlot.length > 0 ? mealsAtSlot.map((m) => m.food_name).join(', ') : null,
      hasMeal: mealsAtSlot.length > 0,
    })
  }

  return {
    points,
    xTicks,
    hasMeals: todayMeals.length > 0,
    hasReadings: todayReadings.length > 0,
    hasHistorical: patternLookup.size > 0,
    mealCount: todayMeals.length,
    readingCount: todayReadings.length,
    baseline,
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip for the today timeline
// ---------------------------------------------------------------------------
function TodayTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {point.hasMeal && <p className="text-emerald-600 font-medium mb-1">🍽️ {point.mealLabel}</p>}
      {point.actual != null && <p className="text-blue-600">Actual: {point.actual} mmol/L</p>}
      {point.predicted != null && <p className="text-orange-500">Predicted: {point.predicted} mmol/L</p>}
      {point.historical != null && <p className="text-gray-400">Avg pattern: {point.historical} mmol/L</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom dot – highlights meal time-points on the predicted line
// ---------------------------------------------------------------------------
function MealDot({ cx, cy, payload }) {
  if (!payload?.hasMeal || payload?.predicted == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#10b981" fillOpacity={0.25} stroke="#10b981" strokeWidth={1.5} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#10b981" fontSize={10} fontWeight={600}>
        🍽️
      </text>
    </g>
  )
}

export default function GlucoseChart({ readings = [], meals = [], height = 250, mode = 'trend', glucoseProfile = null }) {
  // ── TREND MODE ──
  if (mode === 'trend') {
    const data = buildTrendData(readings)
    if (!data.length) {
      return <p className="text-xs text-gray-400 text-center py-4">No glucose readings available.</p>
    }
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
                if (payload?.[0]) {
                  const { fullDate, contexts } = payload[0].payload
                  return contexts ? `${fullDate} (${contexts})` : fullDate
                }
                return label
              }}
            />
            <ReferenceArea y1={4} y2={7} fill="#22c55e" fillOpacity={0.1} />
            <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'High', position: 'right', fill: '#ef4444', fontSize: 11 }} />
            <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Low', position: 'right', fill: '#f59e0b', fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── TODAY TIMELINE MODE ──
  const timeline = buildTodayTimeline(readings, meals, glucoseProfile)
  const { points, xTicks, hasMeals, hasReadings, hasHistorical, mealCount, readingCount, baseline } = timeline

  if (!hasReadings && !hasMeals && !hasHistorical) {
    return <p className="text-xs text-gray-400 text-center py-4">No glucose readings or meals logged today.</p>
  }

  // Compute Y domain from the visible data
  const allValues = points.flatMap((p) => [p.actual, p.predicted, p.historical].filter((v) => v != null))
  const yMax = Math.min(20, Math.max(12, Math.ceil(Math.max(...allValues) + 1)))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" ticks={xTicks} tick={{ fontSize: 10 }} />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 12 }} label={{ value: 'mmol/L', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
          <Tooltip content={<TodayTooltip />} />

          {/* Target range 4-7 */}
          <ReferenceArea y1={4} y2={7} fill="#22c55e" fillOpacity={0.08} />
          <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="5 5" />
          <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="5 5" />

          {/* Baseline fasting level */}
          <ReferenceLine y={baseline} stroke="#94a3b8" strokeDasharray="2 4" strokeWidth={1} />

          {/* Meal time vertical markers */}
          {points.filter((p) => p.hasMeal).map((p) => (
            <ReferenceLine key={`meal-${p.time}`} x={p.time} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
          ))}

          {/* Historical average daily pattern (grey dotted) */}
          {hasHistorical && (
            <Line
              type="monotone"
              dataKey="historical"
              stroke="#9ca3af"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              name="Avg pattern"
              isAnimationActive={false}
            />
          )}

          {/* Predicted glucose from meal impacts (orange dashed) */}
          {hasMeals && (
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#f97316"
              strokeDasharray="5 3"
              strokeWidth={2}
              dot={<MealDot />}
              connectNulls
              name="Predicted"
              isAnimationActive={false}
            />
          )}

          {/* Actual glucose readings (blue solid) */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#3b82f6' }}
            activeDot={{ r: 6 }}
            connectNulls
            name="Actual"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {hasReadings && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Actual ({readingCount})
          </span>
        )}
        {hasMeals && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-orange-500 inline-block rounded" style={{ borderTop: '2px dashed #f97316', background: 'none' }} /> Predicted ({mealCount} meals)
          </span>
        )}
        {hasHistorical && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-gray-400 inline-block rounded" style={{ borderTop: '2px dotted #9ca3af', background: 'none' }} /> Your avg pattern
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Meal logged
        </span>
      </div>
    </div>
  )
}
