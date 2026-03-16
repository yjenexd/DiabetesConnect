"""Patient dashboard and manual logging endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from datetime import datetime

from database.db import fetch_all, fetch_one, execute

router = APIRouter()


def uid():
    return str(uuid4())[:8]


@router.get("/patients/{patient_id}/dashboard")
async def get_patient_dashboard(patient_id: str):
    """Get full patient dashboard data."""
    patient = await fetch_one("SELECT * FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        return {"error": "Patient not found"}

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
        "SELECT id, food_name, calories_estimate, carbs_grams, meal_time, meal_type, cultural_context FROM meals WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 30",
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


class MealLog(BaseModel):
    food_name: str
    calories_estimate: Optional[int] = None
    carbs_grams: Optional[float] = None
    meal_type: str = "snack"


@router.post("/patients/{patient_id}/meals")
async def log_meal_manual(patient_id: str, meal: MealLog):
    meal_id = uid()
    await execute(
        "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, meal_time, meal_type, logged_via) VALUES (?,?,?,?,?,?,?,?)",
        (meal_id, patient_id, meal.food_name, meal.calories_estimate, meal.carbs_grams, datetime.now().isoformat(), meal.meal_type, "manual")
    )
    return {"success": True, "meal_id": meal_id}


class GlucoseLog(BaseModel):
    value_mmol: float
    context: str = "fasting"


@router.post("/patients/{patient_id}/glucose")
async def log_glucose_manual(patient_id: str, reading: GlucoseLog):
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
    await execute(
        "UPDATE history_requests SET patient_response = ?, status = 'responded', responded_at = ? WHERE id = ? AND patient_id = ?",
        (resp.response_text, datetime.now().isoformat(), resp.request_id, patient_id)
    )
    return {"success": True}


@router.get("/patients/{patient_id}/referrals")
async def get_referrals(patient_id: str):
    refs = await fetch_all(
        "SELECT id, referral_type, description, appointment_date, status FROM referrals WHERE patient_id = ?",
        (patient_id,)
    )
    return {"referrals": refs}

