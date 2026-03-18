import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPatients } from './shared/api'

export default function PatientSelector() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    const { data, error: apiError } = await listPatients()
    if (apiError) {
      setError(apiError)
    } else {
      setPatients(data?.patients || [])
    }
    setLoading(false)
  }

  const handleSelectPatient = (patientId) => {
    navigate(`/patient/${patientId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient profiles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">DiabetesConnect</h1>
          <p className="text-xl text-gray-600">Select a patient profile to continue</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => handleSelectPatient(patient.id)}
              className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 text-left hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{patient.name}</h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p className="flex justify-between">
                      <span className="font-semibold">Age:</span>
                      <span>{patient.age} years</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Gender:</span>
                      <span className="capitalize">{patient.gender}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Type:</span>
                      <span className="uppercase">{patient.diabetes_type}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Language:</span>
                      <span className="capitalize">{patient.language_preference}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Diagnosed:</span>
                      <span>{patient.diagnosis_year}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-indigo-600 font-semibold inline-flex items-center">
                Access Profile
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {patients.length === 0 && !error && (
          <div className="text-center text-gray-600">
            <p>No patient profiles available</p>
          </div>
        )}
      </div>
    </div>
  )
}
