import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageCircle, TrendingUp, Pill, Utensils, AlertTriangle, CalendarClock, SendHorizontal, X, Sun, Moon } from 'lucide-react'
import { getPatientDashboard, getMedSchedule, getGlucoseProfile, respondToHistoryRequest } from '../shared/api'
import { useTheme } from '../shared/ThemeContext'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'
import GoalsSection from './GoalsSection'
import FloatingActionButton from './FloatingActionButton'
import ManualLogModal from './ManualLogModal'
import MealDetailModal from './MealDetailModal'

function fmt24h(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getLocalIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function PatientDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [data, setData] = useState(null)
  const [medSchedule, setMedSchedule] = useState([])
  const [glucoseProfile, setGlucoseProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [glucoseChartMode, setGlucoseChartMode] = useState('today')
  const [medAdherenceMode, setMedAdherenceMode] = useState('today')
  const [modalMode, setModalMode] = useState(null)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [activeHistoryRequest, setActiveHistoryRequest] = useState(null)
  const [historyResponse, setHistoryResponse] = useState('')
  const [submittingHistory, setSubmittingHistory] = useState(false)
  const [showMealHistory, setShowMealHistory] = useState(false)

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    function handleStorageRefresh(event) {
      if (event.key !== 'dashboard-refresh' || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue)
        if (payload?.patientId === id) {
          loadData()
        }
      } catch {
        // Ignore malformed storage payloads
      }
    }

    function handleCustomRefresh(event) {
      if (event?.detail?.patientId === id) {
        loadData()
      }
    }

    window.addEventListener('storage', handleStorageRefresh)
    window.addEventListener('dashboard-refresh', handleCustomRefresh)
    return () => {
      window.removeEventListener('storage', handleStorageRefresh)
      window.removeEventListener('dashboard-refresh', handleCustomRefresh)
    }
  }, [id])

  async function loadData() {
    setLoading(true)
    const [dashRes, schedRes, profileRes] = await Promise.all([
      getPatientDashboard(id),
      getMedSchedule(id),
      getGlucoseProfile(id),
    ])
    setData(dashRes.data)
    setMedSchedule(schedRes.data?.schedule || [])
    setGlucoseProfile(profileRes.data || null)
    setLoading(false)
  }

  function getReferenceDate(items, keys) {
    const timestamps = (items || [])
      .map(item => keys.map(key => item?.[key]).find(Boolean))
      .filter(Boolean)
      .sort()
    return timestamps.at(-1)?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (!data?.patient) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-lg">Patient not found</p>
    </div>
  )

  const patient = data.patient
  const doctor = data.doctor
  const latestGlucose = data.glucose_readings?.[0]
  const summaryDate = getReferenceDate(
    [...(data.meals || []), ...(data.med_logs || []), ...(data.glucose_readings || [])],
    ['meal_time', 'actual_time', 'scheduled_time', 'measurement_time'],
  )

  const todayIso = getLocalIsoDate()
  const todayMeals = data.meals?.filter(m => m.meal_time?.startsWith(todayIso)).length || 0
  const todaySchedule = medSchedule.filter(slot => slot.date === todayIso)
  const todayMedsTaken = todaySchedule.filter(slot => slot.status === 'taken' || slot.status === 'delayed').length
  const todayMedsMissed = todaySchedule.filter(slot => slot.status === 'missed' || slot.status === 'skipped').length
  const latestRec = data.recommendations?.find(r => r.status === 'sent')
  const pendingHistoryRequests = data.history_requests?.filter(h => h.status === 'pending') || []
  const pendingReferrals = data.referrals?.filter(r => r.status === 'pending' || r.status === 'scheduled') || []

  async function handleHistorySubmit(event) {
    event.preventDefault()
    if (!activeHistoryRequest || !historyResponse.trim()) return
    setSubmittingHistory(true)
    const { error } = await respondToHistoryRequest(id, {
      request_id: activeHistoryRequest.id,
      response_text: historyResponse.trim(),
    })
    setSubmittingHistory(false)
    if (error) { alert(error); return }
    setHistoryResponse('')
    setActiveHistoryRequest(null)
    loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Hello, {patient.name} 👋</h1>
            <p className="text-primary-100 text-sm mt-1">your health at a glance</p>
          </div>
          <button onClick={toggle} className="text-primary-200 hover:text-white transition p-1">
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Row 1: 3 stat cards spanning full width */}
        <div className="grid grid-cols-3 gap-4 stagger-children">
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center justify-center animate-fade-up">
            <div className={`text-3xl font-bold ${latestGlucose?.value_mmol > 10 ? 'text-red-600' : latestGlucose?.value_mmol > 7 ? 'text-yellow-600' : 'text-green-600'}`}>
              {latestGlucose?.value_mmol || '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">Latest Glucose (mmol/L)</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{fmtDate(`${summaryDate}T00:00:00`)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center justify-center animate-fade-up">
            <div className={`text-3xl font-bold ${todayMedsMissed > 0 ? 'text-red-600' : todayMedsTaken > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
              {todayMedsTaken}<span className="text-gray-300">/</span>{todayMedsMissed}
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">Meds Taken / Missed</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Today</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center justify-center animate-fade-up">
            <div className="text-3xl font-bold text-primary-600">{todayMeals}</div>
            <div className="text-xs text-gray-500 mt-1 text-center">Meals Logged</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Today</div>
          </div>
        </div>

        {/* Row 2: Glucose chart + Medication grid side by side */}
        <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Glucose {glucoseChartMode === 'today' ? '(Today)' : '(7 days)'}
              </h2>
              <div className="inline-flex rounded-full bg-gray-100 p-1">
                <button
                  onClick={() => setGlucoseChartMode('today')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    glucoseChartMode === 'today' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setGlucoseChartMode('trend')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    glucoseChartMode === 'trend' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  7 Days
                </button>
              </div>
            </div>
            <GlucoseChart readings={data.glucose_readings} meals={data.meals} height={200} mode={glucoseChartMode} glucoseProfile={glucoseProfile} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Pill className="w-4 h-4" /> Medication Adherence {medAdherenceMode === 'today' ? '(Today)' : '(7 days)'}
              </h2>
              <div className="inline-flex rounded-full bg-gray-100 p-1">
                <button
                  onClick={() => setMedAdherenceMode('today')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    medAdherenceMode === 'today' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setMedAdherenceMode('trend')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    medAdherenceMode === 'trend' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  7 Days
                </button>
              </div>
            </div>
            <MedAdherenceGrid schedule={medSchedule} mode={medAdherenceMode} />
          </div>
        </div>

        {/* Row 3: Today's Nutrition (merged with meal history toggle) */}
        {(() => {
          const todayMealsList = data.meals?.filter(m => m.meal_time?.startsWith(summaryDate)) || []
          const totals = todayMealsList.reduce((acc, m) => ({
            calories: acc.calories + (m.calories_estimate || 0),
            carbs: acc.carbs + (m.carbs_grams || 0),
            protein: acc.protein + (m.protein_grams || 0),
            fat: acc.fat + (m.fat_grams || 0),
            sodium: acc.sodium + (m.sodium_mg || 0),
            sugar: acc.sugar + (m.sugar_grams || 0),
          }), { calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0 })

          const nutrients = [
            { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', warn: 1600, danger: 2000 },
            { label: 'Carbs', value: Math.round(totals.carbs * 10) / 10, unit: 'g', warn: 100, danger: 130 },
            { label: 'Protein', value: Math.round(totals.protein * 10) / 10, unit: 'g', warn: 60, danger: 80 },
            { label: 'Fat', value: Math.round(totals.fat * 10) / 10, unit: 'g', warn: 55, danger: 70 },
            { label: 'Sodium', value: Math.round(totals.sodium), unit: 'mg', warn: 1800, danger: 2300 },
            { label: 'Sugar', value: Math.round(totals.sugar * 10) / 10, unit: 'g', warn: 20, danger: 25 },
          ]

          function barColor(value, warn, danger) {
            if (value >= danger) return 'bg-red-500'
            if (value >= warn) return 'bg-yellow-400'
            return 'bg-green-500'
          }
          function textColor(value, warn, danger) {
            if (value >= danger) return 'text-red-600'
            if (value >= warn) return 'text-yellow-600'
            return 'text-gray-700'
          }

          return (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <Utensils className="w-4 h-4" /> Today's Nutrition
                  <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case">{fmtDate(`${summaryDate}T00:00:00`)}</span>
                </h2>
                {data.meals?.length > 0 && (
                  <button
                    onClick={() => setShowMealHistory(h => !h)}
                    className="text-xs text-primary-600 font-medium hover:text-primary-800 transition"
                  >
                    {showMealHistory ? 'Hide History' : 'View History'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {nutrients.map(({ label, value, unit, warn, danger }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-xs font-semibold ${textColor(value, warn, danger)}`}>
                        {value} {unit}
                        {value >= danger && <span className="ml-1 text-red-500">▲</span>}
                        {value >= warn && value < danger && <span className="ml-1 text-yellow-500">!</span>}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(value, warn, danger)}`}
                        style={{ width: `${Math.min((value / danger) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {showMealHistory && (
                <div className="border-t mt-4 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Meal History</p>
                  {data.meals?.length > 0 ? (
                    <>
                      <div className="divide-y">
                        {data.meals.slice(0, 10).map(meal => (
                          <button
                            key={meal.id}
                            onClick={() => setSelectedMeal(meal)}
                            className="w-full text-left py-2.5 flex items-center justify-between hover:bg-gray-50 rounded-lg px-1 transition"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">{meal.food_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{fmt24h(meal.meal_time)} · {fmtDate(meal.meal_time)}</p>
                            </div>
                            <div className="text-right text-xs text-gray-500 ml-2 shrink-0">
                              {meal.carbs_grams != null && <span className="block">{meal.carbs_grams}g carbs</span>}
                              {meal.calories_estimate > 0 && <span className="block">{meal.calories_estimate} kcal</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => navigate(`/patient/${id}/meals`)}
                        className="mt-3 w-full text-center text-xs text-primary-600 font-medium hover:text-primary-800 transition py-1"
                      >
                        View Full History →
                      </button>
                    </>
                  ) : (
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      No meals logged yet. Use + to add your first meal.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Row 4: Doctor's Notes / Goals / Upcoming Actions */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-blue-800 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Doctor's Notes
            </h2>
            {latestRec ? (
              <>
                <p className="text-sm text-blue-900 mt-2 leading-relaxed">{latestRec.content}</p>
                <p className="text-xs text-blue-500 mt-2">
                  {doctor?.name || 'Care team'} · {fmtDate(latestRec.created_at)}
                </p>
              </>
            ) : (
              <p className="text-sm text-blue-700 mt-2">No notes from your doctor yet.</p>
            )}
          </div>
          {data.lifestyle_goals?.length > 0 ? (
            <GoalsSection goals={data.lifestyle_goals} />
          ) : (
            <div className="bg-white rounded-2xl border p-4 shadow-sm">
              <h3 className="font-bold text-gray-800">My Goals</h3>
              <p className="mt-2 text-sm text-gray-500">No active goals yet. Your doctor can set one during your next review.</p>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase text-gray-500">
              <CalendarClock className="h-4 w-4" /> Upcoming Actions
            </h2>
            {pendingReferrals.length === 0 && pendingHistoryRequests.length === 0 && (
              <p className="text-sm text-gray-500">No upcoming actions right now.</p>
            )}
            {pendingReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.referral_type}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                </div>
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                  {r.appointment_date ? fmtDate(r.appointment_date) : r.status}
                </span>
              </div>
            ))}
            {pendingHistoryRequests.map(h => (
              <div key={h.id} className="py-2 border-b last:border-0">
                <p className="text-sm font-medium">Doctor's Request</p>
                <p className="text-xs text-gray-500 mb-2">{h.request_text}</p>
                <button className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-medium"
                  onClick={() => setActiveHistoryRequest(h)}>
                  Respond
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Button — full width */}
        <button
          onClick={() => navigate(`/patient/${id}/chat`)}
          className="w-full bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-primary-700 active:bg-primary-800 transition animate-fade-up"
          style={{ animationDelay: '250ms' }}
        >
          <MessageCircle className="w-6 h-6" /> Chat with Companion
        </button>
      </div>

      {/* FAB */}
      <FloatingActionButton onSelect={setModalMode} />

      {/* Manual Log Modal */}
      {modalMode && (
        <ManualLogModal
          mode={modalMode}
          patientId={id}
          medications={data.medications}
          onClose={() => setModalMode(null)}
          onSuccess={() => { setModalMode(null); loadData() }}
        />
      )}

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          patientId={id}
          onClose={() => setSelectedMeal(null)}
          onUpdated={() => { setSelectedMeal(null); loadData() }}
        />
      )}

      {/* History Response Modal */}
      {activeHistoryRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 backdrop-blur-sm sm:items-center animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Respond to Doctor</h3>
                <p className="mt-1 text-sm text-gray-500">Share the requested history in your own words.</p>
              </div>
              <button onClick={() => setActiveHistoryRequest(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">{activeHistoryRequest.request_text}</p>
            <form onSubmit={handleHistorySubmit} className="mt-4 space-y-4">
              <textarea
                value={historyResponse}
                onChange={(event) => setHistoryResponse(event.target.value)}
                className="h-32 w-full resize-none rounded-xl border px-4 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="Type your response here"
                required
              />
              <button
                type="submit"
                disabled={submittingHistory || !historyResponse.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                <SendHorizontal className="h-5 w-5" />
                {submittingHistory ? 'Sending...' : 'Send Response'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
