# DiabetesConnect — Master Setup Guide

## Read This First (Everyone)

This document tells each team member exactly what to do on Day 1 morning to get started. **Do not start coding until Steps 1-3 are done by Person 3.**

---

## Step 1: Person 3 Creates the Repo (15 min)

Person 3 does this ONCE, everyone else waits:

1. Create a new GitHub repo called `diabetesconnect`
2. Clone it locally
3. Create this folder structure:

```
diabetesconnect/
├── README.md
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── state.py
│   │   ├── graph_patient.py
│   │   ├── graph_doctor.py
│   │   ├── tools.py
│   │   └── prompts.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── claude_service.py
│   │   ├── sealion_service.py
│   │   └── whisper_service.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes_chat.py
│   │   ├── routes_patient.py
│   │   └── routes_doctor.py
│   └── database/
│       ├── __init__.py
│       ├── db.py
│       ├── schema.sql
│       └── seed_data.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── shared/
│   │   │   ├── api.js
│   │   │   ├── GlucoseChart.jsx
│   │   │   └── MedAdherenceGrid.jsx
│   │   ├── patient/
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── VoiceRecorder.jsx
│   │   │   ├── PhotoUpload.jsx
│   │   │   ├── FloatingActionButton.jsx
│   │   │   ├── ManualLogModal.jsx
│   │   │   └── GoalsSection.jsx
│   │   └── doctor/
│   │       ├── DoctorDashboard.jsx
│   │       ├── PatientList.jsx
│   │       ├── PatientDetail.jsx
│   │       ├── AIAnalysisPanel.jsx
│   │       ├── ActionForms.jsx
│   │       ├── RecommendationComposer.jsx
│   │       ├── DashboardPreview.jsx
│   │       └── PatientViewModal.jsx
│   └── public/
├── docs/
│   ├── TECH_SPEC.md (or .pdf)
│   ├── API_CONTRACT.md
│   ├── SETUP_GUIDE.md (this file)
│   └── CLAUDE_CODE_INSTRUCTIONS/
│       ├── PERSON1_AGENTS.md
│       ├── PERSON2_AI_SERVICES.md
│       ├── PERSON3_BACKEND.md
│       ├── PERSON4_PATIENT_UI.md
│       └── PERSON5_DOCTOR_UI.md
└── presentation/
```

4. Create empty `__init__.py` files in each Python package folder
5. Push to `main` branch
6. Post in team chat: "Repo is ready, everyone clone now"

## Step 2: Everyone Clones and Sets Up (10 min)

```bash
git clone <repo-url>
cd diabetesconnect
```

**Backend people (Persons 1, 2, 3):**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Fill in API keys
```

**Frontend people (Persons 4, 5):**
```bash
cd frontend
npm install
```

## Step 3: Person 3 Writes the API Contract (30 min)

Person 3 creates `docs/API_CONTRACT.md` with all endpoint shapes (request/response JSON). This is the single source of truth that frontend and backend code against. See the `PERSON3_BACKEND.md` file for the exact contract to write.

**Push this to `main` immediately.** Frontend people need this before they can start.

## Step 4: Everyone Creates Their Branch and Starts

```bash
git checkout -b feat/<your-branch-name>
```

Branch names:
- Person 1: `feat/agents`
- Person 2: `feat/ai-services`
- Person 3: `feat/backend-api`
- Person 4: `feat/patient-ui`
- Person 5: `feat/doctor-ui`

**Now open your person-specific instruction file** in `docs/CLAUDE_CODE_INSTRUCTIONS/` and follow it.

---

## Environment Variables (.env)

Everyone on the backend needs these keys in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx        # Get from console.anthropic.com
SEALION_API_URL=https://api.sea-lion.ai/v1
SEALION_API_KEY=xxxxx                 # Get from AI Singapore
OPENAI_API_KEY=sk-xxxxx               # Get from platform.openai.com (for Whisper)
DATABASE_URL=sqlite:///./diabetesconnect.db
DEBUG=true
CORS_ORIGINS=http://localhost:5173
```

**Assign one person to create all API accounts before the hackathon starts.**

---

## Merge Schedule

| When | What |
|------|------|
| Day 1, 2pm | First merge — backend chat endpoint + frontend chat UI should connect |
| Day 1, 6pm | Second merge — all basic endpoints working |
| Day 2, 12pm | Third merge — all 3 agents + both dashboards with real data |
| Day 2, 6pm | Fourth merge — all features integrated |
| Day 2, 9pm | **FEATURE FREEZE on `main`** |
| Day 3 | Bug fixes only, directly on `main` |

## How to Merge

```bash
# Save your work
git add .
git commit -m "feat: describe what you built"

# Get latest main
git checkout main
git pull

# Merge your branch
git merge feat/<your-branch>

# If conflicts: resolve them, then:
git add .
git commit -m "merge: resolve conflicts"

# Push
git push origin main

# Go back to your branch
git checkout feat/<your-branch>
git merge main    # Get everyone else's changes
```

---

## Running the App

**Terminal 1 — Backend:**
```bash
cd backend
./venv/bin/python -m uvicorn main:app --reload --port 8000
```

Or with activation (if you prefer):
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs (auto-generated by FastAPI)
