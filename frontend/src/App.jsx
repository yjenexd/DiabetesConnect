import { Routes, Route, Navigate } from 'react-router-dom'
import PatientDashboard from './patient/PatientDashboard'
import ChatInterface from './patient/ChatInterface'
import DoctorDashboard from './doctor/DoctorDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/patient/:id" element={<PatientDashboard />} />
      <Route path="/patient/:id/chat" element={<ChatInterface />} />
      <Route path="/doctor/:id" element={<DoctorDashboard />} />
      <Route path="/" element={<Navigate to="/patient/ah_kow_001" replace />} />
    </Routes>
  )
}
