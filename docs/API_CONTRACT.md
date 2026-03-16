# DiabetesConnect — API Contract

> **Single source of truth** for all frontend ↔ backend communication.
> Base URL: `http://localhost:8000`

---

## Patient Endpoints

### POST `/api/chat`

Send a patient message through the AI chat pipeline (SEA-LION → Claude → tools → monitor → localise).

**Request Body:**
```json
{
  "patient_id": "ah_kow_001",
  "message": "我今天午餐吃了炒粿条",
  "input_type": "text",
  "audio_base64": null,
  "image_base64": null
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `patient_id` | string | ✅ | e.g. `ah_kow_001` |
| `message` | string | ✅ | Raw patient input (any language) |
| `input_type` | string | ❌ | `text` (default), `voice`, `photo` |
| `audio_base64` | string | ❌ | Base64 audio when `input_type=voice` |
| `image_base64` | string | ❌ | Base64 image when `input_type=photo` |

**Response (200):**
```json
{
  "response": "I see you had char kway teow for lunch! That's a tasty hawker favourite, but it has about 90g of carbs. Your doctor suggested keeping daily carbs under 200g. Maybe try fish soup bee hoon next time — it's lighter and still very shiok! 😊",
  "english_response": "I see you had char kway teow for lunch! ...",
  "language": "mandarin",
  "tools_called": ["log_meal"],
  "alerts_generated": []
}
```

---

### GET `/api/patients/{id}/dashboard`

Fetch the full patient dashboard — everything the patient sees.

**URL Parameters:**
| Param | Example |
|-------|---------|
| `id` | `ah_kow_001` |

**Response (200):**
```json
{
  "patient": {
    "id": "ah_kow_001",
    "name": "Ah Kow",
    "age": 62,
    "gender": "male",
    "diabetes_type": "type2",
    "diagnosis_year": 2019,
    "language_preference": "mandarin",
    "doctor_id": "dr_tan_001",
    "created_at": "2026-03-02T00:00:00"
  },
  "glucose_readings": [
    {
      "id": "a1b2c3d4",
      "value_mmol": 10.2,
      "measurement_time": "2026-03-15T07:30:00",
      "context": "fasting"
    }
  ],
  "meals": [
    {
      "id": "e5f6a7b8",
      "food_name": "Fish Soup Bee Hoon",
      "calories_estimate": 350,
      "carbs_grams": 45.0,
      "meal_time": "2026-03-15T12:30:00",
      "meal_type": "lunch",
      "cultural_context": "hawker_food"
    }
  ],
  "med_logs": [
    {
      "id": "c9d0e1f2",
      "medication_name": "Metformin",
      "action": "taken",
      "scheduled_time": "2026-03-15T08:00:00",
      "actual_time": "2026-03-15T08:15:00"
    }
  ],
  "medications": [
    {
      "id": "med001",
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": "2x daily (AM/PM)",
      "active": 1
    },
    {
      "id": "med002",
      "name": "Glipizide",
      "dosage": "5mg",
      "frequency": "1x daily (evening)",
      "active": 1
    }
  ],
  "recommendations": [
    {
      "id": "rec001",
      "content": "Uncle Ah Kow, I noticed your blood sugar has been going up. The evening Glipizide is very important — please try to take it every night with dinner. For meals, brown rice bee hoon and fish soup are great choices! 💪",
      "recommendation_type": "lifestyle",
      "status": "sent",
      "created_at": "2026-03-12T00:00:00"
    }
  ],
  "lifestyle_goals": [
    {
      "id": "goal001",
      "goal_type": "daily_carb_limit",
      "target_value": 200.0,
      "target_unit": "grams_per_day",
      "description": "Keep daily carb intake under 200g. Try brown rice bee hoon and fish soup instead of char kway teow.",
      "compliance_rate": 0.4
    }
  ],
  "referrals": [
    {
      "id": "ref001",
      "referral_type": "Eye Screening",
      "description": "Annual diabetic eye screening at National Eye Centre",
      "appointment_date": "2026-04-01",
      "status": "pending"
    }
  ],
  "history_requests": [
    {
      "id": "hr001",
      "request_text": "Please share your family history of diabetes and heart disease.",
      "patient_response": null,
      "status": "pending"
    }
  ]
}
```

---

### POST `/api/patients/{id}/meals`

Manually log a meal.

**Request Body:**
```json
{
  "food_name": "Char Kway Teow",
  "calories_estimate": 700,
  "carbs_grams": 90.0,
  "meal_type": "lunch"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `food_name` | string | ✅ | |
| `calories_estimate` | int | ❌ | |
| `carbs_grams` | float | ❌ | |
| `meal_type` | string | ❌ | `breakfast`, `lunch`, `dinner`, `snack` (default: `snack`) |

**Response (200):**
```json
{
  "success": true,
  "meal_id": "f3a4b5c6"
}
```

---

### POST `/api/patients/{id}/glucose`

Manually log a blood glucose reading.

**Request Body:**
```json
{
  "value_mmol": 10.5,
  "context": "fasting"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `value_mmol` | float | ✅ | Blood glucose in mmol/L |
| `context` | string | ❌ | `fasting` (default), `pre_meal`, `post_meal`, `bedtime` |

**Response (200):**
```json
{
  "success": true,
  "reading_id": "d7e8f9a0"
}
```

---

### POST `/api/patients/{id}/medications/log`

Log medication taken/skipped/delayed.

**Request Body:**
```json
{
  "medication_name": "Glipizide",
  "action": "taken"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `medication_name` | string | ✅ | |
| `action` | string | ❌ | `taken` (default), `skipped`, `delayed` |

**Response (200):**
```json
{
  "success": true,
  "log_id": "b1c2d3e4"
}
```

---

### POST `/api/patients/{id}/history-response`

Patient responds to a doctor's history request.

**Request Body:**
```json
{
  "request_id": "hr001",
  "response_text": "My mother had type 2 diabetes and my father had heart disease."
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### GET `/api/patients/{id}/referrals`

Get all referrals for a patient.

**Response (200):**
```json
{
  "referrals": [
    {
      "id": "ref001",
      "referral_type": "Eye Screening",
      "description": "Annual diabetic eye screening at National Eye Centre",
      "appointment_date": "2026-04-01",
      "status": "pending"
    }
  ]
}
```

---

## Doctor Endpoints

### GET `/api/doctor/{id}/patients`

Get doctor's patient list with computed risk indicators.

**Query Parameters:**
| Param | Default | Options |
|-------|---------|---------|
| `sort_by` | `urgency` | `urgency`, `alphabetical` |
| `filter_severity` | `all` | `all`, `info`, `warning`, `critical` |

**Response (200):**
```json
{
  "patients": [
    {
      "id": "ah_kow_001",
      "name": "Ah Kow",
      "age": 62,
      "gender": "male",
      "diabetes_type": "type2",
      "language_preference": "mandarin",
      "latest_glucose": 10.2,
      "adherence_pct": 79,
      "latest_alert_severity": "info",
      "risk_level": "high"
    },
    {
      "id": "ravi_001",
      "name": "Ravi Kumar",
      "age": 58,
      "gender": "male",
      "diabetes_type": "type2",
      "language_preference": "english",
      "latest_glucose": 8.6,
      "adherence_pct": 100,
      "latest_alert_severity": "none",
      "risk_level": "medium"
    },
    {
      "id": "siti_001",
      "name": "Siti Aminah",
      "age": 55,
      "gender": "female",
      "diabetes_type": "type2",
      "language_preference": "malay",
      "latest_glucose": 6.8,
      "adherence_pct": 100,
      "latest_alert_severity": "none",
      "risk_level": "low"
    },
    {
      "id": "weilin_001",
      "name": "Tan Wei Lin",
      "age": 45,
      "gender": "female",
      "diabetes_type": "type1",
      "language_preference": "english",
      "latest_glucose": 6.5,
      "adherence_pct": 100,
      "latest_alert_severity": "none",
      "risk_level": "low"
    }
  ],
  "total_count": 4
}
```

---

### GET `/api/doctor/patients/{id}/detail`

Full patient detail for the doctor view (all tables).

**Response (200):**
```json
{
  "patient": { "..." : "same as patient dashboard" },
  "glucose_readings": [],
  "meals": [],
  "med_logs": [],
  "medications": [],
  "alerts": [
    {
      "id": "alt001",
      "patient_id": "ah_kow_001",
      "alert_type": "glucose_high",
      "severity": "critical",
      "title": "Glucose above 11 mmol/L",
      "description": "Fasting glucose reached 11.2 mmol/L. Immediate attention recommended.",
      "related_data": null,
      "acknowledged_by_doctor": 0,
      "created_at": "2026-03-10T07:30:00"
    }
  ],
  "lifestyle_goals": [],
  "referrals": [],
  "history_requests": [],
  "recommendations": [],
  "weekly_reports": [
    {
      "id": "wr001",
      "patient_id": "ah_kow_001",
      "summary_text": "Clinical narrative...",
      "key_metrics": "[{\"finding\": \"...\"}]",
      "risk_level": "high",
      "recommendations": "[{\"action\": \"...\"}]",
      "generated_at": "2026-03-14T10:00:00"
    }
  ],
  "doctor_actions": [
    {
      "id": "act001",
      "patient_id": "ah_kow_001",
      "doctor_id": "dr_tan_001",
      "action_type": "lifestyle_change",
      "action_data": "{\"goal_type\": \"daily_carb_limit\", \"target_value\": 200}",
      "status": "active",
      "patient_notified": 0,
      "created_at": "2026-03-12T00:00:00"
    }
  ]
}
```

---

### GET `/api/doctor/patients/{id}/patient-view`

Returns exactly what the patient sees (same response as `GET /api/patients/{id}/dashboard`). Used for doctor preview.

---

### POST `/api/doctor/patients/{id}/generate-report`

Generate an AI clinical analysis report for a patient.

**Query Parameters:**
| Param | Default |
|-------|---------|
| `doctor_id` | `dr_tan_001` |

**Response (200):**
```json
{
  "report_id": "wr002",
  "analysis": {
    "summary": "Ah Kow (62M, Type 2) shows concerning glucose trends over the past 14 days...",
    "key_findings": [
      {
        "finding": "Fasting glucose trending upward from 8.2 to 11.4 mmol/L over 12 days",
        "severity": "critical",
        "data_points": "Day 1: 8.2, Day 9: 11.0, Day 12: 11.4"
      }
    ],
    "recommendations": [
      {
        "priority": 1,
        "action": "Review Glipizide dosing — consider uptitration",
        "rationale": "Evening medication adherence is only ~64%, and glucose is above target range"
      }
    ],
    "risk_level": "high"
  },
  "recommendations": [],
  "preview": {}
}
```

---

### POST `/api/doctor/patients/{id}/actions`

Apply a doctor action. Creates the action record plus associated records in the relevant table.

**Request Body — Prescribe Medication:**
```json
{
  "action_type": "prescribe_medication",
  "action_data": {
    "name": "Jardiance",
    "dosage": "10mg",
    "frequency": "1x daily (morning)"
  }
}
```

**Request Body — Lifestyle Change:**
```json
{
  "action_type": "lifestyle_change",
  "action_data": {
    "goal_type": "daily_carb_limit",
    "target_value": 200,
    "target_unit": "grams_per_day",
    "description": "Keep daily carb intake under 200g. Try brown rice bee hoon and fish soup instead of char kway teow."
  }
}
```

**Request Body — Request History:**
```json
{
  "action_type": "request_history",
  "action_data": {
    "request_text": "Please share your family history of diabetes and heart disease."
  }
}
```

**Request Body — Referral:**
```json
{
  "action_type": "referral",
  "action_data": {
    "referral_type": "eye_screening",
    "description": "Annual diabetic eye screening at National Eye Centre",
    "appointment_date": "2026-04-01"
  }
}
```

**Response (200) — all action types:**
```json
{
  "success": true,
  "action_id": "act002"
}
```

---

### POST `/api/doctor/patients/{id}/recommendation`

Draft a recommendation for a patient.

**Request Body:**
```json
{
  "content": "Uncle Ah Kow, please remember to take your Glipizide every evening with dinner. Brown rice bee hoon is a great choice — keep it up! 💪",
  "recommendation_type": "lifestyle"
}
```

**Response (200):**
```json
{
  "recommendation_id": "rec002",
  "preview": {
    "content": "Uncle Ah Kow, please remember to take your Glipizide every evening with dinner. Brown rice bee hoon is a great choice — keep it up! 💪"
  }
}
```

---

### PUT `/api/doctor/patients/{id}/recommendation/{rec_id}/approve`

Approve and send a recommendation. Optionally update the content.

**Request Body (optional):**
```json
{
  "content": "Updated message text (optional)"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### PUT `/api/alerts/{id}/acknowledge`

Doctor acknowledges an alert.

**Response (200):**
```json
{
  "success": true
}
```

---

## Utility Endpoints

### GET `/health`

Health check.

**Response (200):**
```json
{
  "status": "healthy",
  "app": "DiabetesConnect"
}
```

### GET `/api/chat/history/{patient_id}`

Get chat history for a patient.

**Query Parameters:**
| Param | Default |
|-------|---------|
| `limit` | `50` |

**Response (200):**
```json
{
  "patient_id": "ah_kow_001",
  "messages": [
    {
      "id": "msg001",
      "role": "patient",
      "content": "我今天午餐吃了炒粿条",
      "language": "mandarin",
      "timestamp": "2026-03-14T12:30:00"
    },
    {
      "id": "msg002",
      "role": "assistant",
      "content": "I see you had char kway teow for lunch! ...",
      "language": "english",
      "timestamp": "2026-03-14T12:31:00"
    }
  ]
}
```

---

## WebSocket

### WS `/api/ws/chat/{patient_id}`

Real-time chat via WebSocket.

**Send:**
```json
{
  "message": "I just took my Metformin",
  "input_type": "text"
}
```

**Receive:**
```json
{
  "response": "Great job taking your Metformin! 💪 Staying consistent really helps. Have you had breakfast yet?",
  "language": "english",
  "tools_called": ["log_medication"],
  "alerts_generated": []
}
```

---

## Patient IDs (Seed Data)

| ID | Name | Age | Type | Language |
|----|------|-----|------|----------|
| `ah_kow_001` | Ah Kow | 62 | type2 | mandarin |
| `siti_001` | Siti Aminah | 55 | type2 | malay |
| `ravi_001` | Ravi Kumar | 58 | type2 | english |
| `weilin_001` | Tan Wei Lin | 45 | type1 | english |

## Doctor ID

| ID | Name |
|----|------|
| `dr_tan_001` | Dr. Tan Wei Ming |
