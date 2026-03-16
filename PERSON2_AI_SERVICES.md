# Person 2 — AI Integrations

## Your Scope
You own `/backend/services/`. You build the API wrappers for Claude, SEA-LION, and Whisper. You also own prompt engineering and the language routing pipeline.

## Files You Own
- `backend/services/claude_service.py` — Claude API wrapper (reasoning, tool use, vision)
- `backend/services/sealion_service.py` — SEA-LION API wrapper (language understanding + localisation)
- `backend/services/whisper_service.py` — Whisper STT wrapper (voice → text)

## Files You Collaborate On
- `backend/agents/prompts.py` — You fine-tune the prompts Person 1 writes

---

## Day 1: Claude Code Prompts

### Prompt 1 — Claude Service

```
Create a Claude API service for a diabetes health chatbot using the Anthropic Python SDK (anthropic package, AsyncAnthropic client).

Functions needed:

1. chat_with_tools(system_prompt, messages, tools) -> dict
   - Uses claude-sonnet-4-20250514 model
   - Sends messages with tool definitions in Anthropic's tool_use format
   - Returns: {"content": [...], "tool_calls": [{"name", "input", "id"}], "text_response": "...", "stop_reason": "..."}
   - Parse response.content blocks — type=="tool_use" goes to tool_calls, type=="text" goes to text_response
   
2. generate_clinical_analysis(patient_data: str, system_prompt: str) -> dict
   - Sends patient data JSON to Claude with Agent 2 system prompt
   - Expects JSON response with summary, key_findings, recommendations, risk_level
   - Strip markdown code fences before parsing
   - Fallback: if JSON parse fails, return {"summary": raw_text, "recommendations": []}

3. check_anomalies(patient_id: str, tool_results: list, system_prompt: str) -> list
   - Sends tool results to Claude with Agent 3 system prompt
   - Expects JSON array of alerts
   - Return empty list if no concerns or parse fails

4. draft_patient_recommendation(analysis: str, actions: list, patient_name: str) -> str
   - Drafts a warm, simple patient-friendly message (under 100 words)
   - System prompt: "You are drafting a message from a doctor to their diabetic patient. Write in warm, simple English."

Use os.getenv("ANTHROPIC_API_KEY") for the key. All functions should be async.
```

### Prompt 2 — SEA-LION Service

```
Create a SEA-LION API service for multilingual understanding and response localisation. SEA-LION is accessed via the AI Singapore hosted API.

Functions needed:

1. understand_input(text: str) -> dict
   - Sends patient's raw input (any language: Mandarin, Malay, Singlish, English, or mixed) to SEA-LION
   - Prompt SEA-LION to: detect language, handle code-switching, extract structured intent
   - System prompt should instruct SEA-LION to return JSON:
     {
       "detected_language": "mandarin|malay|singlish|english|singlish_mandarin_mix|...",
       "intent": "report_meal|report_medication|report_glucose|ask_question|report_symptom|general_chat",
       "entities": {"food": "...", "medication": "...", "value": "..."},
       "english_text": "Normalised English translation",
       "original_text": "Original input as-is"
     }
   - Use httpx for async HTTP calls to SEALION_API_URL
   
   IMPORTANT: Include a MOCK fallback that works without the API:
   - Simple language detection: check for Chinese characters, Singlish particles (lah, leh, lor), Malay words
   - Simple intent detection: check for food/medicine/glucose keywords
   - This lets Person 1 test the graph without waiting for your real API integration

2. localise_response(english_text: str, target_language: str) -> str
   - Takes Claude's English response and translates to patient's detected language
   - Prompt SEA-LION to match the language style:
     - "mandarin" → formal Mandarin Chinese
     - "singlish" → casual Singlish English  
     - "singlish_mandarin_mix" → natural mix like a real Singaporean would speak
     - "malay" → Bahasa Melayu
     - "english" → return as-is
   
   IMPORTANT: Include a MOCK fallback that returns English as-is.

Use environment variables: SEALION_API_URL, SEALION_API_KEY
Use httpx.AsyncClient for HTTP calls.
Set USE_MOCK = os.getenv("SEALION_MOCK", "true").lower() == "true" for easy toggling.
```

### Prompt 3 — Whisper Service

