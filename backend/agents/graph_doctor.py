"""Doctor analysis pipeline — fetches patient data, generates clinical analysis, drafts recommendations."""
import json
from agents.state import DoctorAnalysisState
from agents.prompts import AGENT2_SYSTEM_PROMPT
from services.claude_service import generate_clinical_analysis, draft_patient_recommendation
from database.db import fetch_all, fetch_one


async def run_doctor_analysis(state: DoctorAnalysisState) -> DoctorAnalysisState:
    """Run the full doctor analysis pipeline.
    
    Flow: fetch_patient_data → agent2_analyse → draft_recommendations → generate_preview
    """
    patient_id = state["patient_id"]

    # ── Step 1: Fetch all patient data ──
    patient = await fetch_one("SELECT * FROM patients WHERE id = ?", (patient_id,))
    glucose = await fetch_all(
        "SELECT value_mmol, measurement_time, context FROM glucose_readings WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT 30",
        (patient_id,)
    )
    meals = await fetch_all(
        "SELECT food_name, calories_estimate, carbs_grams, meal_time, meal_type, cultural_context FROM meals WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 30",
        (patient_id,)
    )
    med_logs = await fetch_all(
        "SELECT medication_name, action, scheduled_time, actual_time, reason_if_skipped FROM med_logs WHERE patient_id = ? ORDER BY scheduled_time DESC LIMIT 30",
        (patient_id,)
    )
    medications = await fetch_all(
        "SELECT name, dosage, frequency FROM medications WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )
    alerts = await fetch_all(
        "SELECT alert_type, severity, title, description, created_at FROM alerts WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10",
        (patient_id,)
    )
    goals = await fetch_all(
        "SELECT goal_type, target_value, target_unit, description, compliance_rate FROM lifestyle_goals WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )

    patient_data = {
        "patient": patient,
        "glucose_readings": glucose,
        "meals": meals,
        "medication_logs": med_logs,
        "active_medications": medications,
        "recent_alerts": alerts,
        "lifestyle_goals": goals,
    }
    state["patient_data"] = patient_data

    # ── Step 2: Agent 2 — Clinical Analysis ──
    analysis = await generate_clinical_analysis(
        json.dumps(patient_data, default=str),
        AGENT2_SYSTEM_PROMPT
    )
    state["analysis"] = analysis
    state["analysis_text"] = analysis.get("summary", "")
    state["recommendations"] = analysis.get("recommendations", [])

    # ── Step 3: Draft patient recommendation ──
    if state.get("doctor_actions"):
        patient_name = patient.get("name", "Patient") if patient else "Patient"
        rec_text = await draft_patient_recommendation(
            state["analysis_text"],
            state["doctor_actions"],
            patient_name
        )
        state["preview_payload"] = {"recommendation_text": rec_text}
    else:
        state["preview_payload"] = {}

    return state

