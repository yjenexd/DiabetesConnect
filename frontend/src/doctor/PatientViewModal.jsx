import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getPatientView } from '../shared/api'
import GlucoseChart from '../shared/GlucoseChart'
import MedAdherenceGrid from '../shared/MedAdherenceGrid'
import GoalsSection from '../patient/GoalsSection'

export default function PatientViewModal({ patientId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: d } = await getPatientView(patientId)
      if (d) setData(d)
      setLoading(false)
    })()
  }, [patientId])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header mimicking patient app */}
        <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">{data?.patient?.name || 'Patient View'}</h2>
            <p className="text-xs text-primary-200">Viewing as patient</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : data ? (
            <>
              {/* Today's Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm border text-center">
                  <p className="text-xs text-gray-500">Latest Glucose</p>
                  <p className="text-xl font-bold text-primary-600">
                    {data.glucose_readings?.[data.glucose_readings.length - 1]?.value_mmol || '—'}
                  </p>
                  <p className="text-xs text-gray-400">mmol/L</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border text-center">
                  <p className="text-xs text-gray-500">Med Adherence</p>
                  <p className="text-xl font-bold text-green-600">
                    {data.med_logs?.length
                      ? `${Math.round(data.med_logs.filter(l => l.action === 'taken').length / data.med_logs.length * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400">this week</p>
                </div>
              </div>

              {/* Doctor's Notes */}
              {data.recommendations?.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="font-bold text-blue-800 text-sm mb-2">Doctor&apos;s Notes</h3>
                  {data.recommendations.map((r, i) => (
                    <p key={i} className="text-sm text-blue-700 mb-1">{r.content}</p>
                  ))}
                </div>
              )}

              {/* Glucose Chart */}
              {data.glucose_readings?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold text-gray-800 text-sm mb-2">Glucose Trend</h3>
                  <GlucoseChart readings={data.glucose_readings} />
                </div>
              )}

              {/* Med Adherence */}
              {data.med_logs?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold text-gray-800 text-sm mb-2">Medication Adherence</h3>
                  <MedAdherenceGrid medLogs={data.med_logs} medications={data.medications} />
                </div>
              )}

              {/* Goals */}
              <GoalsSection goals={data.lifestyle_goals} />

              {/* Referrals */}
              {data.referrals?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold text-gray-800 text-sm mb-2">Upcoming Actions</h3>
                  <div className="space-y-2">
                    {data.referrals.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-primary-500 rounded-full" />
                        <span className="text-gray-700">{r.referral_type}: {r.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-red-400 py-8">Failed to load patient view</div>
          )}
        </div>
      </div>
    </div>
  )
}
