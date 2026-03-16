import axios from 'axios'

const api = axios.create({ baseURL: '' })

function getErrorMessage(error, fallbackMessage = 'Request failed') {
  return error?.response?.data?.detail || error?.response?.data?.error || error?.message || fallbackMessage
}

export function connectChatWebSocket(patientId) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${protocol}://${window.location.host}/api/ws/chat/${patientId}`)
}

// ── Patient APIs ──

export async function getPatientDashboard(patientId) {
  try {
    const { data } = await api.get(`/api/patients/${patientId}/dashboard`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not load dashboard') }
  }
}

export async function sendChatMessage(patientId, message, inputType = 'text', audioBase64 = null, imageBase64 = null) {
  try {
    const { data } = await api.post('/api/chat', {
      patient_id: patientId,
      message,
      input_type: inputType,
      audio_base64: audioBase64,
      image_base64: imageBase64,
    })
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not send message') }
  }
}

export async function getChatHistory(patientId) {
  try {
    const { data } = await api.get(`/api/chat/history/${patientId}`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not load chat history') }
  }
}

export async function logMealManual(patientId, meal) {
  try {
    const { data } = await api.post(`/api/patients/${patientId}/meals`, meal)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not log meal') }
  }
}

export async function logGlucoseManual(patientId, reading) {
  try {
    const { data } = await api.post(`/api/patients/${patientId}/glucose`, reading)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not log glucose') }
  }
}

export async function logMedicationManual(patientId, log) {
  try {
    const { data } = await api.post(`/api/patients/${patientId}/medications/log`, log)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not log medication') }
  }
}

export async function respondToHistoryRequest(patientId, body) {
  try {
    const { data } = await api.post(`/api/patients/${patientId}/history-response`, body)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not submit response') }
  }
}

// ── Doctor APIs ──

export async function getDoctorPatients(doctorId, sortBy = 'urgency', filterSeverity = 'all') {
  try {
    const { data } = await api.get(`/api/doctor/${doctorId}/patients`, { params: { sort_by: sortBy, filter_severity: filterSeverity } })
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not load patient list') }
  }
}

export async function getPatientDetail(patientId) {
  try {
    const { data } = await api.get(`/api/doctor/patients/${patientId}/detail`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not load patient detail') }
  }
}

export async function getPatientView(patientId) {
  try {
    const { data } = await api.get(`/api/doctor/patients/${patientId}/patient-view`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not load patient view') }
  }
}

export async function generateReport(patientId) {
  try {
    const { data } = await api.post(`/api/doctor/patients/${patientId}/generate-report`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not generate report') }
  }
}

export async function createDoctorAction(patientId, action) {
  try {
    const { data } = await api.post(`/api/doctor/patients/${patientId}/actions`, action)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not create action') }
  }
}

export async function draftRecommendation(patientId, rec) {
  try {
    const { data } = await api.post(`/api/doctor/patients/${patientId}/recommendation`, rec)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not draft recommendation') }
  }
}

export async function approveRecommendation(patientId, recId, content = null) {
  try {
    const body = content ? { content } : {}
    const { data } = await api.put(`/api/doctor/patients/${patientId}/recommendation/${recId}/approve`, body)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not approve recommendation') }
  }
}

export async function acknowledgeAlert(alertId) {
  try {
    const { data } = await api.put(`/api/alerts/${alertId}/acknowledge`)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: getErrorMessage(e, 'Could not acknowledge alert') }
  }
}
