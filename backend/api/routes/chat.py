"""Chat endpoints — the main patient AI interaction."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional

from agents.graph_patient import run_patient_chat
from database.db import fetch_all
from services.sealion_service import understand_input

router = APIRouter()


class ChatRequest(BaseModel):
    patient_id: str
    message: str
    input_type: str = "text"  # text / voice / photo
    audio_base64: Optional[str] = None
    image_base64: Optional[str] = None


@router.post("/chat")
async def send_chat_message(req: ChatRequest):
    """Process a patient chat message through the full AI pipeline."""
    state = {
        "patient_id": req.patient_id,
        "raw_input": req.message,
        "input_type": req.input_type,
        "audio_base64": req.audio_base64,
        "image_base64": req.image_base64,
    }
    result = await run_patient_chat(state)

    return {
        "response": result.get("localised_response") or result.get("english_response", ""),
        "english_response": result.get("english_response", ""),
        "language": result.get("detected_language", "english"),
        "tools_called": [t["tool"] for t in result.get("tool_results", [])],
        "alerts_generated": result.get("agent3_alerts", []),
        "transcribed_text": result.get("transcribed_text", ""),
    }


@router.get("/chat/history/{patient_id}")
async def get_chat_history(patient_id: str, limit: int = 50):
    """Get chat history for a patient."""
    messages = await fetch_all(
        "SELECT id, role, content, language, timestamp FROM chat_messages WHERE patient_id = ? ORDER BY timestamp ASC LIMIT ?",
        (patient_id, limit),
    )
    return {"patient_id": patient_id, "messages": messages}


@router.websocket("/ws/chat/{patient_id}")
async def websocket_chat(websocket: WebSocket, patient_id: str):
    """Real-time chat via WebSocket."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            input_type = data.get("input_type", "text")

            state = {
                "patient_id": patient_id,
                "raw_input": message,
                "input_type": input_type,
                "audio_base64": data.get("audio_base64"),
                "image_base64": data.get("image_base64"),
            }
            result = await run_patient_chat(state)

            await websocket.send_json({
                "response": result.get("localised_response") or result.get("english_response", ""),
                "language": result.get("detected_language", "english"),
                "tools_called": [t["tool"] for t in result.get("tool_results", [])],
                "alerts_generated": result.get("agent3_alerts", []),
            })
    except WebSocketDisconnect:
        pass


@router.get("/test/understand-input")
async def test_understand_input(text: str):
    """Test endpoint to debug language/intent detection."""
    result = await understand_input(text)
    return {
        "input": text,
        "detected_language": result.get("detected_language"),
        "intent": result.get("intent"),
        "entities": result.get("entities"),
        "english_text": result.get("english_text"),
    }

