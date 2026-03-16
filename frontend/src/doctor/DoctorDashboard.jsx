import { useState, useEffect, useCallback } from 'react'
import { Users } from 'lucide-react'
import { getDoctorPatients } from '../shared/api'
import PatientList from './PatientList'
import PatientDetail from './PatientDetail'

export default function DoctorDashboard() {
  const [patients, setPatients] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sortBy, setSortBy] = useState('urgency')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [loading, setLoading] = useState(true)

  const doctorId = 'dr_tan_001'

  const loadPatients = useCallback(async () => {
    setLoading(true)
    const { data } = await getDoctorPatients(doctorId, sortBy, filterSeverity !== 'all' ? filterSeverity : undefined)
    if (data?.patients) setPatients(data.patients)
    setLoading(false)
  }, [sortBy, filterSeverity])

  useEffect(() => { loadPatients() }, [loadPatients])

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-72 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              <h1 className="text-lg font-bold text-gray-800">My Patients</h1>
            </div>
            <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {patients.length}
            </span>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="urgency">Sort: Urgency</option>
            <option value="alphabetical">Sort: Alphabetical</option>
          </select>

          {/* Filter */}
          <div className="flex gap-1">
            {['all', 'critical', 'warning', 'info'].map(f => (
              <button
                key={f}
                onClick={() => setFilterSeverity(f)}
                className={`flex-1 text-xs py-1 rounded-md font-medium capitalize transition ${
                  filterSeverity === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <PatientList
              patients={patients}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* Right Main Area */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <PatientDetail patientId={selectedId} onRefresh={loadPatients} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">Select a patient to view details</p>
              <p className="text-sm">Choose from the patient list on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
