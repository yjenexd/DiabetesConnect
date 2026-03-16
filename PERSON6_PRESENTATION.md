# Person 6 — Presentation, Demo Script & Documentation

## Your Scope
If you're the 6th team member, you own the presentation and demo preparation. If the team is 5 people, split these tasks across the team on Day 3 morning.

## Files You Own
- `presentation/slides.pptx` (or Google Slides)
- `docs/DEMO_SCRIPT.md`
- Data strategy and evaluation framework content

---

## Presentation Structure (10 minutes total)

### Slide 1: Title (10 sec)
- "DiabetesConnect: Agentic AI for Diabetes Patient Empowerment"
- Team name, hackathon name, date

### Slide 2: The Problem (1 min)
Key stats to include:
- 1 in 3 Singaporeans will develop diabetes in their lifetime
- Patients see their doctor once every 3 months — that's 90 days of unsupervised self-management
- 50% of diabetic patients don't take medications correctly
- Language barriers: 40% of elderly Singaporeans are not comfortable with English
- Doctors manage 200+ patients each with no visibility between visits

### Slide 3: Our Solution — DiabetesConnect (30 sec)
- One-line pitch: "An AI companion that speaks your language, watches your health daily, and keeps your doctor informed"
- Show the two-interface concept: Patient chatbot + Doctor dashboard
- Emphasise: the dashboard is the BRIDGE between patient and clinician

### Slide 4: Why Agentic AI? (30 sec)
- Traditional apps: passive (wait for patient to act)
- Our system: 3 autonomous agents that perceive, reason, plan, and act
- Agent 1 (Patient Companion): understands multilingual input, logs data, gives culturally aware advice
- Agent 2 (Clinical Analyst): generates weekly clinical documentation from patient data
- Agent 3 (Proactive Monitor): detects anomalies, nudges patients, flags doctors

### LIVE DEMO (5-6 min) — see Demo Script below

### Slide 5: Architecture (45 sec)
- Show the system architecture diagram (from the tech spec)
- Highlight the SEA-LION ↔ Claude routing ("ears/mouth vs brain")
- Mention: LangGraph for agent orchestration, FastAPI backend, React frontend, SQLite

### Slide 6: Data Strategy & Ethics (30 sec)
- Patient consent: all data collection is explicit
- Voice data: transcribed and discarded
- No cloud training on patient data
- Cultural sensitivity: food suggestions respect local cuisine
- Doctor maintains full control: AI drafts, doctor approves

### Slide 7: Evaluation Framework (30 sec)
- Patient metrics: medication adherence %, glucose trend, dietary compliance
- Clinician metrics: time to insight (<30 sec), intervention timeliness
- System metrics: language detection accuracy, tool call accuracy
- Demo data shows: 71% → 85% adherence after intervention

### Slide 8: Future Roadmap (30 sec)
- Wearable device integration (CGM, fitness trackers)
- Multi-condition support (hypertension, kidney disease)
- Predictive risk scoring (ML on longitudinal data)
- Tamil + dialect support
- Integration with Singapore's National Electronic Health Record

---

## Demo Script (5-6 minutes)

### Setup Before Demo
- Backend running on localhost:8000
- Frontend running on localhost:5173
- Database seeded with 14 days of Ah Kow's data
- Two browser windows ready: Patient view + Doctor view
- Mandarin voice test done at least 3 times

### Part 1: Patient Experience (2.5 min)

**Presenter says:** "Meet Ah Kow, 62, diabetic uncle who loves his hawker food. Let's see how DiabetesConnect helps him."

1. **Show patient dashboard** (localhost:5173/patient/ah_kow_001)
   - Point out: glucose trending up (red line), medication adherence at 71%, doctor's recent note
   - "Ah Kow can see at a glance that things aren't going well"

2. **Open chat** (click "Chat with companion")
   - **[LIVE MANDARIN VOICE]** Press mic button, say: "我今天午餐吃了炒粿条" (I ate char kway teow for lunch)
   - Wait for Whisper to transcribe → SEA-LION to understand → Claude to respond
   - **Point out:** "The AI understood Mandarin, identified char kway teow, logged it with 90g carbs, and gently suggested a walk — all in the patient's language"

3. **Send a photo** (have a photo of char kway teow ready)
   - Upload the photo → show Claude Vision identifying the food
   - "Even if Ah Kow doesn't know the English name, a photo is enough"

4. **Show code-switching** (type in the chat):
   - Type: "my blood sugar 很高 today lah"
   - "This is real Singaporean speech — mixing English, Mandarin, and Singlish. Our system handles it natively."

5. **Use the "+" button** to manually log glucose: 11.2 mmol/L, post-meal
   - Show it appear on the dashboard immediately

**Transition:** "Now let's see what Dr. Tan sees on her side."

### Part 2: Doctor Experience (2.5 min)

6. **Show doctor dashboard** (localhost:5173/doctor/dr_tan_001)
   - Point out: Ah Kow is flagged RED at the top of the patient list
   - "Dr. Tan manages 200 patients. She immediately knows who needs attention."

7. **Click on Ah Kow** → show patient detail
   - Point out: avg glucose 10.8 (red), adherence 71% (yellow), carbs 285g (above target)

8. **Click "Generate Analysis"**
   - Wait for Agent 2 to produce the clinical summary
   - Read a key finding: "Evening Glipizide was missed 3 of 7 days — all correlating with highest next-morning glucose"
   - "The AI found a pattern that would be impossible to spot in a 15-minute quarterly visit"

9. **Take actions:**
   - Click "Lifestyle Change" → set carb limit 200g/day → submit
   - Click "Referral" → annual eye screening → submit
   - "These actions now feed back into the AI monitoring loop"

10. **Draft and send recommendation:**
    - Show the AI-drafted message
    - Edit it slightly (add "uncle" for warmth)
    - Click "Preview" → show what Ah Kow will see
    - Click "Send"

11. **Switch back to patient dashboard** → show the doctor's recommendation appearing
    - "The circle is complete. Doctor and patient are connected through the dashboard."

### Backup Plans
- **If voice fails:** Have pre-typed Mandarin text ready to paste
- **If API is slow:** Have a pre-generated analysis cached in the database
- **If anything crashes:** Have screenshots of each step ready in the presentation slides

---

## Day 1-2: What You Can Do While Others Code

If you're not coding:
1. **Create all presentation slides** (except architecture diagram — get from tech spec)
2. **Write the demo script** with exact dialogue and timings
3. **Prepare the demo data narrative** — work with Person 3 to make the seed data tell a compelling story
4. **Research Singapore diabetes statistics** for the problem statement slide
5. **Create the data strategy document** — privacy, consent, ethics (see tech spec Section 14)
6. **Design the evaluation framework** — metrics and measurement approach (see tech spec Section 15)
7. **Practice the demo** — even without the working app, rehearse the talking points

## Day 3: Your Big Day
- Lead the demo dry runs
- Time every section
- Assign roles: who demos the patient side, who demos the doctor side, who talks over it
- Make sure the screen resolution works on the projector
- Prepare water, notes, and backup slides
