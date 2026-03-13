"""Whisper Speech-to-Text service using OpenAI API."""
import os
import base64
import tempfile
from openai import AsyncOpenAI

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "sk-placeholder"))
    return _client


async def transcribe_audio(audio_base64: str, language: str = None) -> str:
    """Transcribe base64-encoded audio to text using Whisper.
    
    Args:
        audio_base64: Base64-encoded audio data
        language: Optional language hint ('zh' for Mandarin, 'ms' for Malay, 'en' for English)
    """
    try:
        audio_bytes = base64.b64decode(audio_base64)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                kwargs = {"model": "whisper-1", "file": audio_file}
                if language:
                    kwargs["language"] = language
                transcript = await _get_client().audio.transcriptions.create(**kwargs)
            return transcript.text
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        return f"Error transcribing audio: {str(e)}"