```
Create a Whisper Speech-to-Text service using the OpenAI Python SDK.

Function: transcribe_audio(audio_base64: str, language: str = None) -> str

Steps:
1. Decode base64 string to bytes
2. Write to a temp file with .webm extension
3. Call openai.audio.transcriptions.create() with model="whisper-1"
4. Optionally pass language hint ("zh" for Mandarin, "ms" for Malay, "en" for English)
5. Clean up temp file
6. Return transcribed text

Use AsyncOpenAI client. Use os.getenv("OPENAI_API_KEY").
Handle errors gracefully — if transcription fails, return an error message string.
```

---

## Day 2: The Hard Part — Language Pipeline Testing

### Test Inputs to Verify

Run these through your understand_input() function and verify correct results:

| Input | Expected Language | Expected Intent |
|-------|-------------------|-----------------|
| "I ate chicken rice for lunch" | english | report_meal |
| "我今天午餐吃了炒粿条" | mandarin | report_meal |
| "my blood sugar 很高 today, I ate char kway teow lah" | singlish_mandarin_mix | report_meal + report_symptom |
| "I took my Metformin already" | english | report_medication |
| "Saya sudah makan ubat" | malay | report_medication |
| "今天的血糖是11.2" | mandarin | report_glucose |
| "wah today glucose damn high sia" | singlish | report_glucose |

### Test the Full Pipeline

```python
# Test: Singlish+Mandarin input → English intent → Claude tools → localised response
input_text = "my blood sugar 很高 today, I ate char kway teow lah"

# Step 1: SEA-LION understands
intent = await understand_input(input_text)
assert intent["detected_language"] == "singlish_mandarin_mix"
assert "meal" in intent["intent"] or "glucose" in intent["intent"]

# Step 2: Claude reasons (Person 1's graph handles this)
# Step 3: SEA-LION localises
response = await localise_response(
    "Your blood sugar is a bit high. The char kway teow has about 90g of carbs. Try a short walk after your meal!",
    "singlish_mandarin_mix"
)
# Should come back as natural Singlish/Mandarin mix
```

### Prompt for Fine-Tuning SEA-LION Localisation

```
I need SEA-LION to localise English medical advice into natural Singaporean speech patterns.

Rules for each language:
- singlish: Use particles (lah, leh, lor, meh). Keep medical terms in English. Casual tone. 
  Example: "Your sugar a bit high leh. The char kway teow got a lot of carbs. Try go walk walk after eating lah!"
- singlish_mandarin_mix: Mix English, Mandarin, and Singlish naturally. 
  Example: "Wah, char kway teow 的碳水化合物蛮高的 leh. 下次 try 吃少一点 portion, 可以吗？"
- mandarin: Polite, warm Mandarin. Use 您 not 你 for elderly patients.
  Example: "您的血糖有点偏高。炒粿条的碳水化合物比较多，建议饭后散步十五分钟。"
- malay: Polite Bahasa Melayu.
  Example: "Gula darah awak agak tinggi. Char kway teow ada banyak karbohidrat. Cuba jalan kaki selepas makan."

Never translate food names — keep them in their original language (char kway teow stays as char kway teow).
Never translate medication names — keep Metformin, Glipizide in English.
```

---

## Day 2 Afternoon: Claude Vision for Meal Photos

### Prompt for Claude Vision Integration

```
Add a function to claude_service.py:

async def analyse_meal_photo(image_base64: str) -> dict:
    - Send image to Claude with vision capability
    - System prompt: "You are a nutritional analyst specialising in Singaporean and Southeast Asian cuisine. Identify the food in this photo and estimate: food name, calories, carbs (g), protein (g), fat (g). Also identify if it's hawker food, home-cooked, or restaurant food. Return JSON only."
    - Parse the JSON response
    - Return: {"food_name": "...", "calories": N, "carbs_grams": N, "protein_grams": N, "fat_grams": N, "cultural_context": "hawker_food|home_cooked|restaurant"}

Use claude-sonnet-4-20250514 with image content block:
{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64}}
```

## Day 3: Polish
- Test Mandarin voice input: record yourself saying "我今天午餐吃了炒粿条" → verify Whisper transcribes correctly
- Test with different accents if possible
- Make sure the mock fallbacks still work as backup for the live demo
