# Person 3 — Backend + Data

## Your Scope
You own `/backend/api/`, `/backend/database/`, and `backend/main.py`. You build the FastAPI app, database schema, seed data, and all REST endpoints. **You are the first person to push code — everyone depends on you.**

## Files You Own
- `backend/main.py` — FastAPI app entry point
- `backend/requirements.txt` — Python dependencies
- `backend/.env.example` — Environment variable template
- `backend/database/db.py` — Database connection helpers
- `backend/database/schema.sql` — SQLite schema
- `backend/database/seed_data.py` — Mock data population
- `backend/api/routes_chat.py` — Chat endpoints
- `backend/api/routes_patient.py` — Patient dashboard + manual logging endpoints
- `backend/api/routes_doctor.py` — Doctor dashboard + action endpoints
- `docs/API_CONTRACT.md` — API shapes (you write this FIRST)

---

## Day 1 Morning: CRITICAL PATH (Do This First)

### Step 1 — Create the Repo and Folder Structure

See SETUP_GUIDE.md Step 1. Do this before anything else.

### Step 2 — Write the API Contract

Create `docs/API_CONTRACT.md` and tell Claude Code:

```
Create an API contract document for a diabetes management app with these endpoints.
For each endpoint, show the HTTP method, URL, request body JSON, and response JSON.

PATIENT ENDPOINTS:
- POST /api/chat — {patient_id, message, input_type, audio_base64?, image_base64?} → {response, language, tools_called, alerts_generated}
- GET /api/patients/{id}/dashboard — no body → {patient, glucose_readings[], meals[], med_logs[], medications[], recommendations[], lifestyle_goals[], referrals[], history_requests[]}
- POST /api/patients/{id}/meals — {food_name, calories_estimate, carbs_grams, meal_type} → {success, meal_id}
- POST /api/patients/{id}/glucose — {value_mmol, context} → {success, reading_id}
- POST /api/patients/{id}/medications/log — {medication_name, action} → {success, log_id}
- POST /api/patients/{id}/history-response — {request_id, response_text} → {success}
- GET /api/patients/{id}/referrals → {referrals[]}

DOCTOR ENDPOINTS:
- GET /api/doctor/{id}/patients?sort_by=urgency&filter_severity=all → {patients[], total_count}
  Each patient includes: id, name, age, gender, risk_level, adherence_pct, latest_glucose, latest_alert_severity
- GET /api/doctor/patients/{id}/detail → everything from patient dashboard + alerts[], weekly_reports[], doctor_actions[]
- GET /api/doctor/patients/{id}/patient-view → exactly what patient sees (for preview)
- POST /api/doctor/patients/{id}/generate-report → {report_id, analysis, recommendations[], preview}
- POST /api/doctor/patients/{id}/actions — {action_type, action_data} → {success, action_id}
  action_type is one of: prescribe_medication, lifestyle_change, request_history, referral
  action_data varies by type (show examples for each)
- POST /api/doctor/patients/{id}/recommendation — {content, recommendation_type} → {recommendation_id, preview}
- PUT /api/doctor/patients/{id}/recommendation/{rec_id}/approve — {content?} → {success}
- PUT /api/alerts/{id}/acknowledge → {success}

Show realistic example data using Singaporean context (Ah Kow, char kway teow, Metformin, etc.)
```

**Push this to main immediately.** Everyone needs it.

### Step 3 — Database Schema

Tell Claude Code:

