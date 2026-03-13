"""Claude API service for DiabetesConnect — reasoning, tool use, vision, and clinical analysis."""
import os
import json
from anthropic import AsyncAnthropic

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", "sk-placeholder"))
    return _client

MODEL = "claude-sonnet-4-20250514"


async def chat_with_tools(system_prompt: str, messages: list, tools: list = None) -> dict:
    """Chat with Claude using tool definitions."""
    kwargs = {
        "model": MODEL,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools

    response = await _get_client().messages.create(**kwargs)

    tool_calls = []
    text_response = ""
    for block in response.content:
        if block.type == "tool_use":
            tool_calls.append({"name": block.name, "input": block.input, "id": block.id})
        elif block.type == "text":
            text_response += block.text

    return {
        "content": response.content,
        "tool_calls": tool_calls,
        "text_response": text_response,
        "stop_reason": response.stop_reason,
    }


async def generate_clinical_analysis(patient_data: str, system_prompt: str) -> dict:
    """Generate clinical analysis for a doctor using Claude."""
    response = await _get_client().messages.create(
        model=MODEL,
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": f"Analyse this patient data and return JSON:\n\n{patient_data}"}],
    )
    raw = response.content[0].text
    # Strip markdown code fences
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"summary": raw, "key_findings": [], "recommendations": [], "risk_level": "unknown"}


async def check_anomalies(patient_id: str, tool_results: list, system_prompt: str) -> list:
    """Check for health anomalies using Claude as a proactive monitor."""
    response = await _get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": f"Patient {patient_id} just performed these actions. Check for concerns:\n\n{json.dumps(tool_results, default=str)}"}],
    )
    raw = response.content[0].text
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()

    try:
        result = json.loads(cleaned)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        return []


async def draft_patient_recommendation(analysis: str, actions: list, patient_name: str) -> str:
    """Draft a warm, patient-friendly recommendation message."""
    response = await _get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        system="You are drafting a message from a doctor to their diabetic patient. Write in warm, simple English. Keep it under 100 words. Be encouraging and specific.",
        messages=[
            {"role": "user", "content": f"Patient: {patient_name}\n\nClinical analysis:\n{analysis}\n\nActions taken:\n{json.dumps(actions, default=str)}\n\nDraft a warm message to the patient."}
        ],
    )
    return response.content[0].text


async def analyse_meal_photo(image_base64: str) -> dict:
    """Analyse a meal photo using Claude Vision."""
    response = await _get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64},
                    },
                    {
                        "type": "text",
                        "text": 'You are a nutritional analyst specialising in Singaporean and Southeast Asian cuisine. Identify the food in this photo and estimate: food name, calories, carbs (g), protein (g), fat (g). Also identify if it\'s hawker food, home-cooked, or restaurant food. Return JSON only with keys: food_name, calories, carbs_grams, protein_grams, fat_grams, cultural_context (hawker_food|home_cooked|restaurant).'
                    },
                ],
            }
        ],
    )
    raw = response.content[0].text
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"food_name": "Unknown", "calories": 0, "carbs_grams": 0, "protein_grams": 0, "fat_grams": 0, "cultural_context": "unknown"}

