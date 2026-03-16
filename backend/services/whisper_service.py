"""Whisper Speech-to-Text service using OpenAI API with mock fallback."""
import os
import base64
import logging
import tempfile
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

USE_MOCK = os.getenv("WHISPER_MOCK", "false").lower() == "true"

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "sk-placeholder"))
    return _client


# Context prompt that primes Whisper for Singapore multilingual diabetes conversations.
# - Uses Simplified Chinese so Whisper biases toward 简体 output (standard in SG)
# - Lists common Singaporean food names, medications, and diabetes terms
# - Reduces hallucination on code-switched speech (English + Mandarin + Malay mix)
WHISPER_INITIAL_PROMPT = (
    "这是一段关于糖尿病健康管理的对话。"  # Simplified Chinese anchor
    "Patient is discussing diabetes care in Singapore. "
    "Common foods: char kway teow, 炒粿条, nasi lemak, chicken rice, 鸡饭, "
    "laksa, roti prata, mee goreng, ban mian, 板面, bak chor mee, 肉脞面, "
    "kaya toast, 咖椰吐司, nasi padang, mee siam, wanton mee, "
    "teh tarik, kopi, barley water, 薏米水. "
    "Medications: Metformin, 二甲双胍, Glipizide, Sitagliptin, Empagliflozin, "
    "insulin, 胰岛素, Amlodipine, Atorvastatin, Losartan. "
    "Medical terms: blood sugar, 血糖, glucose, mmol, HbA1c, 糖化血红蛋白, "
    "blood pressure, 血压, cholesterol, 胆固醇, hypoglycemia, 低血糖. "
    "Singlish particles: lah, leh, lor, sia, hor, meh. "
    "Malay terms: ubat, gula darah, makan, sakit, pening, tekanan darah."
)


async def transcribe_audio(audio_base64: str, language: str = None) -> str:
    """Transcribe base64-encoded audio to text using Whisper.
    
    Optimised for Singapore multilingual speech (English, Mandarin, Malay, Singlish, code-switching).
    
    Strategy:
    - For mixed/unknown language: omit the language param and let Whisper auto-detect.
      This handles code-switching (e.g. "I ate 炒粿条 for dinner lah") much better.
    - For explicit single-language hints: pass the language param for higher accuracy.
    - Always use initial_prompt with Singapore-specific terms to reduce hallucination.
    - initial_prompt uses Simplified Chinese to bias Whisper toward 简体字 output.
    
    Args:
        audio_base64: Base64-encoded audio data
        language: Optional language hint ('zh' for Mandarin, 'ms' for Malay, 'en' for English).
                  If None, Whisper auto-detects — best for mixed-language input.
    
    Returns:
        Transcribed text string
    """
    if USE_MOCK:
        logger.info("Whisper mock mode — returning demo transcription")
        return _mock_transcribe(language)

    try:
        audio_bytes = base64.b64decode(audio_base64)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                kwargs = {
                    "model": "whisper-1",
                    "file": audio_file,
                    "prompt": WHISPER_INITIAL_PROMPT,
                }
                # Only pass language hint for single-language modes.
                # For mixed/code-switched speech, let Whisper auto-detect.
                if language and language not in ("auto", "mixed"):
                    kwargs["language"] = language
                    logger.info(f"Whisper: using language hint '{language}'")
                else:
                    logger.info("Whisper: auto-detecting language (best for code-switching)")

                transcript = await _get_client().audio.transcriptions.create(**kwargs)
            logger.info(f"Whisper transcribed: {transcript.text[:80]}...")
            return transcript.text
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        logger.warning(f"Whisper API failed ({type(e).__name__}), falling back to mock: {e}")
        return _mock_transcribe(language)


def _mock_transcribe(language: str = None) -> str:
    """Return a realistic demo transcription based on language hint.
    
    Used when Whisper API is unavailable or WHISPER_MOCK=true.
    Cycles through demo phrases for variety.
    """
    _mock_transcribe.counter = getattr(_mock_transcribe, "counter", -1) + 1
    idx = _mock_transcribe.counter

    phrases = {
        "zh": [
            "我今天午餐吃了炒粿条",
            "今天的血糖是11.2",
            "我已经吃了二甲双胍",
            "我今天头有点晕",
            "我早餐吃了半熟蛋和咖椰吐司",
        ],
        "ms": [
            "Saya sudah makan ubat metformin",
            "Gula darah saya tinggi hari ini",
            "Saya makan nasi lemak untuk sarapan",
            "Saya rasa pening hari ini",
            "Saya sudah ambil insulin",
        ],
        "en": [
            "I ate chicken rice for lunch today",
            "My blood sugar reading is 8.5 this morning",
            "I took my metformin already",
            "I feel a bit dizzy today",
            "I had kaya toast and half boiled eggs for breakfast",
        ],
    }

    # Singlish / mixed phrases as default
    default_phrases = [
        "Wah today I ate char kway teow for lunch lah",
        "My blood sugar 很高 today sia",
        "I already took my medicine this morning",
        "Today I feel damn tired and dizzy",
        "I ate nasi lemak with extra sambal for breakfast",
    ]

    pool = phrases.get(language, default_phrases)
    return pool[idx % len(pool)]

