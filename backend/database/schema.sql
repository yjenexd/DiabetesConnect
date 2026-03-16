-- Patients
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    diabetes_type TEXT,
    diagnosis_year INTEGER,
    language_preference TEXT DEFAULT 'english',
    doctor_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications
CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    prescribed_by TEXT,
    prescribed_at TIMESTAMP,
    active INTEGER DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Medication logs
CREATE TABLE IF NOT EXISTS med_logs (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    medication_id TEXT,
    medication_name TEXT,
    action TEXT CHECK(action IN ('taken', 'skipped', 'delayed')),
    scheduled_time TIMESTAMP,
    actual_time TIMESTAMP,
    reason_if_skipped TEXT,
    logged_via TEXT DEFAULT 'manual',
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (medication_id) REFERENCES medications(id)
);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    food_name TEXT NOT NULL,
    calories_estimate INTEGER,
    carbs_grams REAL,
    protein_grams REAL,
    fat_grams REAL,
    meal_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    photo_url TEXT,
    logged_via TEXT DEFAULT 'manual',
    cultural_context TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Glucose readings
CREATE TABLE IF NOT EXISTS glucose_readings (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    value_mmol REAL NOT NULL,
    measurement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context TEXT CHECK(context IN ('fasting', 'pre_meal', 'post_meal', 'bedtime')),
    logged_via TEXT DEFAULT 'manual',
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    alert_type TEXT,
    severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
    title TEXT,
    description TEXT,
    related_data TEXT,
    acknowledged_by_doctor INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT,
    recommendation_type TEXT,
    content TEXT,
    ai_generated_draft TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'preview', 'sent', 'acknowledged')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Doctor actions
CREATE TABLE IF NOT EXISTS doctor_actions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT,
    action_type TEXT,
    action_data TEXT,
    status TEXT DEFAULT 'active',
    patient_notified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Lifestyle goals
CREATE TABLE IF NOT EXISTS lifestyle_goals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    action_id TEXT,
    goal_type TEXT,
    target_value REAL,
    target_unit TEXT,
    description TEXT,
    active INTEGER DEFAULT 1,
    compliance_rate REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (action_id) REFERENCES doctor_actions(id)
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    action_id TEXT,
    referral_type TEXT,
    description TEXT,
    appointment_date TIMESTAMP,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (action_id) REFERENCES doctor_actions(id)
);

-- History requests
CREATE TABLE IF NOT EXISTS history_requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    action_id TEXT,
    request_text TEXT,
    patient_response TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (action_id) REFERENCES doctor_actions(id)
);

-- Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    week_start TIMESTAMP,
    week_end TIMESTAMP,
    summary_text TEXT,
    key_metrics TEXT,
    risk_level TEXT,
    recommendations TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('patient', 'assistant')),
    content TEXT NOT NULL,
    language TEXT DEFAULT 'english',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_glucose_patient ON glucose_readings(patient_id);
CREATE INDEX IF NOT EXISTS idx_meals_patient ON meals(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_logs_patient ON med_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_patient ON chat_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_patient ON recommendations(patient_id);

-- High-impact indexes for list endpoints and ordering
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_glucose_patient_time ON glucose_readings(patient_id, measurement_time);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_created_at ON alerts(patient_id, created_at);
