"""SEA-LION API service for multilingual understanding and response localisation."""
import os
import json
import re
import httpx

SEALION_API_URL = os.getenv("SEALION_API_URL", "https://api.sea-lion.ai/v1")
SEALION_API_KEY = os.getenv("SEALION_API_KEY", "")
USE_MOCK = os.getenv("SEALION_MOCK", "true").lower() == "true"


def _mock_detect_language(text: str) -> str:
    """Simple language detection for mock mode."""
    has_chinese = bool(re.search(r'[\u4e00-\u9fff]', text))
    singlish_particles = ['lah', 'leh', 'lor', 'meh', 'sia', 'hor', 'wah', 'aiyo']
    has_singlish = any(p in text.lower() for p in singlish_particles)
    malay_words = ['saya', 'sudah', 'makan', 'ubat', 'awak', 'tidak', 'nak', 'boleh']
    has_malay = any(w in text.lower().split() for w in malay_words)

    if has_chinese and has_singlish:
        return "singlish_mandarin_mix"
    if has_chinese:
        return "mandarin"
    if has_malay:
        return "malay"
    if has_singlish:
        return "singlish"
    return "english"


def _mock_detect_intent(text: str) -> str:
    """Simple intent detection for mock mode."""
    lower = text.lower()
    food_kw = ['ate', 'eat', 'makan', 'lunch', 'dinner', 'breakfast', 'snack', 'kopi',
               'rice', 'noodle', 'bee hoon', 'char kway', 'nasi', '吃', '午餐', '晚餐', '炒粿条']
    med_kw = ['medicine', 'medication', 'metformin', 'glipizide', 'ubat', 'took', 'take', '药', '吃药']
    glucose_kw = ['glucose', 'sugar', 'blood sugar', '血糖', 'gula', 'reading']
    symptom_kw = ['high', 'low', 'dizzy', 'tired', 'pain', 'numb', '高', '低']

    if any(k in lower for k in food_kw):
        return "report_meal"
    if any(k in lower for k in med_kw):
        return "report_medication"
    if any(k in lower for k in glucose_kw):
        if any(k in lower for k in symptom_kw):
            return "report_glucose"
        return "report_glucose"
    if any(k in lower for k in symptom_kw):
        return "report_symptom"
    return "general_chat"


async def understand_input(text: str) -> dict:
    """Understand patient input — detect language, intent, and entities."""
    if USE_MOCK:
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": {},
            "english_text": text,
            "original_text": text,
        }

    # Real SEA-LION API call
    system_prompt = """You are a multilingual language understanding model for a Singapore healthcare app.
Given patient input (which may be in English, Mandarin, Malay, Singlish, or a mix), return JSON:
{
  "detected_language": "mandarin|malay|singlish|english|singlish_mandarin_mix",
  "intent": "report_meal|report_medication|report_glucose|ask_question|report_symptom|general_chat",
  "entities": {"food": "...", "medication": "...", "value": "..."},
  "english_text": "Normalised English translation",
  "original_text": "Original input as-is"
}
Return JSON only."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SEALION_API_URL}/chat/completions",
                headers={"Authorization": f"Bearer {SEALION_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "sea-lion-7b-instruct",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            return json.loads(raw)
    except Exception:
        # Fallback to mock
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": {},
            "english_text": text,
            "original_text": text,
        }


async def localise_response(english_text: str, target_language: str) -> str:
    """Translate Claude's English response to the patient's detected language."""
    if target_language == "english" or USE_MOCK:
        return english_text

    style_guides = {
        "singlish": 'Use Singlish particles (lah, leh, lor). Keep medical terms in English. Casual tone.',
        "mandarin": 'Translate to polite, warm Mandarin Chinese. Use 您 for elderly patients. Keep food and medication names in their original language.',
        "singlish_mandarin_mix": 'Mix English, Mandarin and Singlish naturally like a real Singaporean would speak.',
        "malay": 'Translate to polite Bahasa Melayu. Keep food and medication names in original language.',
    }
    style = style_guides.get(target_language, "Return as-is in English.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SEALION_API_URL}/chat/completions",
                headers={"Authorization": f"Bearer {SEALION_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "sea-lion-7b-instruct",
                    "messages": [
                        {"role": "system", "content": f"Localise this English health advice. {style} Never translate food or medication names."},
                        {"role": "user", "content": english_text},
                    ],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        return english_text

