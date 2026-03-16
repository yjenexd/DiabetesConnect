"""SEA-LION API service for multilingual understanding and response localisation."""
import os
import json
import re
import logging
import httpx

logger = logging.getLogger(__name__)

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
    med_kw = ['medicine', 'medication', 'metformin', 'glipizide', 'ubat', 'took', 'take', '药', '吃药', 'pill', 'tablet']
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


def _mock_extract_entities(text: str) -> dict:
    """Extract food, medication, and glucose entities from text in mock mode."""
    entities = {}
    lower = text.lower()

    # Food extraction
    foods = ['chicken rice', 'char kway teow', 'nasi lemak', 'bee hoon', 'hokkien mee',
             'kopi', 'roti prata', 'nasi goreng', 'laksa', 'mee goreng',
             '炒粿条', '鸡饭', '叻沙', 'char kway', 'kway teow']
    for f in foods:
        if f in lower or f in text:
            entities["food"] = f
            break

    # Medication extraction
    meds = ['metformin', 'glipizide', 'insulin', 'ubat', 'aspirin', 'lisinopril']
    for m in meds:
        if m in lower:
            entities["medication"] = m
            break

    # Glucose value extraction (e.g. "11.2", "血糖是11.2")
    glucose_match = re.search(r'(\d+\.?\d*)\s*(?:mmol|mg)', lower)
    if not glucose_match:
        glucose_match = re.search(r'(?:glucose|sugar|血糖)[^\d]*(\d+\.?\d*)', lower + text)
    if glucose_match:
        entities["value"] = glucose_match.group(1)

    logger.debug("Extracted entities: %s", entities)
    return entities


async def understand_input(text: str) -> dict:
    """Understand patient input — detect language, intent, and entities."""
    if USE_MOCK:
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        entities = _mock_extract_entities(text)
        logger.info("Mock understand_input: lang=%s, intent=%s", lang, intent)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": entities,
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
            result = json.loads(raw)
            logger.info("SEA-LION API understand_input: lang=%s, intent=%s", result.get("detected_language"), result.get("intent"))
            return result
    except Exception as e:
        # Fallback to mock
        logger.warning("SEA-LION API failed, falling back to mock: %s", e)
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        entities = _mock_extract_entities(text)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": entities,
            "english_text": text,
            "original_text": text,
        }


def _mock_localise_response(english_text: str, target_language: str) -> str:
    """Mock localisation - transform English into other Singapore languages without API."""
    if target_language == "english":
        return english_text

    # Simple translation mappings for common healthcare phrases
    translations = {
        "mandarin": {
            "Your blood sugar is": "您的血糖",
            "a bit high": "有点偏高",
            "too high": "太高",
            "a bit low": "有点偏低",
            "carbs": "碳水化合物",
            "Try a short walk": "建议散步",
            "after your meal": "饭后",
            "medication": "药物",
            "Take your": "请服用你的",
        },
        "malay": {
            "Your blood sugar is": "Gula darah awak",
            "a bit high": "agak tinggi",
            "too high": "terlalu tinggi",
            "a bit low": "agak rendah",
            "carbs": "karbohidrat",
            "Try a short walk": "Cuba jalan kaki",
            "after your meal": "selepas makan",
            "medication": "ubat",
        },
        "singlish": {
            "Your": "Your",  # Keep structure, add particles
            "Try": "Try",
        },
    }

    result = english_text

    if target_language == "mandarin":
        # Simple phrase substitution for demo
        for en, cn in translations["mandarin"].items():
            result = result.replace(en, cn)
        logger.debug("Mock Mandarin localisation applied")

    elif target_language == "malay":
        for en, ms in translations["malay"].items():
            result = result.replace(en, ms)
        logger.debug("Mock Malay localisation applied")

    elif target_language == "singlish":
        # Add Singlish particles to sentence endings
        particles = ["lah", "leh", "lor", "meh"]
        sentences = result.split(". ")
        localised = []
        for i, sent in enumerate(sentences):
            if sent.strip() and not sent.strip().endswith(("!", "?", "lah", "leh", "lor")):
                particle = particles[i % len(particles)]
                localised.append(f"{sent.strip()} {particle}")
            else:
                localised.append(sent.strip())
        result = ". ".join(localised)
        logger.debug("Mock Singlish localisation applied")

    elif target_language == "singlish_mandarin_mix":
        # Mix English with some Mandarin and particles
        # Apply some Mandarin first
        for en, cn in translations["mandarin"].items():
            if en.lower() in result.lower():
                result = result.replace(en, f"{cn} ({en})")
        # Add particles
        sentences = result.split(". ")
        localised = []
        for i, sent in enumerate(sentences):
            if sent.strip() and not sent.strip().endswith(("!", "?", "lah", "leh", "lor")):
                particle = ["lah", "leh", "lor"][i % 3]
                localised.append(f"{sent.strip()} {particle}")
            else:
                localised.append(sent.strip())
        result = ". ".join(localised)
        logger.debug("Mock Singlish/Mandarin mix localisation applied")

    return result


async def localise_response(english_text: str, target_language: str) -> str:
    """Translate Claude's English response to the patient's detected language."""
    if target_language == "english":
        return english_text

    if USE_MOCK:
        return _mock_localise_response(english_text, target_language)

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
            result = resp.json()["choices"][0]["message"]["content"]
            logger.info("SEA-LION localised response to %s", target_language)
            return result
    except Exception as e:
        logger.warning("SEA-LION localisation failed, returning English: %s", e)
        return english_text


