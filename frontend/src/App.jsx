import { Routes, Route } from 'react-router-dom'
import PatientSelector from './PatientSelector'
import PatientDashboard from './patient/PatientDashboard'
import ChatInterface from './patient/ChatInterface'
import MealHistoryPage from './patient/MealHistoryPage'
import DoctorDashboard from './doctor/DoctorDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PatientSelector />} />
      <Route path="/patient/:id" element={<PatientDashboard />} />
      <Route path="/patient/:id/chat" element={<ChatInterface />} />
      <Route path="/patient/:id/meals" element={<MealHistoryPage />} />
      <Route path="/doctor/:id" element={<DoctorDashboard />} />
    </Routes>
  )
}
