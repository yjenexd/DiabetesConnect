# DiabetesConnect

DiabetesConnect is an AI-assisted diabetes care platform built for a Singapore healthcare workflow. It gives patients a multilingual companion for chat, meal/photo/voice logging, glucose and medication tracking, and doctor-set goals, while giving clinicians a dashboard for risk triage, AI analysis, actions, referrals, and patient-safe recommendation previews backed by a real FastAPI + SQLite backend.

## Local Installation
1. Install prerequisites: `Python 3.11+`, `Node.js 18+`, and `npm`.
2. Clone the repo and enter it:
   ```bash
   git clone <repo-url>
   cd DiabetesConnect
   ```
3. Set up the backend:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
4. Edit `backend/.env`:
   - Add `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` for full chat, vision, and voice support.
   - Keep `SEALION_MOCK=true` if you want local fallback behaviour without the live SEA-LION API.
   - Leave `APP_ENV=development` and `SEED_ON_STARTUP=true` if you want demo data seeded automatically.
5. Start the backend:
   ```bash
   cd backend
   source venv/bin/activate
   python -m uvicorn main:app --reload --port 8000
   ```
6. In a second terminal, set up and start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
7. Open the app locally:
   - Frontend: `http://localhost:5173`
   - Backend API docs: `http://localhost:8000/docs`
   - Seeded patient dashboard example: `http://localhost:5173/patient/ah_kow_001`
   - Seeded doctor dashboard example: `http://localhost:5173/doctor/dr_tan_001`

## Agent Architect — `/backend/agents`
- Patient chat orchestration pipeline with voice transcription, multilingual understanding, Claude tool-calling, anomaly detection, localisation, chat history persistence, and pending-task enrichment from referrals/history requests/goals: `backend/agents/graph_patient.py`
- Doctor analysis pipeline that aggregates patient records and produces structured AI analysis plus recommendation preview payloads: `backend/agents/graph_doctor.py`
- Tool layer for logging meals, medications, glucose, active goals, and referrals, including staged meal confirmation before DB writes and confirmation-ready payloads for the frontend: `backend/agents/tools.py`
- Prompt library for Agent 1, Agent 2, Agent 3, plus Anthropic tool definitions and language-specific response behaviour: `backend/agents/prompts.py`
- Shared state definitions for patient-chat and doctor-analysis flows: `backend/agents/state.py`

## AI Integrations — `/backend/services`
- Claude service for tool-enabled chat, clinical analysis generation, anomaly checks, patient-friendly recommendation drafting, and meal-photo nutrition analysis: `backend/services/claude_service.py`
- SEA-LION service for language detection, intent extraction, translation/localisation, plus a mock heuristic fallback so the app still runs without the live API: `backend/services/sealion_service.py`
- Whisper/OpenAI speech-to-text support for recorded patient voice messages: `backend/services/whisper_service.py`
- Backward-compatible vision wrapper that re-exports Claude photo analysis for older integration points: `backend/services/vision_service.py`

## Backend + Data — `/backend/api`, `/backend/database`, `backend/main.py`
- FastAPI app entrypoint + middleware (CORS, request-scoped DB connection, seed gating): `backend/main.py`, `backend/api/middleware.py`
- REST + WS endpoints matching `docs/API_CONTRACT.md`: `backend/api/routes/chat.py`, `backend/api/routes/patient.py`, `backend/api/routes/doctor.py`
- SQLite schema + demo seed story (Ah Kow, March 2–15, 2026), plus high-impact indexes: `backend/database/schema.sql`, `backend/database/seed_data.py`
- DB gateway helpers (single module; request-friendly connection reuse): `backend/database/db.py`

## Patient Frontend — `/frontend/src/patient` + `/frontend/src/shared`
- Patient dashboard wired to the real backend for glucose trends, medication adherence, doctor notes, goals, referrals, history-request responses, and medication schedule data: `frontend/src/patient/PatientDashboard.jsx`
- Chat experience with history loading, retry states, voice recording, photo upload, and assistant-generated meal confirmation cards before logging detected food items: `frontend/src/patient/ChatInterface.jsx`
- Manual entry flows for meals, glucose, and medication plus reusable patient-side UI pieces: `frontend/src/patient/ManualLogModal.jsx`, `frontend/src/patient/FloatingActionButton.jsx`, `frontend/src/patient/GoalsSection.jsx`, `frontend/src/patient/MealDetailModal.jsx`
- Shared API client and visual components used across the app, including charts, medication grids, theme toggling, patient list helpers, and route-level integration with the backend: `frontend/src/shared/api.js`, `frontend/src/shared/GlucoseChart.jsx`, `frontend/src/shared/MedAdherenceGrid.jsx`, `frontend/src/shared/ThemeContext.jsx`

## Doctor Frontend — `/frontend/src/doctor`
- Doctor workspace with patient list, urgency/severity filtering, selection state, and detail-pane layout: `frontend/src/doctor/DoctorDashboard.jsx`, `frontend/src/doctor/PatientList.jsx`
- Patient detail screen showing metrics, alerts, medication adherence, glucose trends, AI analysis, and doctor actions connected to the backend: `frontend/src/doctor/PatientDetail.jsx`, `frontend/src/doctor/AIAnalysisPanel.jsx`, `frontend/src/doctor/ActionForms.jsx`
- Recommendation flow that drafts, previews, and sends patient-facing notes, with a doctor-only preview path that distinguishes visible notes from hidden draft/preview recommendations: `frontend/src/doctor/RecommendationComposer.jsx`, `frontend/src/doctor/DashboardPreview.jsx`
- "View as Patient" modal for checking the actual patient-visible dashboard state before or after clinician actions: `frontend/src/doctor/PatientViewModal.jsx`
