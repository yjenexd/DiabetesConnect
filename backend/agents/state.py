"""State schemas for LangGraph-style agent pipelines."""
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class PatientChatState(TypedDict, total=False):
    """State for the patient chat pipeline."""
    patient_id: str
    raw_input: str
    input_type: str  # text / voice / photo
    audio_base64: Optional[str]
    image_base64: Optional[str]
    transcribed_text: str
    detected_language: str
    structured_intent: dict
    claude_messages: List[dict]
    tool_calls: List[dict]
    tool_results: List[dict]
    agent3_alerts: List[dict]
    english_response: str
    localised_response: str
    error: Optional[str]


class DoctorAnalysisState(TypedDict, total=False):
    """State for the doctor analysis pipeline."""
    patient_id: str
    doctor_id: str
    request_type: str  # weekly_report / recommendation / action
    patient_data: dict
    analysis_text: str
    analysis: dict
    recommendations: List[dict]
    doctor_actions: List[dict]
    preview_payload: dict
    approved: bool

