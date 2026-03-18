"""Tool definitions and execution functions for the patient chatbot."""
from datetime import datetime
from uuid import uuid4
from database.db import execute, fetch_all, fetch_one


def uid():
    return str(uuid4())[:8]


async def log_meal(patient_id: str, food_name: str, calories_estimate: int, carbs_grams: float,
                   meal_type: str, cultural_context: str = "hawker_food", **_) -> dict:
    """Stage a meal for user confirmation instead of auto-logging."""
    return {
        "pending_confirmation": True,
        "confirmation_type": "meal",
        "patient_id": patient_id,
        "food_name": food_name,
        "calories_estimate": calories_estimate,
        "carbs_grams": carbs_grams,
        "meal_type": meal_type,
        "cultural_context": cultural_context,
    }


async def confirm_log_meal(patient_id: str, food_name: str, calories_estimate: int,
                           carbs_grams: float, meal_type: str,
                           cultural_context: str = "hawker_food", protein_grams: float = 0.0,
                           fat_grams: float = 0.0, sodium_mg: float = 0.0,
                           sugar_grams: float = 0.0, **_) -> dict:
    """Actually insert the meal into the database after user confirmation."""
    meal_id = uid()
    await execute(
        "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, sodium_mg, sugar_grams, meal_time, meal_type, cultural_context, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (meal_id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams,
         sodium_mg, sugar_grams, datetime.now().isoformat(), meal_type, cultural_context, "chatbot")
    )
    return {"success": True, "meal_id": meal_id, "food_name": food_name}


async def log_medication(patient_id: str, medication_name: str, action: str, reason: str = None, **_) -> dict:
    meds = await fetch_all(
        "SELECT name, frequency FROM medications WHERE patient_id = ? AND active = 1",
        (patient_id,),
    )

    selected_name = medication_name
    selected_frequency = None
    lowered_target = (medication_name or "").strip().lower()
    if meds:
        exact = next((m for m in meds if (m.get("name") or "").strip().lower() == lowered_target), None)
        partial = next((m for m in meds if lowered_target and lowered_target in (m.get("name") or "").lower()), None)
        fallback = meds[0] if len(meds) == 1 else None
        chosen = exact or partial or fallback
        if chosen:
            selected_name = chosen.get("name") or medication_name
            selected_frequency = chosen.get("frequency")

    return {
        "pending_confirmation": True,
        "confirmation_type": "medication",
        "patient_id": patient_id,
        "medication_name": selected_name,
        "action": action,
        "reason_if_skipped": reason,
        "frequency": selected_frequency,
    }


async def log_glucose(patient_id: str, value_mmol: float, context: str = "fasting", **_) -> dict:
    reading_id = uid()
    await execute(
        "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context, logged_via) VALUES (?,?,?,?,?,?)",
        (reading_id, patient_id, value_mmol, datetime.now().isoformat(), context, "chatbot")
    )
    return {"success": True, "reading_id": reading_id, "value_mmol": value_mmol}


async def get_glucose_readings(patient_id: str, days: int = 7, **_) -> dict:
    rows = await fetch_all(
        "SELECT value_mmol, measurement_time, context FROM glucose_readings WHERE patient_id = ? ORDER BY measurement_time DESC LIMIT ?",
        (patient_id, days * 3)
    )
    return {"readings": rows}


async def get_medication_schedule(patient_id: str, **_) -> dict:
    meds = await fetch_all(
        "SELECT name, dosage, frequency FROM medications WHERE patient_id = ? AND active = 1", (patient_id,)
    )
    recent_logs = await fetch_all(
        "SELECT medication_name, action, actual_time FROM med_logs WHERE patient_id = ? ORDER BY actual_time DESC LIMIT 14",
        (patient_id,)
    )
    return {"medications": meds, "recent_logs": recent_logs}


async def get_lifestyle_goals(patient_id: str, **_) -> dict:
    goals = await fetch_all(
        "SELECT goal_type, target_value, target_unit, description, compliance_rate FROM lifestyle_goals WHERE patient_id = ? AND active = 1",
        (patient_id,)
    )
    return {"goals": goals}


async def get_active_referrals(patient_id: str, **_) -> dict:
    refs = await fetch_all(
        "SELECT referral_type, description, appointment_date, status FROM referrals WHERE patient_id = ? AND status = 'pending'",
        (patient_id,)
    )
    return {"referrals": refs}


async def analyse_meal_photo(patient_id: str, description: str, meal_context: str = "hawker_food", **_) -> dict:
    """Stage a photo-detected meal for user confirmation instead of auto-logging."""
    return {
        "pending_confirmation": True,
        "confirmation_type": "meal",
        "patient_id": patient_id,
        "food_name": description,
        "calories_estimate": 0,
        "carbs_grams": 0.0,
        "protein_grams": 0.0,
        "fat_grams": 0.0,
        "meal_type": "meal",
        "cultural_context": meal_context,
        "source": "photo",
    }


# ── Dispatcher ──
TOOL_MAP = {
    "log_meal": log_meal,
    "log_medication": log_medication,
    "log_glucose": log_glucose,
    "get_glucose_readings": get_glucose_readings,
    "get_medication_schedule": get_medication_schedule,
    "get_lifestyle_goals": get_lifestyle_goals,
    "get_active_referrals": get_active_referrals,
    "analyse_meal_photo": analyse_meal_photo,
}


async def execute_tool(tool_name: str, tool_input: dict, patient_id: str) -> dict:
    """Dispatch a tool call and return the result."""
    fn = TOOL_MAP.get(tool_name)
    if fn is None:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return await fn(patient_id=patient_id, **tool_input)
    except Exception as e:
        return {"error": str(e)}

