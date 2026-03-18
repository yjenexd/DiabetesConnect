"""Patient chat pipeline — processes patient input through understanding, reasoning, tools, monitoring, and localisation."""
import json
import re
from uuid import uuid4

from agents.state import PatientChatState
from agents.prompts import get_agent1_prompt, AGENT3_SYSTEM_PROMPT, TOOL_DEFINITIONS
from agents.tools import execute_tool
from services.claude_service import chat_with_tools, check_anomalies, analyse_meal_photo
from services.sealion_service import understand_input, localise_response
from services.whisper_service import transcribe_audio
from database.db import execute, fetch_all


async def _get_pending_tasks(patient_id: str):
    tasks = []

    pending_history = await fetch_all(
        "SELECT id, request_text, created_at FROM history_requests WHERE patient_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 2",
        (patient_id,),
    )
    for item in pending_history:
        tasks.append({
            "type": "history_request",
            "title": "Respond to your doctor's request",
            "detail": item.get("request_text", "Share your requested history update."),
            "due": None,
        })

    pending_referrals = await fetch_all(
        "SELECT id, referral_type, description, appointment_date, status FROM referrals WHERE patient_id = ? AND status IN ('pending', 'scheduled') ORDER BY appointment_date ASC LIMIT 2",
        (patient_id,),
    )
    for item in pending_referrals:
        when = item.get("appointment_date")
        tasks.append({
            "type": "referral",
            "title": f"{item.get('referral_type', 'Referral')} appointment",
            "detail": item.get("description", "Follow your referral plan."),
            "due": when[:10] if when else None,
        })

    active_goals = await fetch_all(
        "SELECT description FROM lifestyle_goals WHERE patient_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1",
        (patient_id,),
    )
    for item in active_goals:
        tasks.append({
            "type": "goal",
            "title": "Active lifestyle goal",
            "detail": item.get("description", "Keep following your active goal."),
            "due": None,
        })

    return tasks[:3]


def _format_pending_task_update(pending_tasks):
    if not pending_tasks:
        return "\n\nPending tasks: None right now."

    lines = ["\n\nPending tasks for you:"]
    for task in pending_tasks:
        due = f" (due: {task['due']})" if task.get("due") else ""
        lines.append(f"- {task.get('title', 'Task')}{due}: {task.get('detail', '')}")
    return "\n".join(lines)


def _split_detected_items(food_name: str):
    if not food_name:
        return {"foods": [], "drinks": []}

    separators = [",", " and ", " & ", " + ", "/"]
    raw_parts = [food_name]
    for sep in separators:
        next_parts = []
        for part in raw_parts:
            next_parts.extend(part.split(sep))
        raw_parts = next_parts

    items = [part.strip() for part in raw_parts if part.strip()]
    if not items:
        items = [food_name.strip()]

    drink_keywords = {
        "tea", "teh", "coffee", "kopi", "milk", "juice", "water", "milo",
        "latte", "soda", "cola", "drink", "smoothie", "bubble",
    }

    foods = []
    drinks = []
    for item in items:
        lower_item = item.lower()
        if any(keyword in lower_item for keyword in drink_keywords):
            drinks.append(item)
        else:
            foods.append(item)

    if not foods and not drinks:
        foods = [food_name.strip()]

    return {"foods": foods, "drinks": drinks}


def _format_photo_detection_declaration(items):
    foods = items.get("foods", [])
    drinks = items.get("drinks", [])

    lines = ["I analysed your photo."]
    if foods:
        lines.append(f"Food items seen: {', '.join(foods)}.")
    if drinks:
        lines.append(f"Drink items seen: {', '.join(drinks)}.")
    if not foods and not drinks:
        lines.append("I can see at least one meal item.")
    lines.append("I added a meal card below so you can choose to log it.")
    return " ".join(lines)


def _normalise_meal_label(label: str) -> str:
    if not label:
        return ""
    normalised = label.lower().strip()
    normalised = re.sub(r"\([^)]*\)", "", normalised)
    normalised = re.sub(r"[^a-z0-9\s]", " ", normalised)
    normalised = re.sub(r"\s+", " ", normalised).strip()
    return normalised


def _meal_information_score(meal: dict) -> int:
    return sum(
        1
        for key in ("calories_estimate", "carbs_grams", "protein_grams", "fat_grams")
        if (meal.get(key) or 0) > 0
    )


def _dedupe_pending_meals(meals: list) -> list:
    best_by_name = {}
    for meal in meals:
        key = _normalise_meal_label(meal.get("food_name", ""))
        if not key:
            continue
        current_best = best_by_name.get(key)
        if current_best is None:
            best_by_name[key] = meal
            continue
        if _meal_information_score(meal) > _meal_information_score(current_best):
            best_by_name[key] = meal
    return list(best_by_name.values())