```
Create a SQLite schema file (schema.sql) for a diabetes patient management system.

Tables needed:
- patients (id, name, age, gender, diabetes_type, diagnosis_year, language_preference, created_at)
- medications (id, patient_id FK, name, dosage, frequency, prescribed_by, prescribed_at, active bool, notes)
- med_logs (id, patient_id FK, medication_id FK, action [taken/skipped/delayed], scheduled_time, actual_time, reason_if_skipped, logged_via)
- meals (id, patient_id FK, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, photo_url, logged_via, cultural_context)
- glucose_readings (id, patient_id FK, value_mmol real, measurement_time, context, logged_via)
- alerts (id, patient_id FK, alert_type, severity [info/warning/critical], title, description, related_data, acknowledged_by_doctor bool, created_at)
- recommendations (id, patient_id FK, doctor_id, recommendation_type, content, ai_generated_draft, status [draft/preview/sent/acknowledged], created_at, acknowledged_at)
- doctor_actions (id, patient_id FK, doctor_id, action_type, action_data JSON text, status, patient_notified bool, created_at)
- lifestyle_goals (id, patient_id FK, action_id FK, goal_type, target_value, target_unit, description, active bool, compliance_rate real, created_at)
- referrals (id, patient_id FK, action_id FK, referral_type, description, appointment_date, status, created_at)
- history_requests (id, patient_id FK, action_id FK, request_text, patient_response, status, created_at, responded_at)
- weekly_reports (id, patient_id FK, week_start, week_end, summary_text, key_metrics JSON, risk_level, recommendations JSON, generated_at)
- chat_messages (id, patient_id FK, role [patient/assistant], content, language, timestamp)

Use CREATE TABLE IF NOT EXISTS. Use TEXT for IDs. All timestamps as TIMESTAMP.
```

### Step 4 — Seed Data

Tell Claude Code:

```
Create a seed_data.py script that populates SQLite with 14 days of demo data.

4 patients: Ah Kow (62M, type2, mandarin), Siti Aminah (55F, type2, malay), Ravi Kumar (58M, type2, english), Tan Wei Lin (45F, type1, english)

For Ah Kow — 14 days starting March 2, 2026:

GLUCOSE (fasting, 7:30am daily):
Week 1: 8.2, 8.5, 9.0, 9.3, 9.8, 10.2, 10.5 (trending up)
Week 2: 10.8, 11.0, 11.2, 11.4, 10.9, 10.5, 10.2 (peaks then slightly improves)
Also add post-meal readings (afternoon) = fasting + ~3.0-3.5

MEDICATIONS: Metformin 500mg 2x daily, Glipizide 5mg 1x evening
AM Metformin: 100% taken both weeks
PM Glipizide: Week 1 = 57% (missed Mon, Wed, Sat), Week 2 = 71% (improving)

MEALS: Heavy on hawker food
Include: char kway teow (700cal, 90g carbs), nasi lemak (650cal, 85g carbs), chicken rice (600cal, 75g), kopi with condensed milk (150cal, 25g), toast with kaya (200cal, 35g), hokkien mee (550cal, 70g), fish soup bee hoon (350cal, 45g), brown rice bee hoon (380cal, 48g)
Week 2 should show slight dietary improvement (some kopi-O, brown rice bee hoon)

ALERTS (5 total):
Day 3: diet_flag warning — 3rd high-carb meal
Day 5: med_missed warning — 2nd missed Glipizide
Day 7: glucose_high warning — trending up over 7 days
Day 9: glucose_high critical — above 11 mmol/L
Day 11: goal_noncompliance info — carb goal exceeded but improving

DOCTOR ACTIONS (from Day 10 — March 12):
- Lifestyle goal: carb limit 200g/day, compliance_rate 0.4
- Referral: eye screening, April 1, pending
- History request: family history of diabetes and heart disease, pending
- Recommendation: warm message about evening meds and brown rice bee hoon

Use uuid.uuid4()[:8] for IDs. Run schema.sql first.
```

### Step 5 — Database Helpers

```
Create database/db.py with async SQLite helpers using aiosqlite:

- init_db() — reads schema.sql and executes it
- get_db() — returns async connection with row_factory=aiosqlite.Row
- fetch_one(query, params) → dict or None
- fetch_all(query, params) → list of dicts
- execute(query, params) → lastrowid

DB path from DATABASE_URL env var, strip "sqlite:///" prefix.
```

### Step 6 — FastAPI Main + Routes

Tell Claude Code to create main.py and all route files based on the API contract. The routes should call database helpers directly for simple CRUD, and call the LangGraph graphs for AI-powered endpoints.

---

## Day 2: Wire AI Endpoints

- Connect POST /api/chat to Person 1's patient_chat_graph
- Connect POST /generate-report to Person 1's doctor_analysis_graph
- Test all endpoints using FastAPI's auto-generated docs at /docs
- Make sure all the doctor action endpoints correctly create records in the right tables

## Day 3: Polish
- Verify seed data tells a compelling story
- Test all endpoints one final time
- Make sure CORS is working for the frontend
