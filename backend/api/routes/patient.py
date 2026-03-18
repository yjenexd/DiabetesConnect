"""Patient dashboard and manual logging endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from datetime import datetime, timedelta
from collections import defaultdict
import math
import re

from database.db import fetch_all, fetch_one, execute

router = APIRouter()

# Simple in-memory cache for nutrition lookups
_nutrition_cache: dict = {}


@router.get("/patients")
async def list_all_patients():
    """List all available patient profiles."""
    patients = await fetch_all(
        "SELECT id, name, age, gender, diabetes_type, diagnosis_year, language_preference FROM patients ORDER BY name",
        ()
    )
    return {"patients": patients}


def uid():
    return str(uuid4())[:8]

async def fetch_patient_dashboard(patient_id: str, *, include_hidden_recommendations: bool = False):
    """Fetch dashboard payload.

    Patient view should not include hidden recommendations (draft/preview).
    Doctor preview may request them via `include_hidden_recommendations=True`.
    """
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
        "SELECT id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, sodium_mg, sugar_grams, meal_time, meal_type, cultural_context, logged_via FROM meals WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 30",
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

    if include_hidden_recommendations:
        recommendations = await fetch_all(
            "SELECT id, content, recommendation_type, status, created_at FROM recommendations WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10",
            (patient_id,)
        )
    else:
        recommendations = await fetch_all(
            "SELECT id, content, recommendation_type, status, created_at FROM recommendations WHERE patient_id = ? AND status IN ('sent','acknowledged') ORDER BY created_at DESC LIMIT 5",
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
    return ["08:00"]


def _infer_nearest_scheduled_time(frequency: str, now: datetime) -> str:
    dose_times = _parse_dose_times(frequency or "1x daily")
    candidates = []
    for time_24h in dose_times:
        hour, minute = [int(part) for part in time_24h.split(":")]
        candidates.append(now.replace(hour=hour, minute=minute, second=0, microsecond=0))

    nearest = min(candidates, key=lambda dt: abs((dt - now).total_seconds())) if candidates else now
    return nearest.isoformat()


async def _resolve_active_medication(patient_id: str, medication_name: str):
    meds = await fetch_all(
        "SELECT id, name, frequency FROM medications WHERE patient_id = ? AND active = 1",
        (patient_id,),
    )
    if not meds:
        return None

    target = (medication_name or "").strip().lower()
    exact = next((m for m in meds if (m.get("name") or "").strip().lower() == target), None)
    if exact:
        return exact

    partial = next(
        (
            m
            for m in meds
            if target and (target in (m.get("name") or "").lower() or (m.get("name") or "").lower() in target)
        ),
        None,
    )
    if partial:
        return partial

    if len(meds) == 1:
        return meds[0]

    return None


@router.get("/patients/{patient_id}/dashboard")
async def get_patient_dashboard(patient_id: str):
    """Get full patient dashboard data."""
    return await fetch_patient_dashboard(patient_id, include_hidden_recommendations=False)


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
                "sodium_mg (integer), sugar_grams (number), "
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
                    status = matched_log["action"]
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
    sodium_mg: Optional[float] = None
    sugar_grams: Optional[float] = None
    meal_type: str = "snack"


@router.post("/patients/{patient_id}/meals")
async def log_meal_manual(patient_id: str, meal: MealLog):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    meal_id = uid()
    await execute(
        "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, sodium_mg, sugar_grams, meal_time, meal_type, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (meal_id, patient_id, meal.food_name, meal.calories_estimate, meal.carbs_grams,
         meal.protein_grams, meal.fat_grams, meal.sodium_mg, meal.sugar_grams,
         datetime.now().isoformat(), meal.meal_type, "manual")
    )
    return {"success": True, "meal_id": meal_id}


@router.get("/patients/{patient_id}/meals")
async def get_meals(patient_id: str, period: str = "all"):
    """Get all meals for a patient, optionally filtered by period: week, month, year, all."""
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    from datetime import date, timedelta
    cutoff = None
    today = date.today()
    if period == "week":
        cutoff = (today - timedelta(days=7)).isoformat()
    elif period == "month":
        cutoff = (today - timedelta(days=30)).isoformat()
    elif period == "year":
        cutoff = (today - timedelta(days=365)).isoformat()
    if cutoff:
        meals = await fetch_all(
            "SELECT id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, sodium_mg, sugar_grams, meal_time, meal_type, cultural_context, logged_via FROM meals WHERE patient_id = ? AND meal_time >= ? ORDER BY meal_time DESC",
            (patient_id, cutoff)
        )
    else:
        meals = await fetch_all(
            "SELECT id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, sodium_mg, sugar_grams, meal_time, meal_type, cultural_context, logged_via FROM meals WHERE patient_id = ? ORDER BY meal_time DESC",
            (patient_id,)
        )
    return {"meals": meals}


@router.put("/patients/{patient_id}/meals/{meal_id}")
async def update_meal(patient_id: str, meal_id: str, meal: MealLog):
    row = await fetch_one("SELECT id FROM meals WHERE id = ? AND patient_id = ?", (meal_id, patient_id))
    if not row:
        raise HTTPException(status_code=404, detail="Meal not found")
    await execute(
        "UPDATE meals SET food_name=?, calories_estimate=?, carbs_grams=?, protein_grams=?, fat_grams=?, sodium_mg=?, sugar_grams=?, meal_type=? WHERE id=? AND patient_id=?",
        (meal.food_name, meal.calories_estimate, meal.carbs_grams, meal.protein_grams,
         meal.fat_grams, meal.sodium_mg, meal.sugar_grams, meal.meal_type, meal_id, patient_id)
    )
    return {"success": True}


@router.delete("/patients/{patient_id}/meals/{meal_id}")
async def delete_meal(patient_id: str, meal_id: str):
    row = await fetch_one("SELECT id FROM meals WHERE id = ? AND patient_id = ?", (meal_id, patient_id))
    if not row:
        raise HTTPException(status_code=404, detail="Meal not found")
    await execute("DELETE FROM meals WHERE id = ? AND patient_id = ?", (meal_id, patient_id))
    return {"success": True}


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
    reason: Optional[str] = None
    scheduled_time: Optional[str] = None


@router.post("/patients/{patient_id}/medications/log")
async def log_medication_manual(patient_id: str, log: MedLog):
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    valid_actions = {"taken", "skipped", "delayed"}
    if log.action not in valid_actions:
        raise HTTPException(status_code=400, detail="Invalid medication action")

    now = datetime.now()
    resolved_med = await _resolve_active_medication(patient_id, log.medication_name)
    medication_id = resolved_med.get("id") if resolved_med else None
    medication_name = resolved_med.get("name") if resolved_med else log.medication_name
    frequency = resolved_med.get("frequency") if resolved_med else "1x daily"

    scheduled_time = log.scheduled_time
    if not scheduled_time:
        scheduled_time = _infer_nearest_scheduled_time(frequency, now)

    actual_time = now.isoformat() if log.action in {"taken", "delayed"} else None

    log_id = uid()
    await execute(
        "INSERT INTO med_logs (id, patient_id, medication_id, medication_name, action, scheduled_time, actual_time, reason_if_skipped, logged_via) VALUES (?,?,?,?,?,?,?,?,?)",
        (
            log_id,
            patient_id,
            medication_id,
            medication_name,
            log.action,
            scheduled_time,
            actual_time,
            log.reason,
            "manual",
        )
    )
    return {
        "success": True,
        "log_id": log_id,
        "medication_name": medication_name,
        "scheduled_time": scheduled_time,
        "action": log.action,
    }


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


def _postprandial_curve(minutes_since_meal: float, peak_minutes: float = 60.0) -> float:
    """Return 0-1 value modelling the postprandial glucose response shape.

    Uses a gamma-like curve: f(t) = (t/peak) * e^(1 - t/peak).
    Peaks at t = peak_minutes, decays afterwards.
    """
    if minutes_since_meal < 0:
        return 0.0
    t = minutes_since_meal / peak_minutes
    return max(0.0, t * math.exp(1 - t))


@router.get("/patients/{patient_id}/glucose-profile")
async def get_glucose_profile(patient_id: str):
    """Compute the patient's glucose response profile learned from historical data.

    Returns baseline fasting level, carbohydrate response factor,
    hourly averages, and a synthesised daily pattern curve.
    """
    patient = await fetch_one("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch historical data (up to 90 readings / meals)
    readings = await fetch_all(
        "SELECT value_mmol, measurement_time, context FROM glucose_readings "
        "WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT 90",
        (patient_id,),
    )
    meals = await fetch_all(
        "SELECT food_name, carbs_grams, meal_time, meal_type FROM meals "
        "WHERE patient_id = ? ORDER BY meal_time DESC LIMIT 90",
        (patient_id,),
    )

    now = datetime.now()
    today_iso = now.strftime("%Y-%m-%d")

    # ── 1. Baseline fasting glucose (excl. today) ──
    fasting_readings = [
        r for r in readings
        if r.get("context") == "fasting" and r["measurement_time"][:10] != today_iso
    ]
    baseline_fasting = (
        round(sum(r["value_mmol"] for r in fasting_readings) / len(fasting_readings), 1)
        if fasting_readings
        else 5.5
    )

    # ── 2. Carb response factor (mmol/L rise per 10 g carbs) ──
    #   Match each historical meal with the closest pre-meal and post-meal glucose readings.
    carb_response_factor = 0.5  # default
    pair_factors: list[float] = []

    historical_meals = [m for m in meals if m["meal_time"][:10] != today_iso and (m.get("carbs_grams") or 0) > 0]
    historical_readings = [r for r in readings if r["measurement_time"][:10] != today_iso]

    for meal in historical_meals:
        meal_dt = datetime.fromisoformat(meal["meal_time"][:19])
        carbs = meal["carbs_grams"]

        pre_candidates = []
        post_candidates = []
        for r in historical_readings:
            r_dt = datetime.fromisoformat(r["measurement_time"][:19])
            diff_min = (r_dt - meal_dt).total_seconds() / 60
            if -180 <= diff_min <= 0:
                pre_candidates.append((r, abs(diff_min)))
            elif 30 <= diff_min <= 180:
                post_candidates.append((r, diff_min))

        if pre_candidates and post_candidates:
            pre = min(pre_candidates, key=lambda x: x[1])[0]
            post = min(post_candidates, key=lambda x: abs(x[1] - 90))[0]  # closest to 90 min
            rise = post["value_mmol"] - pre["value_mmol"]
            if rise > 0 and carbs > 0:
                pair_factors.append(rise / (carbs / 10))

    if pair_factors:
        carb_response_factor = round(sum(pair_factors) / len(pair_factors), 2)

    # ── 3. Hourly averages from historical readings ──
    hourly_buckets: dict[int, list[float]] = defaultdict(list)
    for r in historical_readings:
        hour = datetime.fromisoformat(r["measurement_time"][:19]).hour
        hourly_buckets[hour].append(r["value_mmol"])

    hourly_averages = {
        str(h): round(sum(vals) / len(vals), 1) for h, vals in hourly_buckets.items()
    }

    # ── 4. Synthesised daily pattern (24 half-hour points, 6 AM – midnight) ──
    #   Uses historical average meal times + carb amounts + the learned carb_response_factor
    #   to project a smooth "typical day" glucose curve for this patient.

    # Determine typical meal hours and average carbs from historical data
    meal_hour_carbs: dict[int, list[float]] = defaultdict(list)
    for m in historical_meals:
        hour = datetime.fromisoformat(m["meal_time"][:19]).hour
        meal_hour_carbs[hour].append(m.get("carbs_grams") or 30)

    typical_meals = {
        h: round(sum(carbs_list) / len(carbs_list), 1) for h, carbs_list in meal_hour_carbs.items()
    }

    peak_minutes = 60.0
    daily_pattern: list[dict] = []
    for half_hour_idx in range(36):  # 6:00 to 23:30
        total_minutes = 360 + half_hour_idx * 30
        hour = total_minutes // 60
        minute = total_minutes % 60
        time_label = f"{hour:02d}:{minute:02d}"

        value = baseline_fasting
        for meal_hour, avg_carbs in typical_meals.items():
            t = total_minutes - (meal_hour * 60)  # minutes since typical meal
            if 0 <= t <= 240:
                max_rise = carb_response_factor * avg_carbs / 10.0
                value += max_rise * _postprandial_curve(t, peak_minutes)

        daily_pattern.append({"time": time_label, "value": round(value, 1)})

    # ── 5. Average post-meal rise (supplementary stat) ──
    post_meal_readings = [r for r in historical_readings if r.get("context") == "post_meal"]
    avg_post_meal_rise = None
    if post_meal_readings and baseline_fasting:
        avg_post = sum(r["value_mmol"] for r in post_meal_readings) / len(post_meal_readings)
        avg_post_meal_rise = round(avg_post - baseline_fasting, 1)

    data_days = len(set(r["measurement_time"][:10] for r in historical_readings))

    return {
        "baseline_fasting": baseline_fasting,
        "carb_response_factor": carb_response_factor,
        "avg_post_meal_rise": avg_post_meal_rise,
        "peak_time_minutes": peak_minutes,
        "hourly_averages": hourly_averages,
        "daily_pattern": daily_pattern,
        "data_days": data_days,
    }
