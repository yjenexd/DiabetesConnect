import { useState, useEffect } from 'react'
import { Pill, Heart, ClipboardList, ExternalLink, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getPatientDetail, acknowledgeAlert } from '../shared/api'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'
import AIAnalysisPanel from './AIAnalysisPanel'
import ActionForms from './ActionForms'
import RecommendationComposer from './RecommendationComposer'
import PatientViewModal from './PatientViewModal'

export default function PatientDetail({ patientId, onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState(null)
  const [showPatientView, setShowPatientView] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)

  useEffect(() => { loadDetail() }, [patientId])

  async function loadDetail() {
    setLoading(true)
    setAnalysisData(null)
    const result = await getPatientDetail(patientId)
    if (result.data) setData(result.data)
    setLoading(false)
  }

  async function handleAcknowledge(alertId) {
    await acknowledgeAlert(alertId)
    loadDetail()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading patient data...</div>
  if (!data) return <div className="p-8 text-center text-red-400">Failed to load patient data</div>

  const { patient, medications, glucose_readings, med_logs, alerts, recommendations, lifestyle_goals, referrals } = data

  const avgGlucose = glucose_readings?.length
    ? (glucose_readings.reduce((s, r) => s + r.value_mmol, 0) / glucose_readings.length).toFixed(1)
    : null

  const adherencePct = med_logs?.length
    ? Math.round(med_logs.filter(l => l.action === 'taken').length / med_logs.length * 100)
    : null

  function metricColor(type, val) {
    if (type === 'glucose') return val > 10 ? 'text-red-600 bg-red-50' : val > 8 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50'
    if (type === 'adherence') return val < 70 ? 'text-red-600 bg-red-50' : val < 85 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50'
    return 'text-blue-600 bg-blue-50'
  }

  function riskBadge(level) {
    if (level === 'high' || level === 'critical') return 'bg-red-100 text-red-700'
    if (level === 'medium') return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl animate-fade-up">
      {/* 1. Patient Header */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{patient.name}</h2>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${riskBadge(patient.risk_level || 'low')}`}>
                {(patient.risk_level || 'low').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {patient.age} y/o · {patient.gender} · {patient.diabetes_type || 'Type 2'}
              {patient.preferred_language && ` · ${patient.preferred_language}`}
            </p>
          </div>
          <button
            onClick={() => setShowPatientView(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <Eye className="w-4 h-4" /> View as Patient
          </button>
        </div>
        {medications?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {medications.map((m, i) => (
              <span key={i} className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-lg">
                {m.name} {m.dosage} · {m.frequency}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Key Metrics */}
      <div className="grid grid-cols-3 gap-4 stagger-children">
        <div className={`rounded-xl p-4 animate-fade-up ${metricColor('glucose', avgGlucose)}`}>
          <p className="text-xs font-medium opacity-70">Avg Glucose (7d)</p>
          <p className="text-2xl font-bold">{avgGlucose ?? '—'} <span className="text-sm font-normal">mmol/L</span></p>
        </div>
        <div className={`rounded-xl p-4 ${metricColor('adherence', adherencePct)}`}>
          <p className="text-xs font-medium opacity-70">Med Adherence</p>
          <p className="text-2xl font-bold">{adherencePct != null ? `${Math.round(adherencePct)}%` : '—'}</p>
        </div>
        <div className="rounded-xl p-4 text-blue-600 bg-blue-50">
          <p className="text-xs font-medium opacity-70">Active Alerts</p>
          <p className="text-2xl font-bold">{alerts?.filter(a => !a.acknowledged_by_doctor).length ?? 0}</p>
        </div>
      </div>

      {/* 3. Glucose Chart */}
      {glucose_readings?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-bold text-gray-800 mb-3">Glucose Trend (14 days)</h3>
          <GlucoseChart readings={glucose_readings} />
        </div>
      )}

      {/* 4. Medication Adherence Grid */}
      {med_logs?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-bold text-gray-800 mb-3">Medication Adherence</h3>
          <MedAdherenceGrid medLogs={med_logs} medications={medications} />
        </div>
      )}

      {/* 5. AI Analysis Panel */}
      <AIAnalysisPanel
        patientId={patientId}
        analysisData={analysisData}
        onAnalysisGenerated={setAnalysisData}
      />

      {/* 6. Doctor Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="font-bold text-gray-800 mb-3">Doctor Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { type: 'prescribe_medication', label: 'Prescribe Medication', icon: Pill, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            { type: 'lifestyle_change', label: 'Lifestyle Change', icon: Heart, color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
            { type: 'request_history', label: 'Request History', icon: ClipboardList, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { type: 'referral', label: 'Referral', icon: ExternalLink, color: 'bg-green-50 text-green-700 hover:bg-green-100' },
          ].map(a => (
            <button
              key={a.type}
              onClick={() => setActionType(a.type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl transition font-medium text-sm ${a.color}`}
            >
              <a.icon className="w-6 h-6" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* 7. Alerts */}
      {alerts?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-bold text-gray-800 mb-3">Recent Alerts</h3>
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.acknowledged_by_doctor ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {a.acknowledged_by_doctor
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <AlertTriangle className="w-4 h-4 text-red-500" />
                  }
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.message || a.title}</p>
                    <p className="text-xs text-gray-500">{a.severity} · {new Date(a.created_at).toLocaleDateString('en-SG')}</p>
                  </div>
                </div>
                {!a.acknowledged_by_doctor && (
                  <button
                    onClick={() => handleAcknowledge(a.id)}
                    className="text-xs bg-white border px-3 py-1 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Recommendation Composer */}
      <RecommendationComposer
        patientId={patientId}
        patientName={patient.name}
        draftText={analysisData?.recommendations?.[0]?.action || analysisData?.recommendations?.[0]?.text || ''}
      />

      {/* Modals */}
      {actionType && (
        <ActionForms
          actionType={actionType}
          patientId={patientId}
          onClose={() => setActionType(null)}
          onSuccess={() => { setActionType(null); loadDetail(); onRefresh?.() }}
        />
      )}
      {showPatientView && (
        <PatientViewModal patientId={patientId} onClose={() => setShowPatientView(false)} />
      )}
    </div>
  )
}
