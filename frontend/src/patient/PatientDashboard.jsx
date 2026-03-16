import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageCircle, TrendingUp, Pill, Utensils, AlertTriangle, CalendarClock, SendHorizontal, X, Sun, Moon } from 'lucide-react'
import { getPatientDashboard, respondToHistoryRequest } from '../shared/api'
import { useTheme } from '../shared/ThemeContext'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'
import GoalsSection from './GoalsSection'
import FloatingActionButton from './FloatingActionButton'
import ManualLogModal from './ManualLogModal'

export default function PatientDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState(null) // 'meal' | 'glucose' | 'medication' | null
  const [activeHistoryRequest, setActiveHistoryRequest] = useState(null)
  const [historyResponse, setHistoryResponse] = useState('')
  const [submittingHistory, setSubmittingHistory] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: d } = await getPatientDashboard(id)
    setData(d)
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
  const todayMeals = data.meals?.filter(m => m.meal_time?.startsWith(summaryDate)).length || 0
  const todaysMedLogs = data.med_logs?.filter(m => (m.scheduled_time || m.actual_time)?.startsWith(summaryDate)) || []
  const todayMedsTaken = todaysMedLogs.filter(m => m.action === 'taken').length
  const todayMedsMissed = todaysMedLogs.filter(m => m.action === 'skipped').length
  const latestRec = data.recommendations?.find(r => r.status === 'sent')
  const pendingHistoryRequests = data.history_requests?.filter(h => h.status === 'pending') || []
  const pendingReferrals = data.referrals?.filter(r => r.status === 'pending' || r.status === 'scheduled') || []
  const summaryDateLabel = new Date(`${summaryDate}T00:00:00`).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
  })

  async function handleHistorySubmit(event) {
    event.preventDefault()
    if (!activeHistoryRequest || !historyResponse.trim()) return

    setSubmittingHistory(true)
    const { error } = await respondToHistoryRequest(id, {
      request_id: activeHistoryRequest.id,
      response_text: historyResponse.trim(),
    })
    setSubmittingHistory(false)

    if (error) {
      alert(error)
      return
    }

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
            <p className="text-primary-100 text-sm mt-1">Your health dashboard</p>
          </div>
          <button onClick={toggle} className="text-primary-200 hover:text-white transition p-1">
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Today's Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Today's Summary</h2>
          <p className="mb-3 text-xs text-gray-400">Showing latest logged day: {summaryDateLabel}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className={`text-2xl font-bold ${latestGlucose?.value_mmol > 10 ? 'text-red-600' : latestGlucose?.value_mmol > 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                {latestGlucose?.value_mmol || '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Latest Glucose<br />(mmol/L)</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${todayMedsMissed > 0 ? 'text-red-600' : todayMedsTaken > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                {todayMedsTaken}/{todayMedsMissed}
              </div>
              <div className="text-xs text-gray-500 mt-1">Taken / Missed<br />Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{todayMeals}</div>
              <div className="text-xs text-gray-500 mt-1">Meals<br />Logged</div>
            </div>
          </div>
        </div>

        {/* Doctor's Notes */}
        {latestRec && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-blue-800 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Doctor's Notes
            </h2>
            <p className="text-sm text-blue-900 mt-2 leading-relaxed">{latestRec.content}</p>
            <p className="text-xs text-blue-500 mt-2">
              {doctor?.name || patient.doctor_id || 'Care team'} · {new Date(latestRec.created_at).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Glucose Chart */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Glucose Trend (7 days)
          </h2>
          <GlucoseChart readings={data.glucose_readings} height={200} />
        </div>

        {/* Med Adherence */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <Pill className="w-4 h-4" /> Medication Adherence (7 days)
          </h2>
          <MedAdherenceGrid medLogs={data.med_logs} medications={data.medications} />
        </div>

        {/* Goals */}
        {data.lifestyle_goals?.length > 0 && (
          <GoalsSection goals={data.lifestyle_goals} />
        )}

        {/* Upcoming Actions */}
        {(pendingReferrals.length > 0 || pendingHistoryRequests.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase text-gray-500">
              <CalendarClock className="h-4 w-4" /> Upcoming Actions
            </h2>
            {pendingReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.referral_type}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                </div>
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                  {r.appointment_date ? new Date(r.appointment_date).toLocaleDateString() : r.status}
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
        )}

        {/* Chat Button */}
        <button
          onClick={() => navigate(`/patient/${id}/chat`)}
          className="w-full bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 shadow-lg active:bg-primary-700 transition"
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

      {activeHistoryRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
