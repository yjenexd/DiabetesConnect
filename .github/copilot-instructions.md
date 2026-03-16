# DiabetesConnect Workspace Instructions

## Overview

DiabetesConnect is a two-part app:

- `backend/`: FastAPI + SQLite + AI service wrappers for patient chat, manual logging, and doctor analysis.
- `frontend/`: Vite + React SPA with separate patient and doctor flows.

Prefer minimal, targeted changes. This repo is a working demo/hackathon codebase, so there is limited shared typing and several frontend/backend contract mismatches already present.

## Run Commands

Use the current repo layout, not the older setup notes, as source of truth.

- Backend install: `cd backend && pip install -r requirements.txt`
- Backend dev server: `cd backend && uvicorn main:app --reload --port 8000`
- Backend direct run: `cd backend && python main.py`
- Frontend install: `cd frontend && npm install`
- Frontend dev server: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Frontend preview: `cd frontend && npm run preview`

Run the backend from `backend/`. The SQLite path is relative and startup initializes and seeds the database.

## Architecture

### Backend

- `backend/main.py` wires FastAPI, CORS, routers, and startup DB init/seed.
- `backend/api/routes/` contains the HTTP API surface:
  - `chat.py`: patient chat and history
  - `patient.py`: dashboard and manual logging
  - `doctor.py`: doctor dashboard, detail view, AI report generation, and actions
- `backend/database/schema.sql` is the canonical data model.
- `backend/database/db.py` provides the shared async SQLite helpers: `fetch_one`, `fetch_all`, `execute`.
- `backend/database/seed_data.py` defines the demo dataset and canonical patient/doctor IDs.
- `backend/agents/graph_patient.py` orchestrates the patient AI flow.
- `backend/agents/graph_doctor.py` orchestrates doctor analysis and structured output.
- `backend/services/` wraps external AI providers and media-processing services.

### Frontend

- `frontend/src/App.jsx` defines route entry points.
- `frontend/src/shared/api.js` is the integration layer for all API requests.
- `frontend/src/patient/` contains patient dashboard, chat, manual log, photo, and voice flows.
- `frontend/src/doctor/` contains doctor dashboard, patient detail, analysis, recommendations, and action forms.
- `frontend/vite.config.js` proxies `/api` and `/ws` to `http://localhost:8000` during local development.

## Working Conventions

- Keep backend handlers and DB access async end-to-end.
- Follow the existing DB helper pattern instead of introducing an ORM or a new repository layer unless explicitly requested.
- Treat `backend/database/schema.sql` and the route models in `backend/api/routes/` as the backend contract source of truth.
- Check `backend/database/seed_data.py` before inventing IDs, names, or example payloads.
- Frontend API helpers return `{ data, error }` instead of throwing. Preserve that pattern unless you are intentionally refactoring callers too.
- IDs are generally short 8-character UUID slices, not full UUIDs.
- Existing code stores some structured values as JSON-encoded strings in SQLite `TEXT` columns. Preserve those shapes unless you are migrating the data model deliberately.

## High-Risk Areas

Verify request and response shapes before changing UI or route code. There is known contract drift in several places.

- Doctor patient list: frontend expects fields that do not exactly match `backend/api/routes/doctor.py`.
- Doctor patient detail and AI analysis: frontend naming differs from backend field names such as `language_preference`, `acknowledged_by_doctor`, and `recommendations`.
- Patient manual logging: the frontend modal currently uses payload names that do not match the backend Pydantic models in `backend/api/routes/patient.py`.
- Doctor action forms: some frontend payload keys do not match what `backend/api/routes/doctor.py` reads.

When fixing any of these areas, update both sides together:

- backend route model or response shape
- `frontend/src/shared/api.js` if the transport shape changes
- affected UI components in `frontend/src/patient/` or `frontend/src/doctor/`

## Environment Notes

- Backend startup always runs DB initialization and seed logic.
- Missing AI credentials may not fail until runtime. `claude_service.py` and `whisper_service.py` fall back to placeholder keys if env vars are absent.
- `sealion_service.py` may operate in mock mode depending on configuration.
- The frontend currently relies on the Vite proxy because `frontend/src/shared/api.js` uses an empty Axios `baseURL`.

## Best Files To Read First

Start from these files before making non-trivial changes:

- `backend/main.py`
- `backend/database/schema.sql`
- `backend/database/db.py`
- `backend/database/seed_data.py`
- `backend/api/routes/patient.py`
- `backend/api/routes/doctor.py`
- `backend/api/routes/chat.py`
- `backend/agents/graph_patient.py`
- `backend/agents/graph_doctor.py`
- `backend/agents/prompts.py`
- `frontend/src/shared/api.js`
- `frontend/src/patient/PatientDashboard.jsx`
- `frontend/src/patient/ChatInterface.jsx`
- `frontend/src/patient/ManualLogModal.jsx`
- `frontend/src/doctor/DoctorDashboard.jsx`
- `frontend/src/doctor/PatientDetail.jsx`
- `frontend/src/doctor/ActionForms.jsx`

## Testing And Validation

There is no confirmed project test suite or lint setup in the current repo.

For backend changes:

- run the FastAPI app locally
- exercise the affected endpoint manually
- verify seeded data assumptions still hold

For frontend changes:

- run `npm run build` for a basic compile check
- verify the affected route against the live backend or proxy setup

If you change API contracts, validate the end-to-end flow instead of only one side.