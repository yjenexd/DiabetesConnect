"""Doctor dashboard, analysis, and action endpoints."""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from datetime import datetime

from database.db import fetch_all, fetch_one, execute
from agents.graph_doctor import run_doctor_analysis

router = APIRouter()


def uid():
    return str(uuid4())[:8]


@router.get("/doctor/{doctor_id}/patients")
async def get_doctor_patients(doctor_id: str, sort_by: str = "urgency", filter_severity: str = "all"):
    """Get a doctor's patient list with risk indicators."""
    patients = await fetch_all(
        "SELECT id, name, age, gender, diabetes_type, language_preference FROM patients WHERE doctor_id = ?",
        (doctor_id,)
    )

    enriched = []
    for p in patients:
        pid = p["id"]
        # Latest glucose
        latest_glucose_row = await fetch_one(
            "SELECT value_mmol FROM glucose_readings WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT 1", (pid,)
        )
        latest_glucose = latest_glucose_row["value_mmol"] if latest_glucose_row else None

        # Adherence
        total_logs = await fetch_one("SELECT COUNT(*) as cnt FROM med_logs WHERE patient_id = ?", (pid,))
        taken_logs = await fetch_one("SELECT COUNT(*) as cnt FROM med_logs WHERE patient_id = ? AND action = 'taken'", (pid,))
        total = total_logs["cnt"] if total_logs else 0
        taken = taken_logs["cnt"] if taken_logs else 0
        adherence_pct = round((taken / total * 100) if total > 0 else 100)

        # Latest alert severity
        latest_alert = await fetch_one(
            "SELECT severity FROM alerts WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1", (pid,)
        )
        alert_severity = latest_alert["severity"] if latest_alert else "none"

        # Risk level
        risk = "low"
        if latest_glucose and latest_glucose > 10:
            risk = "high"
        elif latest_glucose and latest_glucose > 8:
            risk = "medium"
        if adherence_pct < 70:
            risk = "high"
        if alert_severity == "critical":
            risk = "high"

        if filter_severity != "all" and alert_severity != filter_severity:
            continue

        enriched.append({
            **p,
            "latest_glucose": latest_glucose,
            "adherence_pct": adherence_pct,
            "latest_alert_severity": alert_severity,
            "risk_level": risk,
        })

    # Sort
    severity_order = {"high": 0, "medium": 1, "low": 2}
    if sort_by == "urgency":
        enriched.sort(key=lambda x: severity_order.get(x["risk_level"], 3))
    elif sort_by == "alphabetical":
        enriched.sort(key=lambda x: x["name"])

    return {"patients": enriched, "total_count": len(enriched)}


@router.get("/doctor/patients/{patient_id}/detail")
async def get_patient_detail(patient_id: str):
    """Get full patient detail for the doctor view."""
    patient = await fetch_one("SELECT * FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        return {"error": "Patient not found"}

    glucose = await fetch_all(
        "SELECT * FROM glucose_readings WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT 30", (patient_id,)
    )
    meals = await fetch_all(
        "SELECT * FROM meals WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 30", (patient_id,)
    )
    med_logs = await fetch_all(
        "SELECT * FROM med_logs WHERE patient_id = ? ORDER BY scheduled_time DESC LIMIT 30", (patient_id,)
    )
    medications = await fetch_all(
        "SELECT * FROM medications WHERE patient_id = ? AND active = 1", (patient_id,)
    )
    alerts = await fetch_all(
        "SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20", (patient_id,)
    )
    goals = await fetch_all(
        "SELECT * FROM lifestyle_goals WHERE patient_id = ? AND active = 1", (patient_id,)
    )
    referrals = await fetch_all("SELECT * FROM referrals WHERE patient_id = ?", (patient_id,))
    history_requests = await fetch_all("SELECT * FROM history_requests WHERE patient_id = ?", (patient_id,))
    recommendations = await fetch_all(
        "SELECT * FROM recommendations WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10", (patient_id,)
    )
    weekly_reports = await fetch_all(
        "SELECT * FROM weekly_reports WHERE patient_id = ? ORDER BY generated_at DESC LIMIT 5", (patient_id,)
    )
    actions = await fetch_all(
        "SELECT * FROM doctor_actions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10", (patient_id,)
    )

    return {
        "patient": patient,
        "glucose_readings": glucose,
        "meals": meals,
        "med_logs": med_logs,
        "medications": medications,
        "alerts": alerts,
        "lifestyle_goals": goals,
        "referrals": referrals,
        "history_requests": history_requests,
        "recommendations": recommendations,
        "weekly_reports": weekly_reports,
        "doctor_actions": actions,
    }


@router.get("/doctor/patients/{patient_id}/patient-view")
async def get_patient_view(patient_id: str):
    """Get what the patient sees (for doctor preview)."""
    from api.routes.patient import get_patient_dashboard
    return await get_patient_dashboard(patient_id)


@router.post("/doctor/patients/{patient_id}/generate-report")
async def generate_report(patient_id: str, doctor_id: str = "dr_tan_001"):
    """Generate an AI clinical analysis report."""
    state = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "request_type": "weekly_report",
    }
    result = await run_doctor_analysis(state)

    # Save the report
    report_id = uid()
    analysis = result.get("analysis", {})
    await execute(
        "INSERT INTO weekly_reports (id, patient_id, summary_text, key_metrics, risk_level, recommendations, generated_at) VALUES (?,?,?,?,?,?,?)",
        (report_id, patient_id, analysis.get("summary", ""),
         json.dumps(analysis.get("key_findings", []), default=str),
         analysis.get("risk_level", "unknown"),
         json.dumps(analysis.get("recommendations", []), default=str),
         datetime.now().isoformat())
    )

    return {
        "report_id": report_id,
        "analysis": analysis,
        "recommendations": result.get("recommendations", []),
        "preview": result.get("preview_payload", {}),
    }


