"""Patient dashboard and manual logging endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from datetime import datetime, timedelta
import re

from database.db import fetch_all, fetch_one, execute

router = APIRouter()

# Simple in-memory cache for nutrition lookups
_nutrition_cache: dict = {}


def uid():
    return str(uuid4())[:8]


def _parse_dose_times(frequency: str) -> list[str]:
    """Parse a medication frequency string into a list of 24h dose times."""
    freq = frequency.lower()
    if "3x" in freq or "three" in freq:
        return ["08:00", "14:00", "20:00"]
    if "2x" in freq or "twice" in freq or "two" in freq or "am/pm" in freq or "bd" in freq:
        return ["08:00", "20:00"]
    if "morning" in freq or "am" in freq:
        return ["08:00"]
    if "evening" in freq or "night" in freq or "bedtime" in freq or "pm" in freq or "od" in freq:
        return ["20:00"]
    # Default: single daily dose at 8am
    return ["08:00"]


@router.get("/patients/{patient_id}/dashboard")
async def get_patient_dashboard(patient_id: str):
    """Get full patient dashboard data."""
    patient = await fetch_one("SELECT * FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = None
    if patient.get("doctor_id"):
        doctor = await fetch_one(
            "SELECT id, name, specialty FROM doctors WHERE id = ?",
            (patient["doctor_id"],)
        )

    glucose = await fetch_all(
        "SELECT id, value_mmol, measurement_time, context FROM glucose_readings WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT 30",
        (patient_id,)
    )
    meals = await fetch_all(
        "SELECT id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, cultural_context, logged_via FROM meals WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 30",
        (patient_id,)
    )
    med_logs = await fetch_all(
        "SELECT id, medication_name, action, scheduled_time, actual_time FROM med_logs WHERE patient_id = ? ORDER BY scheduled_time DESC LIMIT 30",
        (patient_id,)
    )
    medications = await fetch_all(
        "SELECT id, name, dosage, frequency, active FROM medications WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )
    recommendations = await fetch_all(
        "SELECT id, content, recommendation_type, status, created_at FROM recommendations WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5",
        (patient_id,)
    )
    goals = await fetch_all(
        "SELECT id, goal_type, target_value, target_unit, description, compliance_rate FROM lifestyle_goals WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )
    referrals = await fetch_all(
        "SELECT id, referral_type, description, appointment_date, status FROM referrals WHERE patient_id = ?",
        (patient_id,)
    )
    history_requests = await fetch_all(
        "SELECT id, request_text, patient_response, status FROM history_requests WHERE patient_id = ?",
        (patient_id,)
    )

    return {
        "patient": patient,
        "doctor": doctor,
        "glucose_readings": glucose,
        "meals": meals,
        "med_logs": med_logs,
        "medications": medications,
        "recommendations": recommendations,
        "lifestyle_goals": goals,
        "referrals": referrals,
        "history_requests": history_requests,
    }


@router.get("/meals/lookup")
async def lookup_meal_nutrition(food_name: str):
    """Use AI to get nutritional info for a named food."""
    key = food_name.strip().lower()
    if key in _nutrition_cache:
        return _nutrition_cache[key]

    from services.claude_service import _get_client, MODEL, _strip_code_fences
    import json

    try:
        client = _get_client()
        response = await client.messages.create(
            model=MODEL,
            max_tokens=256,
            system=(
                "You are a nutritional database for Singaporean and Southeast Asian cuisine. "
                "Return ONLY valid JSON with these keys: food_name, calories (integer), "
                "carbs_grams (number), protein_grams (number), fat_grams (number), "
                "cultural_context (hawker_food|home_cooked|restaurant). No extra text."
            ),
            messages=[{"role": "user", "content": f"Nutritional info for: {food_name}"}],
        )
        raw = _strip_code_fences(response.content[0].text)
        result = json.loads(raw)
        _nutrition_cache[key] = result
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nutrition lookup failed: {e}")


@router.get("/patients/{patient_id}/med-schedule")
async def get_med_schedule(patient_id: str):
    """Return a 7-day schedule of expected dose slots with taken/missed/pending status."""
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    medications = await fetch_all(
        "SELECT id, name, frequency FROM medications WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )
    now = datetime.now()
    today = now.date()
    days = [(today - timedelta(days=i)) for i in range(6, -1, -1)]

    # Fetch all med logs for the past 7 days
    week_start = days[0].isoformat()
    med_logs = await fetch_all(
        "SELECT medication_name, action, scheduled_time, actual_time FROM med_logs "
        "WHERE patient_id = ? AND (scheduled_time >= ? OR actual_time >= ?)",
        (patient_id, week_start, week_start)
    )

    schedule = []
    for med in medications:
        dose_times = _parse_dose_times(med.get("frequency", "1x daily"))
        for day in days:
            for time_str in dose_times:
                slot_dt = datetime.fromisoformat(f"{day.isoformat()}T{time_str}:00")
                # Find a matching log (within ±2h of scheduled slot)
                matched_log = None
                for log in med_logs:
                    if log["medication_name"] != med["name"]:
                        continue
                    log_time_str = log.get("scheduled_time") or log.get("actual_time") or ""
                    if not log_time_str:
                        continue
                    try:
                        log_dt = datetime.fromisoformat(log_time_str[:19])
                    except ValueError:
                        continue
                    if log_dt.date() == day and abs((log_dt - slot_dt).total_seconds()) <= 7200:
                        matched_log = log
                        break

                if matched_log:
                    status = matched_log["action"]  # taken / skipped / delayed
                elif slot_dt < now:
                    status = "missed"
                else:
                    status = "pending"

                schedule.append({
                    "date": day.isoformat(),
                    "medication_name": med["name"],
                    "time_24h": time_str,
                    "status": status,
                    "actual_time": matched_log.get("actual_time") if matched_log else None,
                })

    return {"schedule": schedule}


class MealLog(BaseModel):
    food_name: str
    calories_estimate: Optional[int] = None
    carbs_grams: Optional[float] = None
    protein_grams: Optional[float] = None
    fat_grams: Optional[float] = None
    meal_type: str = "snack"


@router.post("/patients/{patient_id}/meals")
async def log_meal_manual(patient_id: str, meal: MealLog):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    meal_id = uid()
    await execute(
        "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (meal_id, patient_id, meal.food_name, meal.calories_estimate, meal.carbs_grams,
         meal.protein_grams, meal.fat_grams, datetime.now().isoformat(), meal.meal_type, "manual")
    )
    return {"success": True, "meal_id": meal_id}


class GlucoseLog(BaseModel):
    value_mmol: float
    context: str = "fasting"


@router.post("/patients/{patient_id}/glucose")
async def log_glucose_manual(patient_id: str, reading: GlucoseLog):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    reading_id = uid()
    await execute(
        "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context, logged_via) VALUES (?,?,?,?,?,?)",
        (reading_id, patient_id, reading.value_mmol, datetime.now().isoformat(), reading.context, "manual")
    )
    return {"success": True, "reading_id": reading_id}


class MedLog(BaseModel):
    medication_name: str
    action: str = "taken"


@router.post("/patients/{patient_id}/medications/log")
async def log_medication_manual(patient_id: str, log: MedLog):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    log_id = uid()
    await execute(
        "INSERT INTO med_logs (id, patient_id, medication_name, action, actual_time, logged_via) VALUES (?,?,?,?,?,?)",
        (log_id, patient_id, log.medication_name, log.action, datetime.now().isoformat(), "manual")
    )
    return {"success": True, "log_id": log_id}


class HistoryResponse(BaseModel):
    request_id: str
    response_text: str


@router.post("/patients/{patient_id}/history-response")
async def respond_to_history_request(patient_id: str, resp: HistoryResponse):
    req_row = await fetch_one(
        "SELECT id FROM history_requests WHERE id = ? AND patient_id = ?",
        (resp.request_id, patient_id),
    )
    if not req_row:
        raise HTTPException(status_code=404, detail="History request not found")
    await execute(
        "UPDATE history_requests SET patient_response = ?, status = 'responded', responded_at = ? WHERE id = ? AND patient_id = ?",
        (resp.response_text, datetime.now().isoformat(), resp.request_id, patient_id)
    )
    return {"success": True}


@router.get("/patients/{patient_id}/referrals")
async def get_referrals(patient_id: str):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    refs = await fetch_all(
        "SELECT id, referral_type, description, appointment_date, status FROM referrals WHERE patient_id = ?",
        (patient_id,)
    )
    return {"referrals": refs}
