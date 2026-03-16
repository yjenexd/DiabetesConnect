# DiabetesConnect

DiabetesConnect is an IMDA challenge demo app for AI-assisted diabetes care in a Singapore context.

## Person 1 (Agent Architect) — `/backend/agents`


## Person 2 (AI Integrations) — `/backend/services`

## Person 3 (Backend + Data) — `/backend/api`, `/backend/database`, `backend/main.py`
- FastAPI app entrypoint + middleware (CORS, request-scoped DB connection, seed gating): `backend/main.py`, `backend/api/middleware.py`
- REST + WS endpoints matching `docs/API_CONTRACT.md`: `backend/api/routes/chat.py`, `backend/api/routes/patient.py`, `backend/api/routes/doctor.py`
- SQLite schema + demo seed story (Ah Kow, March 2–15, 2026), plus high-impact indexes: `backend/database/schema.sql`, `backend/database/seed_data.py`
- DB gateway helpers (single module; request-friendly connection reuse): `backend/database/db.py`

## Person 4 (Patient Frontend) — `/frontend/src/patient` + `/frontend/src/shared`

## Person 5 (Doctor Frontend) — `/frontend/src/doctor`