class ActionRequest(BaseModel):
    action_type: str  # prescribe_medication, lifestyle_change, request_history, referral
    action_data: dict


@router.post("/doctor/patients/{patient_id}/actions")
async def create_doctor_action(patient_id: str, req: ActionRequest, doctor_id: str = "dr_tan_001"):
    """Apply a doctor action (prescribe, lifestyle, request history, referral)."""
    action_id = uid()
    await execute(
        "INSERT INTO doctor_actions (id, patient_id, doctor_id, action_type, action_data, status, created_at) VALUES (?,?,?,?,?,?,?)",
        (action_id, patient_id, doctor_id, req.action_type, json.dumps(req.action_data), "active", datetime.now().isoformat())
    )

    # Create associated records
    if req.action_type == "prescribe_medication":
        med_id = uid()
        await execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (med_id, patient_id, req.action_data.get("name", ""), req.action_data.get("dosage", ""),
             req.action_data.get("frequency", ""), doctor_id, datetime.now().isoformat(), 1)
        )

    elif req.action_type == "lifestyle_change":
        goal_id = uid()
        await execute(
            "INSERT INTO lifestyle_goals (id, patient_id, action_id, goal_type, target_value, target_unit, description, active) VALUES (?,?,?,?,?,?,?,?)",
            (goal_id, patient_id, action_id, req.action_data.get("goal_type", ""),
             req.action_data.get("target_value", 0), req.action_data.get("target_unit", ""),
             req.action_data.get("description", ""), 1)
        )

    elif req.action_type == "request_history":
        req_id = uid()
        await execute(
            "INSERT INTO history_requests (id, patient_id, action_id, request_text, status) VALUES (?,?,?,?,?)",
            (req_id, patient_id, action_id, req.action_data.get("request_text", ""), "pending")
        )

    elif req.action_type == "referral":
        ref_id = uid()
        await execute(
            "INSERT INTO referrals (id, patient_id, action_id, referral_type, description, appointment_date, status) VALUES (?,?,?,?,?,?,?)",
            (ref_id, patient_id, action_id, req.action_data.get("referral_type", ""),
             req.action_data.get("description", ""), req.action_data.get("appointment_date", ""), "pending")
        )

    return {"success": True, "action_id": action_id}


class RecommendationRequest(BaseModel):
    content: str
    recommendation_type: str = "general"


@router.post("/doctor/patients/{patient_id}/recommendation")
async def draft_recommendation(patient_id: str, req: RecommendationRequest, doctor_id: str = "dr_tan_001"):
    rec_id = uid()
    await execute(
        "INSERT INTO recommendations (id, patient_id, doctor_id, recommendation_type, content, ai_generated_draft, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (rec_id, patient_id, doctor_id, req.recommendation_type, req.content, req.content, "draft", datetime.now().isoformat())
    )
    return {"recommendation_id": rec_id, "preview": {"content": req.content}}


class ApproveRequest(BaseModel):
    content: Optional[str] = None


@router.put("/doctor/patients/{patient_id}/recommendation/{rec_id}/approve")
async def approve_recommendation(patient_id: str, rec_id: str, req: ApproveRequest = None):
    if req and req.content:
        await execute(
            "UPDATE recommendations SET content = ?, status = 'sent' WHERE id = ?",
            (req.content, rec_id)
        )
    else:
        await execute("UPDATE recommendations SET status = 'sent' WHERE id = ?", (rec_id,))
    return {"success": True}


@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    await execute("UPDATE alerts SET acknowledged_by_doctor = 1 WHERE id = ?", (alert_id,))
    return {"success": True}

