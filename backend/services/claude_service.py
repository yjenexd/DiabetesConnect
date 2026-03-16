"""Claude API service for DiabetesConnect — reasoning, tool use, vision, and clinical analysis."""
import os
import json
import logging
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", "sk-placeholder"))
    return _client


MODEL = "claude-sonnet-4-20250514"


def _strip_code_fences(text: str) -> str:
    """Strip markdown code fences from Claude's response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


async def chat_with_tools(system_prompt: str, messages: list, tools: list = None) -> dict:
    """Chat with Claude using tool definitions.

    Returns dict with content, tool_calls, text_response, and stop_reason.
    """
    kwargs = {
        "model": MODEL,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools

    try:
        response = await _get_client().messages.create(**kwargs)
    except Exception as e:
        logger.error("Claude chat_with_tools failed: %s", e)
        return {
            "content": [],
            "tool_calls": [],
            "text_response": f"I'm having trouble connecting right now. Please try again shortly.",
            "stop_reason": "error",
        }

    tool_calls = []
    text_response = ""
    for block in response.content:
        if block.type == "tool_use":
            tool_calls.append({"name": block.name, "input": block.input, "id": block.id})
        elif block.type == "text":
            text_response += block.text

    logger.info("Claude responded: %d tool_calls, stop=%s", len(tool_calls), response.stop_reason)
    return {
        "content": response.content,
        "tool_calls": tool_calls,
        "text_response": text_response,
        "stop_reason": response.stop_reason,
    }


async def generate_clinical_analysis(patient_data: str, system_prompt: str) -> dict:
    """Generate clinical analysis for a doctor using Claude."""
    try:
        response = await _get_client().messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Analyse this patient data and return JSON:\n\n{patient_data}"}],
        )
        raw = response.content[0].text
        cleaned = _strip_code_fences(raw)
        try:
            result = json.loads(cleaned)
            logger.info("Clinical analysis generated: risk_level=%s", result.get("risk_level"))
            return result
        except json.JSONDecodeError:
            logger.warning("Could not parse clinical analysis JSON, returning raw text")
            return {"summary": raw, "key_findings": [], "recommendations": [], "risk_level": "unknown"}
    except Exception as e:
        logger.error("generate_clinical_analysis failed: %s", e)
        return {"summary": f"Analysis unavailable: {e}", "key_findings": [], "recommendations": [], "risk_level": "unknown"}


async def check_anomalies(patient_id: str, tool_results: list, system_prompt: str) -> list:
    """Check for health anomalies using Claude as a proactive monitor."""
    try:
        response = await _get_client().messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Patient {patient_id} just performed these actions. Check for concerns:\n\n{json.dumps(tool_results, default=str)}"}],
        )
        raw = response.content[0].text
        cleaned = _strip_code_fences(raw)
        try:
            result = json.loads(cleaned)
            alerts = result if isinstance(result, list) else []
            if alerts:
                logger.info("Anomaly check for patient %s: %d alerts", patient_id, len(alerts))
            return alerts
        except json.JSONDecodeError:
            logger.warning("Could not parse anomaly check JSON for patient %s", patient_id)
            return []
    except Exception as e:
        logger.error("check_anomalies failed for patient %s: %s", patient_id, e)
        return []


async def draft_patient_recommendation(analysis: str, actions: list, patient_name: str) -> str:
    """Draft a warm, patient-friendly recommendation message."""
    try:
        response = await _get_client().messages.create(
            model=MODEL,
            max_tokens=512,
            system="You are drafting a message from a doctor to their diabetic patient. Write in warm, simple English. Keep it under 100 words. Be encouraging and specific.",
            messages=[
                {"role": "user", "content": f"Patient: {patient_name}\n\nClinical analysis:\n{analysis}\n\nActions taken:\n{json.dumps(actions, default=str)}\n\nDraft a warm message to the patient."}
            ],
        )
        logger.info("Drafted recommendation for patient %s", patient_name)
        return response.content[0].text
    except Exception as e:
        logger.error("draft_patient_recommendation failed for %s: %s", patient_name, e)
        return f"Dear {patient_name}, please continue following your care plan and reach out if you have any concerns. Your doctor is here to support you."


async def analyse_meal_photo(image_base64: str, *, media_type: str = "image/jpeg") -> dict:
    """Analyse a meal photo using Claude Vision."""
    system_prompt = (
        "You are a nutritional analyst specialising in Singaporean and Southeast Asian cuisine. "
        "Identify the food in this photo and estimate: food name, calories, carbs (g), protein (g), fat (g). "
        "Also identify if it's hawker food, home-cooked, or restaurant food. "
        "Return JSON only with keys: food_name, calories, carbs_grams, protein_grams, fat_grams, "
        "cultural_context (hawker_food|home_cooked|restaurant)."
    )
    try:
        response = await _get_client().messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": image_base64},
                        },
                        {
                            "type": "text",
                            "text": "Identify this food and provide nutritional estimates as JSON.",
                        },
                    ],
                }
            ],
        )
        raw = response.content[0].text
        cleaned = _strip_code_fences(raw)
        result = json.loads(cleaned)
        logger.info("Meal photo analysed: %s (%d cal)", result.get("food_name"), result.get("calories", 0))
        return result
    except json.JSONDecodeError:
        logger.warning("Could not parse meal photo analysis JSON")
        return {"food_name": "Unknown", "calories": 0, "carbs_grams": 0, "protein_grams": 0, "fat_grams": 0, "cultural_context": "unknown"}
    except Exception as e:
        logger.error("analyse_meal_photo failed: %s", e)
        return {"food_name": "Unknown", "calories": 0, "carbs_grams": 0, "protein_grams": 0, "fat_grams": 0, "cultural_context": "unknown"}
