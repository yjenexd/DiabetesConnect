# Person 4 — Patient Frontend

## Your Scope
You own `/frontend/src/patient/` and `/frontend/src/shared/`. You build the patient-facing chat UI and dashboard.

## Files You Own
- `frontend/src/patient/PatientDashboard.jsx` — Main patient dashboard view
- `frontend/src/patient/ChatInterface.jsx` — Chat UI with message bubbles
- `frontend/src/patient/VoiceRecorder.jsx` — Microphone button + audio recording
- `frontend/src/patient/PhotoUpload.jsx` — Camera/photo upload for meal logging
- `frontend/src/patient/FloatingActionButton.jsx` — The "+" button (TikTok-style)
- `frontend/src/patient/ManualLogModal.jsx` — Modal for manual meal/glucose/med logging
- `frontend/src/patient/GoalsSection.jsx` — Active lifestyle goals display
- `frontend/src/shared/api.js` — Axios API client (shared with Person 5)
- `frontend/src/shared/GlucoseChart.jsx` — Recharts glucose trend chart (shared)
- `frontend/src/shared/MedAdherenceGrid.jsx` — Medication adherence grid (shared)

---

## Day 1: Claude Code Prompts

### Prompt 1 — Project Setup

```
Set up a React + Vite + Tailwind project for a health dashboard app.

Create these files:
- vite.config.js: React plugin, dev server on port 5173, proxy /api to localhost:8000 and /ws to ws://localhost:8000
- tailwind.config.js: content from ./src, extend colors with primary (blue), danger (red), success (green), warning (amber)
- postcss.config.js: tailwind + autoprefixer
- index.html: basic HTML shell with div#root
- src/main.jsx: render App with BrowserRouter
- src/index.css: @tailwind base/components/utilities
- src/App.jsx: React Router with routes:
  - /patient/:id → PatientDashboard
  - /patient/:id/chat → ChatInterface
  - /doctor/:id → DoctorDashboard (Person 5 builds this)
```

### Prompt 2 — API Client

```
Create a shared API client (src/shared/api.js) using axios.

Base URL: "" (empty — Vite proxy handles /api routing)

Functions:
- getPatientDashboard(patientId) → GET /api/patients/{id}/dashboard
- sendChatMessage(patientId, message, inputType, audioBase64?, imageBase64?) → POST /api/chat
- logMealManual(patientId, {food_name, calories_estimate, carbs_grams, meal_type}) → POST /api/patients/{id}/meals
- logGlucoseManual(patientId, {value_mmol, context}) → POST /api/patients/{id}/glucose
- logMedicationManual(patientId, {medication_name, action}) → POST /api/patients/{id}/medications/log
- respondToHistoryRequest(patientId, {request_id, response_text}) → POST /api/patients/{id}/history-response

Also export a WebSocket connector function for real-time chat:
- connectChatWebSocket(patientId) → returns WebSocket instance connected to /api/ws/chat/{patientId}

All functions should handle errors gracefully and return {data, error} format.
```

### Prompt 3 — Chat Interface

```
Create a chat interface component (ChatInterface.jsx) for a diabetes health companion.

Requirements:
- Full-height chat view with message bubbles (patient right-aligned blue, bot left-aligned gray)
- Text input bar at bottom with send button
- Microphone button next to input (triggers VoiceRecorder)
- Camera/photo button next to input (triggers PhotoUpload)
- Messages should show timestamp
- When bot is "thinking", show typing indicator (3 animated dots)
- Auto-scroll to bottom on new messages
- Load chat history from API on mount

On send: call sendChatMessage() from api.js, append response to message list.

Use Tailwind CSS. Use lucide-react icons (Send, Mic, Camera, Bot, User).
Make it mobile-friendly — this is for elderly patients, so:
- Large touch targets (min 44px)
- Large font (16px+ for messages)
- High contrast
- Simple, uncluttered layout
```

### Prompt 4 — Voice Recorder

```
Create a VoiceRecorder component that:
1. Shows a microphone button
2. On press-and-hold (or tap to start/stop), records audio using MediaRecorder API
3. Converts the recorded audio to base64
4. Passes the base64 audio string back to parent via onRecordComplete(audioBase64) callback
5. Shows recording indicator (pulsing red dot) while recording
6. Maximum recording time: 30 seconds
7. Audio format: webm (browser default)

Use navigator.mediaDevices.getUserMedia for microphone access.
Handle permission denied gracefully with a user-friendly message.
```

### Prompt 5 — Patient Dashboard

```
Create a PatientDashboard component that displays:

1. TODAY'S SUMMARY CARD — meds taken/missed today, latest glucose reading, meals logged count
   Color code: green for good, red for concerning, yellow for warning

2. DOCTOR'S NOTES CARD — latest recommendation from the doctor
   Show doctor name, date, and the message text

3. GLUCOSE TREND CHART — 7-day line chart using Recharts
   - X axis: days (Mon-Sun)
   - Y axis: mmol/L
   - Green horizontal band showing target range (4-7 mmol/L)
   - Red line if values are above 10
   - Use data from getPatientDashboard() API

4. MEDICATION ADHERENCE GRID — 7-day × AM/PM grid
   - Green squares for "taken", red for "skipped", gray for "upcoming"
   - Show adherence percentage below

5. ACTIVE GOALS SECTION — lifestyle goals set by doctor
   - Show each goal with description and compliance percentage
   - Progress bar for each

6. UPCOMING ACTIONS — pending referrals, history requests, appointments
   - Show as a list with status badges (pending/scheduled)
   - History requests should have a "Respond" button

7. FLOATING "+" BUTTON — bottom-center, TikTok-style
   - Fixed position, circular, with a + icon
   - On click: expand upward to show 3-4 options:
     - "Log Meal" (utensils icon)
     - "Log Blood Sugar" (droplet icon)  
     - "Log Medication" (pill icon)
   - Each option opens a ManualLogModal

8. "CHAT WITH COMPANION" BUTTON — prominent button that navigates to /patient/{id}/chat

Fetch all data from getPatientDashboard(patientId) on mount.
Use useParams() to get patientId from the URL.
Mobile-friendly layout: single column, large touch targets, clear visual hierarchy.
```

### Prompt 6 — Manual Log Modal

```
Create a ManualLogModal component with 3 modes:

Mode "meal":
- Food name text input
- Calories number input (optional)
- Carbs (g) number input (optional)
- Meal type dropdown: breakfast, lunch, dinner, snack
- Submit button

Mode "glucose":
- Value (mmol/L) number input (step 0.1)
- Context dropdown: fasting, pre-meal, post-meal, bedtime
- Submit button

Mode "medication":
- Medication name dropdown (populated from patient's active medications)
- Action: two buttons "Taken ✓" and "Skipped ✗"
- Submit button

All modes:
- Modal overlay with backdrop blur
- Close button (X) top right
- Loading state on submit
- Success confirmation then auto-close
- Call the appropriate api.js function on submit
```

---

## Day 2: Integration + Polish

- Connect chat to real backend (should already work if Person 3's endpoints are up)
- Test photo upload: take a photo of food → see Claude's analysis come back in chat
- Test voice: record a Mandarin sentence → see it transcribed and responded to
- Connect dashboard to real data from the API
- Test the floating "+" button manual logging flows
- Build the GlucoseChart and MedAdherenceGrid shared components with real data

## Day 3: Polish
- Test with multiple screen sizes (the demo might be on a projector)
- Make sure the chat auto-scrolls properly
- Pre-load some chat messages in the demo so the conversation doesn't start empty
- Test the voice recording on the actual demo device
