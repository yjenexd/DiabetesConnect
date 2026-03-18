import { useState, useEffect } from 'react'
import { X, Eye } from 'lucide-react'
import { getDoctorPatientPreview } from '../shared/api'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'

export default function DashboardPreview({ patientId, pendingRecommendation, pendingActions = [], onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: d } = await getDoctorPatientPreview(patientId)
      if (d) setData(d)
      setLoading(false)
    })()
  }, [patientId])

  const visibleRecs = data?.recommendations?.filter(r => r.status === 'sent' || r.status === 'acknowledged') || []
  const hiddenRecs = data?.recommendations?.filter(r => r.status !== 'sent' && r.status !== 'acknowledged') || []

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Banner */}
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-700">Preview — This is what the patient will see</span>
          </div>
          <button onClick={onClose} className="text-amber-700 hover:text-amber-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading preview...</div>
        ) : data ? (
          <div className="p-4 space-y-4">
            {/* Patient header */}
            <div className="bg-primary-600 text-white rounded-xl p-4">
              <h2 className="text-lg font-bold">{data.patient?.name || 'Patient'}</h2>
              <p className="text-sm text-primary-200">Your Health Dashboard</p>
            </div>

            {/* Pending recommendation highlighted */}
            {pendingRecommendation && (
              <div className="bg-blue-50 border-2 border-blue-300 border-dashed rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 mb-1">NEW — Doctor&apos;s Note</p>
                <p className="text-sm text-gray-800">{pendingRecommendation}</p>
              </div>
            )}

            {/* Existing recommendations */}
            {visibleRecs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">Doctor&apos;s Notes (Patient sees)</h3>
                {visibleRecs.map((r, i) => (
                  <p key={i} className="text-sm text-gray-600 mb-1">{r.content}</p>
                ))}
              </div>
            )}

            {/* Hidden recommendations (draft/preview) */}
            {hiddenRecs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
                <h3 className="font-bold text-amber-800 mb-2 text-sm">Notes (Hidden from patient)</h3>
                {hiddenRecs.map((r, i) => (
                  <p key={i} className="text-sm text-gray-700 mb-1">
                    <span className="font-medium text-amber-700">{(r.status || 'draft').toUpperCase()}:</span> {r.content}
                  </p>
                ))}
              </div>
            )}

            {/* Glucose chart */}
            {data.glucose_readings?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">Glucose Trend</h3>
                <GlucoseChart readings={data.glucose_readings} />
              </div>
            )}

            {/* Med adherence */}
            {data.med_logs?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">Medication Adherence</h3>
                <MedAdherenceGrid medLogs={data.med_logs} medications={data.medications} />
              </div>
            )}

            {/* Goals */}
            {data.lifestyle_goals?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">My Goals</h3>
                {data.lifestyle_goals.map((g, i) => (
                  <p key={i} className="text-sm text-gray-600">{g.description || g.goal_type}</p>
                ))}
              </div>
            )}

            {/* Referrals */}
            {data.referrals?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">Upcoming Actions</h3>
                {data.referrals.map((r, i) => (
                  <p key={i} className="text-sm text-gray-600">{r.referral_type}: {r.description}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-red-400">Failed to load preview</div>
        )}
      </div>
    </div>
  )
}