async def run_patient_chat(state: PatientChatState) -> PatientChatState:
    """Run the full patient chat pipeline.
    
    Flow: whisper_stt (if voice) → sealion_understand → agent1_reason ↔ execute_tools → agent3_monitor → sealion_localise
    """
    patient_id = state["patient_id"]
    photo_pending_meal = None
    photo_declaration = None

    # ── Step 1: Whisper STT (if voice) ──
    if state.get("input_type") == "voice" and state.get("audio_base64"):
        try:
            transcribed = await transcribe_audio(state["audio_base64"])
            state["transcribed_text"] = transcribed
            state["raw_input"] = transcribed
        except Exception as e:
            state["error"] = f"Transcription failed: {e}"
            state["transcribed_text"] = state.get("raw_input", "")
    else:
        state["transcribed_text"] = state.get("raw_input", "")

    text_input = state["transcribed_text"]

    # ── Step 1b: Claude Vision (if photo) ──
    if state.get("input_type") == "photo" and state.get("image_base64"):
        try:
            vision_result = await analyse_meal_photo(state["image_base64"])
            food = vision_result.get("food_name", "Unknown food")
            cal = vision_result.get("calories", 0)
            carbs = vision_result.get("carbs_grams", 0)
            protein = vision_result.get("protein_grams", 0)
            fat = vision_result.get("fat_grams", 0)
            context = vision_result.get("cultural_context", "hawker_food")
            photo_summary = (
                f"Photo analysis: {food} (~{cal} cal, {carbs}g carbs, {protein}g protein, {fat}g fat, "
                f"context: {context}). The user sent a food photo."
            )
            text_input = photo_summary
            state["transcribed_text"] = photo_summary
            detected_items = _split_detected_items(food)
            state["photo_detected_items"] = detected_items
            photo_declaration = _format_photo_detection_declaration(detected_items)
            photo_pending_meal = {
                "pending_confirmation": True,
                "confirmation_type": "meal",
                "patient_id": patient_id,
                "food_name": food,
                "calories_estimate": cal,
                "carbs_grams": carbs,
                "protein_grams": protein,
                "fat_grams": fat,
                "meal_type": "meal",
                "cultural_context": context,
                "source": "photo",
            }
        except Exception:
            pass  # Fall through with original text_input

    # ── Step 2: SEA-LION understand ──
    try:
        intent_result = await understand_input(text_input)
        state["detected_language"] = intent_result.get("detected_language", "english")
        state["structured_intent"] = intent_result
    except Exception:
        state["detected_language"] = "english"
        state["structured_intent"] = {"intent": "general_chat"}

    # ── Step 3: Load chat history ──
    history = await fetch_all(
        "SELECT role, content FROM chat_messages WHERE patient_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT 8",
        (patient_id,)
    )
    messages = [{"role": r["role"] if r["role"] != "patient" else "user", "content": r["content"]} for r in reversed(history)]
    messages.append({"role": "user", "content": text_input})
    state["claude_messages"] = messages

    # ── Step 4: Agent 1 — Reasoning with tools (may loop) ──
    # Get language-aware system prompt so Claude responds in the patient's language
    agent1_prompt = get_agent1_prompt(state.get("detected_language", "english"))
    all_tool_results = []
    max_rounds = 5
    current_messages = list(messages)

    for _ in range(max_rounds):
        result = await chat_with_tools(agent1_prompt, current_messages, TOOL_DEFINITIONS)
        
        if not result["tool_calls"]:
            # No more tools — we have the final response
            state["english_response"] = result["text_response"]
            break

        # Execute each tool call
        state["tool_calls"] = result["tool_calls"]
        round_results = []
        
        # Add assistant message with tool use content
        current_messages.append({"role": "assistant", "content": result["content"]})
        
        for tc in result["tool_calls"]:
            tool_result = await execute_tool(tc["name"], tc["input"], patient_id)
            round_results.append({"tool": tc["name"], "input": tc["input"], "result": tool_result})
            current_messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": json.dumps(tool_result, default=str),
                }]
            })
        
        all_tool_results.extend(round_results)
    else:
        # Fallback if we ran out of rounds
        state["english_response"] = result.get("text_response", "I've noted that for you!")

    state["tool_results"] = all_tool_results

    pending_tasks = await _get_pending_tasks(patient_id)
    state["pending_tasks"] = pending_tasks
    english_response = state.get("english_response", "").strip()
    if photo_declaration:
        english_response = f"{photo_declaration}\n\n{english_response}".strip()
    state["english_response"] = (english_response + _format_pending_task_update(pending_tasks)).strip()

    # ── Collect pending confirmations ──
    pending_meals = []
    pending_medications = []
    for r in all_tool_results:
        result_payload = r.get("result", {})
        if not result_payload.get("pending_confirmation"):
            continue
        if result_payload.get("confirmation_type") == "medication":
            pending_medications.append(result_payload)
        else:
            pending_meals.append(result_payload)

    if photo_pending_meal:
        pending_meals.append(photo_pending_meal)
    state["pending_meals"] = _dedupe_pending_meals(pending_meals)
    state["pending_medications"] = pending_medications

    # ── Step 5: Agent 3 — Proactive monitor ──
    if all_tool_results:
        try:
            alerts = await check_anomalies(patient_id, all_tool_results, AGENT3_SYSTEM_PROMPT)
            state["agent3_alerts"] = alerts
            # Save alerts to DB
            for alert in alerts:
                await execute(
                    "INSERT INTO alerts (id, patient_id, alert_type, severity, title, description) VALUES (?,?,?,?,?,?)",
                    (str(uuid4())[:8], patient_id, alert.get("type", ""), alert.get("severity", "info"),
                     alert.get("title", ""), alert.get("description", ""))
                )
        except Exception:
            state["agent3_alerts"] = []
    else:
        state["agent3_alerts"] = []

    # ── Step 6: SEA-LION localise ──
    try:
        state["localised_response"] = await localise_response(
            state.get("english_response", ""), state.get("detected_language", "english")
        )
    except Exception:
        state["localised_response"] = state.get("english_response", "")

    # ── Save chat messages ──
    await execute(
        "INSERT INTO chat_messages (id, patient_id, role, content, language, timestamp) VALUES (?,?,?,?,?,datetime('now'))",
        (str(uuid4())[:8], patient_id, "patient", text_input, state.get("detected_language", "english"))
    )
    await execute(
        "INSERT INTO chat_messages (id, patient_id, role, content, language, timestamp) VALUES (?,?,?,?,?,datetime('now'))",
        (str(uuid4())[:8], patient_id, "assistant", state.get("english_response", ""), "english")
    )

    return state

