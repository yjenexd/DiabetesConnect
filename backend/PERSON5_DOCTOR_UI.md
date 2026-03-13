# Person 5 — Doctor Frontend

## Your Scope
You own `/frontend/src/doctor/`. You build the clinician-facing dashboard with AI analysis, patient management, and the action/recommendation workflow.

## Files You Own
- `frontend/src/doctor/DoctorDashboard.jsx` — Main doctor view with sidebar + detail area
- `frontend/src/doctor/PatientList.jsx` — Left sidebar patient list with filtering
- `frontend/src/doctor/PatientDetail.jsx` — Right panel with selected patient info
- `frontend/src/doctor/AIAnalysisPanel.jsx` — AI-generated clinical analysis section
- `frontend/src/doctor/ActionForms.jsx` — Forms for prescribe/lifestyle/referral/history
- `frontend/src/doctor/RecommendationComposer.jsx` — Draft, edit, preview, send recommendations
- `frontend/src/doctor/DashboardPreview.jsx` — Shows what patient will see (for preview before send)
- `frontend/src/doctor/PatientViewModal.jsx` — "View as Patient" full dashboard modal

---

## Day 1: Claude Code Prompts

### Prompt 1 — API Functions (add to shared/api.js)

```
Add these doctor-facing API functions to the shared api.js file:

- getDoctorPatients(doctorId, sortBy?, filterSeverity?) → GET /api/doctor/{id}/patients?sort_by=&filter_severity=
- getPatientDetail(patientId) → GET /api/doctor/patients/{id}/detail
- getPatientView(patientId) → GET /api/doctor/patients/{id}/patient-view
- generateReport(patientId) → POST /api/doctor/patients/{id}/generate-report
- createDoctorAction(patientId, {action_type, action_data}) → POST /api/doctor/patients/{id}/actions
- draftRecommendation(patientId, {content, recommendation_type}) → POST /api/doctor/patients/{id}/recommendation
- approveRecommendation(patientId, recId, content?) → PUT /api/doctor/patients/{id}/recommendation/{recId}/approve
- acknowledgeAlert(alertId) → PUT /api/alerts/{id}/acknowledge
```

### Prompt 2 — Doctor Dashboard Layout

```
Create a DoctorDashboard component with a two-column layout:

LEFT SIDEBAR (fixed width ~280px):
- Header: "My Patients" with total count badge
- Filter/sort controls:
  - Sort dropdown: Urgency (default), Alphabetical, Gender
  - Severity filter: All, Critical, Warning, Info
- Scrollable patient list (PatientList component)

RIGHT MAIN AREA (flex-grow):
- If no patient selected: show a placeholder "Select a patient to view details"
- If patient selected: show PatientDetail component

Use React state to track selectedPatientId. Pass it down to both sides.
Desktop-first layout (doctors use computers, not phones).
Clean, professional medical dashboard aesthetic — white background, subtle borders.
Use Tailwind CSS.
```

### Prompt 3 — Patient List

```
Create a PatientList component that shows a scrollable list of patients.

Props: patients[], selectedId, onSelect(id), sortBy, filterSeverity

Each patient card shows:
- Colored dot indicator: red (#ef4444) for critical/high risk, yellow (#f59e0b) for medium, green (#22c55e) for low
- Patient name (bold) and age
- 1-line summary: e.g. "Glucose rising, 3 missed meds" or "On track, next review 2w"
- The summary should be derived from risk_level, adherence_pct, latest_glucose

Clicking a card selects it (highlighted border/background).
The selected card should be visually distinct.

Sort by urgency by default (red patients at top).
```

### Prompt 4 — Patient Detail

```
Create a PatientDetail component for the doctor's view of a patient.

Sections (scrollable, stacked vertically):

1. PATIENT HEADER — name, age, gender, diabetes type, current medications list, last visit date, risk badge (red/yellow/green pill)

2. KEY METRICS ROW — 3 stat cards side by side:
   - Avg glucose (7d) — number + color (red if >10, yellow if >8, green if <8)
   - Medication adherence — percentage + color (red if <70%, yellow if <85%, green if >=85%)
   - Avg daily carbs — number in grams + color vs target

3. GLUCOSE CHART — reuse shared GlucoseChart component from Person 4

4. AI ANALYSIS PANEL — AIAnalysisPanel component (separate prompt below)

5. DOCTOR ACTION BUTTONS — 4 buttons in a row:
   - "Prescribe Medication" (pill icon)
   - "Lifestyle Change" (heart icon)
   - "Request History" (clipboard icon)
   - "Referral" (external-link icon)
   Each opens the corresponding ActionForms modal

6. RECENT ALERTS — list of alerts with severity badges, "Acknowledge" button on each

7. SEND RECOMMENDATION PANEL — RecommendationComposer component

8. "VIEW AS PATIENT" BUTTON — opens PatientViewModal

Fetch data from getPatientDetail(patientId) on mount and when patientId changes.
```

