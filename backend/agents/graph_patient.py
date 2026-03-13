"""Patient chat pipeline — processes patient input through understanding, reasoning, tools, monitoring, and localisation."""
import json
from uuid import uuid4

from agents.state import PatientChatState
from agents.prompts import AGENT1_SYSTEM_PROMPT, AGENT3_SYSTEM_PROMPT, TOOL_DEFINITIONS
from agents.tools import execute_tool
from services.claude_service import chat_with_tools, check_anomalies
from services.sealion_service import understand_input, localise_response
from services.whisper_service import transcribe_audio
from database.db import execute, fetch_all


async def run_patient_chat(state: PatientChatState) -> PatientChatState:
    """Run the full patient chat pipeline.
    
    Flow: whisper_stt (if voice) → sealion_understand → agent1_reason ↔ execute_tools → agent3_monitor → sealion_localise
    """
    patient_id = state["patient_id"]

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
        "SELECT role, content FROM chat_messages WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 10",
        (patient_id,)
    )
    messages = [{"role": r["role"] if r["role"] != "patient" else "user", "content": r["content"]} for r in reversed(history)]
    messages.append({"role": "user", "content": text_input})
    state["claude_messages"] = messages

    # ── Step 4: Agent 1 — Reasoning with tools (may loop) ──
    all_tool_results = []
    max_rounds = 5
    current_messages = list(messages)

    for _ in range(max_rounds):
        result = await chat_with_tools(AGENT1_SYSTEM_PROMPT, current_messages, TOOL_DEFINITIONS)
        
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

