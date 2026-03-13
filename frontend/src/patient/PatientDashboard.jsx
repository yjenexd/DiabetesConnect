import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageCircle, TrendingUp, Pill, Utensils, AlertTriangle } from 'lucide-react'
import { getPatientDashboard } from '../shared/api'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'
import GoalsSection from './GoalsSection'
import FloatingActionButton from './FloatingActionButton'
import ManualLogModal from './ManualLogModal'

export default function PatientDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState(null) // 'meal' | 'glucose' | 'medication' | null

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: d } = await getPatientDashboard(id)
    setData(d)
    setLoading(false)
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
  const latestGlucose = data.glucose_readings?.[0]
  const todayMeals = data.meals?.filter(m => m.meal_time?.startsWith(new Date().toISOString().slice(0, 10))).length || 0
  const todayMedsTaken = data.med_logs?.filter(m => m.action === 'taken' && m.actual_time?.startsWith(new Date().toISOString().slice(0, 10))).length || 0
  const todayMedsTotal = data.med_logs?.filter(m => (m.scheduled_time || m.actual_time)?.startsWith(new Date().toISOString().slice(0, 10))).length || 0
  const latestRec = data.recommendations?.find(r => r.status === 'sent')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Hello, {patient.name} 👋</h1>
        <p className="text-primary-100 text-sm mt-1">Your health dashboard</p>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Today's Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Today's Summary</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className={`text-2xl font-bold ${latestGlucose?.value_mmol > 10 ? 'text-red-600' : latestGlucose?.value_mmol > 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                {latestGlucose?.value_mmol || '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Latest Glucose<br />(mmol/L)</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${todayMedsTaken === todayMedsTotal && todayMedsTotal > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                {todayMedsTaken}/{todayMedsTotal || '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Meds Taken<br />Today</div>
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
            <p className="text-xs text-blue-500 mt-2">{new Date(latestRec.created_at).toLocaleDateString()}</p>
          </div>
        )}

        {/* Glucose Chart */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Glucose Trend (14 days)
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
        {(data.referrals?.length > 0 || data.history_requests?.filter(h => h.status === 'pending').length > 0) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Upcoming Actions</h2>
            {data.referrals?.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.referral_type}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                  {r.appointment_date || r.status}
                </span>
              </div>
            ))}
            {data.history_requests?.filter(h => h.status === 'pending').map(h => (
              <div key={h.id} className="py-2 border-b last:border-0">
                <p className="text-sm font-medium">Doctor's Request</p>
                <p className="text-xs text-gray-500 mb-2">{h.request_text}</p>
                <button className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-medium"
                  onClick={() => { /* Could open a modal */ }}>
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
    </div>
  )
}