### Prompt 5 — AI Analysis Panel

```
Create an AIAnalysisPanel component.

Props: patientId, analysisData? (from weekly_reports)

Layout:
- Header row: "AI Clinical Analysis" title + "Generate Analysis" button (blue pill button)
- If no analysis exists: show placeholder "Click generate to create a weekly analysis"
- If analysis exists or just generated: show in a bordered card:
  - "Weekly Summary" heading + narrative text
  - "Key Findings" section with severity-colored badges per finding
  - "Recommended Actions" numbered list, ordered by priority
  - "Risk Level" badge at bottom

On "Generate Analysis" click:
1. Button shows loading spinner
2. Call generateReport(patientId)
3. Display the returned analysis
4. Show a success toast/notification

The analysis text should be displayed with good typography — line height, paragraph spacing.
```

### Prompt 6 — Action Forms

```
Create an ActionForms component that renders a modal form based on action type.

Props: actionType (prescribe_medication | lifestyle_change | request_history | referral), patientId, onClose, onSuccess

PRESCRIBE MEDICATION form:
- Medication name (text input)
- Dosage (text input, e.g. "500mg")
- Frequency dropdown: 1x daily AM, 1x daily PM, 2x daily, 3x daily
- Notes (textarea, optional)

LIFESTYLE CHANGE form:
- Goal type dropdown: Daily carb limit, Exercise target, Weight target, Meal timing
- Target value (number input)
- Target unit (auto-filled based on goal type: grams_per_day, minutes_per_day, kg, etc.)
- Description (textarea — human-readable explanation for the patient)

REQUEST HISTORY form:
- Request text (textarea): "Please provide your family history of..."
- Pre-filled suggestions: "Family history of diabetes", "Previous surgeries", "Current supplements"

REFERRAL form:
- Referral type dropdown: Eye screening, Foot exam, Blood test, Specialist, Dietitian
- Description (textarea)
- Suggested date (date picker)

All forms:
- Modal overlay
- Submit calls createDoctorAction(patientId, {action_type, action_data})
- Loading state on submit
- Success: close modal, trigger parent refresh
- Cancel button
```

### Prompt 7 — Recommendation Composer

```
Create a RecommendationComposer component.

Props: patientId, patientName

Layout:
1. "Send Recommendation to Patient" heading
2. Large textarea with the recommendation text
   - Pre-filled with AI draft if available (from the last generate-report call)
   - Editable by the doctor
3. Button row:
   - "Preview" button → opens DashboardPreview showing what patient will see
   - "Send to Patient" button (primary, blue) → calls approveRecommendation
   - "Discard" button (secondary, gray)

Flow:
1. Doctor edits the text
2. Clicks "Preview" → DashboardPreview modal opens showing patient dashboard with the new recommendation visible
3. Doctor reviews → closes preview
4. Clicks "Send to Patient" → calls API → success confirmation
5. The recommendation appears in the patient's "Doctor's Notes" section

Show character count. Max ~500 characters for patient-friendliness.
```

### Prompt 8 — Dashboard Preview

```
Create a DashboardPreview component that shows exactly what the patient's dashboard will look like after the doctor's changes are applied.

Props: patientId, pendingRecommendation?, pendingActions[]

This should:
1. Fetch the current patient dashboard data (getPatientView)
2. Overlay/merge the pending changes:
   - New recommendation shows at top of "Doctor's Notes"
   - New medication shows in medication list
   - New lifestyle goal shows in "Active Goals"
   - New referral shows in "Upcoming Actions"
3. Render using the same components as the patient dashboard (reuse Person 4's shared components)
4. Show a banner at top: "Preview — This is what the patient will see"
5. Display in a full-screen modal or slide-out panel

The doctor should be able to see the impact of their actions before confirming.
```

---

## Day 2: Integration

- Connect patient list to real API data — verify sorting and filtering work
- Connect AI Analysis panel to the generate-report endpoint
- Test all 4 action forms: submit each type and verify the data appears in the patient's dashboard
- Test the recommendation flow: generate analysis → take actions → draft recommendation → preview → send
- Test "View as Patient" modal — should show the patient's actual dashboard

## Day 3: Polish
- Make sure the dashboard preview accurately reflects pending changes
- Test the full doctor workflow end-to-end: see patient flagged → generate analysis → take action → send recommendation
- Verify the patient list updates correctly when alerts change
- Test on the actual demo screen resolution
