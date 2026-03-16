"""Seed database with comprehensive demo data for DiabetesConnect."""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from itertools import count

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import init_db, get_db

# Deterministic ID generator so seeded rows are stable across machines/runs.
_id_counter = count(1)


def uid() -> str:
    return f"{next(_id_counter):08x}"

async def seed_all(*, init_db_already_ran: bool = False):
    """Populate the database with demo data."""
    if not init_db_already_ran:
        await init_db()
    db = await get_db()
    try:
        # Check if already seeded
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM patients")
        row = await cursor.fetchone()
        if row and dict(row)["cnt"] > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # ── Doctors ──
        dr_tan_id = "dr_tan_001"
        await db.execute(
            "INSERT INTO doctors (id, name, specialty) VALUES (?, ?, ?)",
            (dr_tan_id, "Dr. Tan Wei Ming", "General Practice / Diabetes Care")
        )
        print("✓ Doctors seeded")

        # ── Patients ──
        patients = [
            ("ah_kow_001", "Ah Kow", 62, "male", "type2", 2019, "mandarin", dr_tan_id),
            ("siti_001", "Siti Aminah", 55, "female", "type2", 2020, "malay", dr_tan_id),
            ("ravi_001", "Ravi Kumar", 58, "male", "type2", 2018, "english", dr_tan_id),
            ("weilin_001", "Tan Wei Lin", 45, "female", "type1", 2015, "english", dr_tan_id),
        ]
        for p in patients:
            await db.execute(
                "INSERT INTO patients (id, name, age, gender, diabetes_type, diagnosis_year, language_preference, doctor_id) VALUES (?,?,?,?,?,?,?,?)",
                p
            )
        print("✓ Patients seeded")

        # ── Medications for Ah Kow ──
        met_id = uid()
        glip_id = uid()
        await db.execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (met_id, "ah_kow_001", "Metformin", "500mg", "2x daily (AM/PM)", dr_tan_id, "2024-01-15", 1)
        )
        await db.execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (glip_id, "ah_kow_001", "Glipizide", "5mg", "1x daily (evening)", dr_tan_id, "2024-06-01", 1)
        )

        # Medications for other patients
        await db.execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), "siti_001", "Metformin", "500mg", "2x daily", dr_tan_id, "2024-03-01", 1)
        )
        await db.execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), "ravi_001", "Metformin", "1000mg", "2x daily", dr_tan_id, "2023-05-01", 1)
        )
        await db.execute(
            "INSERT INTO medications (id, patient_id, name, dosage, frequency, prescribed_by, prescribed_at, active) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), "weilin_001", "Insulin Glargine", "20 units", "1x daily (bedtime)", dr_tan_id, "2022-01-01", 1)
        )
        print("✓ Medications seeded")

        # ── Glucose Readings for Ah Kow (14 days: March 2-15, 2026) ──
        base_date = datetime(2026, 3, 2, 7, 30)
        fasting_values = [8.2, 8.5, 9.0, 9.3, 9.8, 10.2, 10.5, 10.8, 11.0, 11.2, 11.4, 10.9, 10.5, 10.2]
        
        for i, val in enumerate(fasting_values):
            day = base_date + timedelta(days=i)
            # Fasting reading (morning)
            await db.execute(
                "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context, logged_via) VALUES (?,?,?,?,?,?)",
                (uid(), "ah_kow_001", val, day.isoformat(), "fasting", "manual")
            )
            # Post-meal reading (afternoon)
            post_val = val + 3.0 + (i % 3) * 0.2
            afternoon = day.replace(hour=14, minute=0)
            await db.execute(
                "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context, logged_via) VALUES (?,?,?,?,?,?)",
                (uid(), "ah_kow_001", round(post_val, 1), afternoon.isoformat(), "post_meal", "manual")
            )

        # Glucose for other patients (stable)
        for i in range(14):
            day = base_date + timedelta(days=i)
            await db.execute(
                "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context) VALUES (?,?,?,?,?)",
                (uid(), "siti_001", round(6.5 + (i % 3) * 0.3, 1), day.isoformat(), "fasting")
            )
            await db.execute(
                "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context) VALUES (?,?,?,?,?)",
                (uid(), "ravi_001", round(7.8 + (i % 4) * 0.4, 1), day.isoformat(), "fasting")
            )
            await db.execute(
                "INSERT INTO glucose_readings (id, patient_id, value_mmol, measurement_time, context) VALUES (?,?,?,?,?)",
                (uid(), "weilin_001", round(6.0 + (i % 3) * 0.5, 1), day.isoformat(), "fasting")
            )
        print("✓ Glucose readings seeded")

        # ── Meals for Ah Kow (14 days) ──
        hawker_meals = [
            # (food_name, calories, carbs, protein, fat, meal_type, cultural_context)
            ("Char Kway Teow", 700, 90, 20, 30, "lunch", "hawker_food"),
            ("Nasi Lemak", 650, 85, 18, 28, "lunch", "hawker_food"),
            ("Chicken Rice", 600, 75, 25, 20, "lunch", "hawker_food"),
            ("Hokkien Mee", 550, 70, 22, 18, "dinner", "hawker_food"),
            ("Kopi with condensed milk", 150, 25, 3, 5, "breakfast", "hawker_food"),
            ("Toast with Kaya + Butter", 200, 35, 4, 8, "breakfast", "hawker_food"),
            ("Fish Soup Bee Hoon", 350, 45, 28, 8, "lunch", "hawker_food"),
            ("Brown Rice Bee Hoon", 380, 48, 15, 10, "dinner", "hawker_food"),
            ("Kopi-O Kosong", 10, 0, 0, 0, "breakfast", "hawker_food"),
            ("Mee Rebus", 500, 65, 15, 15, "dinner", "hawker_food"),
        ]

        for i in range(14):
            day = base_date + timedelta(days=i)
            # Breakfast
            if i < 10:
                bk = hawker_meals[4]  # kopi with condensed milk
            else:
                bk = hawker_meals[8]  # kopi-o kosong (improvement)
            await db.execute(
                "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, cultural_context, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (uid(), "ah_kow_001", bk[0], bk[1], bk[2], bk[3], bk[4], day.replace(hour=8).isoformat(), "breakfast", bk[6], "chatbot")
            )
            # Lunch
            lunch_idx = i % 4  # rotate through first 4 hawker meals
            if i >= 11:
                lunch_idx = 6  # fish soup bee hoon (improvement)
            ln = hawker_meals[lunch_idx]
            await db.execute(
                "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, cultural_context, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (uid(), "ah_kow_001", ln[0], ln[1], ln[2], ln[3], ln[4], day.replace(hour=12, minute=30).isoformat(), "lunch", ln[6], "chatbot")
            )
            # Dinner
            dinner_idx = 3 + (i % 3)  # hokkien mee, various
            if i >= 10:
                dinner_idx = 7  # brown rice bee hoon
            dn = hawker_meals[min(dinner_idx, len(hawker_meals) - 1)]
            await db.execute(
                "INSERT INTO meals (id, patient_id, food_name, calories_estimate, carbs_grams, protein_grams, fat_grams, meal_time, meal_type, cultural_context, logged_via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (uid(), "ah_kow_001", dn[0], dn[1], dn[2], dn[3], dn[4], day.replace(hour=19).isoformat(), "dinner", dn[6], "chatbot")
            )
        print("✓ Meals seeded")

        # ── Medication Logs for Ah Kow ──
        # AM Metformin: 100% taken
        # PM Glipizide: Week 1 = 57% (missed Mon/Wed/Sat), Week 2 = 71% (missed Tue/Fri)
        glipizide_missed_w1 = {0, 2, 5}  # Mon, Wed, Sat
        glipizide_missed_w2 = {1, 4}     # Tue, Fri

        for i in range(14):
            day = base_date + timedelta(days=i)
            # AM Metformin - always taken
            await db.execute(
                "INSERT INTO med_logs (id, patient_id, medication_id, medication_name, action, scheduled_time, actual_time, logged_via) VALUES (?,?,?,?,?,?,?,?)",
                (uid(), "ah_kow_001", met_id, "Metformin", "taken",
                 day.replace(hour=8).isoformat(), day.replace(hour=8, minute=15).isoformat(), "chatbot")
            )
            # PM Glipizide - some missed
            dow = i % 7
            if i < 7:
                action = "skipped" if dow in glipizide_missed_w1 else "taken"
            else:
                action = "skipped" if dow in glipizide_missed_w2 else "taken"
            
            actual = day.replace(hour=20, minute=30).isoformat() if action == "taken" else None
            reason = "Forgot" if action == "skipped" else None
            await db.execute(
                "INSERT INTO med_logs (id, patient_id, medication_id, medication_name, action, scheduled_time, actual_time, reason_if_skipped, logged_via) VALUES (?,?,?,?,?,?,?,?,?)",
                (uid(), "ah_kow_001", glip_id, "Glipizide", action,
                 day.replace(hour=20).isoformat(), actual, reason, "chatbot")
            )
        print("✓ Medication logs seeded")

        # ── Alerts for Ah Kow ──
        alerts = [
            (uid(), "ah_kow_001", "diet_flag", "warning", "High-carb meal pattern",
             "3rd high-carb hawker meal in a row. Char Kway Teow has ~90g carbs — consider lighter options.",
             (base_date + timedelta(days=2)).isoformat()),
            (uid(), "ah_kow_001", "med_missed", "warning", "Evening medication missed",
             "Glipizide skipped for the 2nd time this week. Evening medication is important for overnight glucose control.",
             (base_date + timedelta(days=4)).isoformat()),
            (uid(), "ah_kow_001", "glucose_high", "warning", "Glucose trending upward",
             "Fasting glucose has risen from 8.2 to 10.5 mmol/L over 7 days. Recommend clinical review.",
             (base_date + timedelta(days=6)).isoformat()),
            (uid(), "ah_kow_001", "glucose_high", "critical", "Glucose above 11 mmol/L",
             "Fasting glucose reached 11.2 mmol/L. Immediate attention recommended. Check medication adherence and diet.",
             (base_date + timedelta(days=8)).isoformat()),
            (uid(), "ah_kow_001", "goal_noncompliance", "info", "Carb goal exceeded but improving",
             "Daily carbs averaged 260g vs 200g target, but trending down from 285g. Keep encouraging dietary changes.",
             (base_date + timedelta(days=10)).isoformat()),
        ]
        for a in alerts:
            await db.execute(
                "INSERT INTO alerts (id, patient_id, alert_type, severity, title, description, created_at) VALUES (?,?,?,?,?,?,?)",
                a
            )
        print("✓ Alerts seeded")

        # ── Doctor Actions (from Day 10 — March 12) ──
        action_date = (base_date + timedelta(days=10)).isoformat()

        # Lifestyle goal action
        lifestyle_action_id = uid()
        await db.execute(
            "INSERT INTO doctor_actions (id, patient_id, doctor_id, action_type, action_data, status, created_at) VALUES (?,?,?,?,?,?,?)",
            (lifestyle_action_id, "ah_kow_001", dr_tan_id, "lifestyle_change",
             '{"goal_type": "daily_carb_limit", "target_value": 200, "target_unit": "grams_per_day", "description": "Keep daily carb intake under 200g. Try brown rice bee hoon and fish soup instead of char kway teow."}',
             "active", action_date)
        )
        await db.execute(
            "INSERT INTO lifestyle_goals (id, patient_id, action_id, goal_type, target_value, target_unit, description, active, compliance_rate) VALUES (?,?,?,?,?,?,?,?,?)",
            (uid(), "ah_kow_001", lifestyle_action_id, "daily_carb_limit", 200, "grams_per_day",
             "Keep daily carb intake under 200g. Try brown rice bee hoon and fish soup instead of char kway teow.", 1, 0.4)
        )

        # Referral action
        referral_action_id = uid()
        await db.execute(
            "INSERT INTO doctor_actions (id, patient_id, doctor_id, action_type, action_data, status, created_at) VALUES (?,?,?,?,?,?,?)",
            (referral_action_id, "ah_kow_001", dr_tan_id, "referral",
             '{"referral_type": "eye_screening", "description": "Annual diabetic eye screening", "appointment_date": "2026-04-01"}',
             "active", action_date)
        )
        await db.execute(
            "INSERT INTO referrals (id, patient_id, action_id, referral_type, description, appointment_date, status) VALUES (?,?,?,?,?,?,?)",
            (uid(), "ah_kow_001", referral_action_id, "Eye Screening",
             "Annual diabetic eye screening at National Eye Centre", "2026-04-01", "pending")
        )

        # History request action
        history_action_id = uid()
        await db.execute(
            "INSERT INTO doctor_actions (id, patient_id, doctor_id, action_type, action_data, status, created_at) VALUES (?,?,?,?,?,?,?)",
            (history_action_id, "ah_kow_001", dr_tan_id, "request_history",
             '{"request_text": "Please share your family history of diabetes and heart disease."}',
             "active", action_date)
        )
        await db.execute(
            "INSERT INTO history_requests (id, patient_id, action_id, request_text, status) VALUES (?,?,?,?,?)",
            (uid(), "ah_kow_001", history_action_id,
             "Please share your family history of diabetes and heart disease.", "pending")
        )

        # Recommendation
        await db.execute(
            "INSERT INTO recommendations (id, patient_id, doctor_id, recommendation_type, content, status, created_at) VALUES (?,?,?,?,?,?,?)",
            (uid(), "ah_kow_001", dr_tan_id, "lifestyle",
             "Uncle Ah Kow, I noticed your blood sugar has been going up. The evening Glipizide is very important — please try to take it every night with dinner. For meals, brown rice bee hoon and fish soup are great choices! I've also arranged an eye check-up for you on April 1st. Keep up the good work with your morning Metformin! 💪",
             "sent", action_date)
        )
        print("✓ Doctor actions, goals, referrals, and recommendations seeded")

        # ── Weekly report (doctor-facing data) ──
        # Seed at least one weekly report so the doctor detail view has a complete narrative out of the box.
        wr_id = uid()
        week_start = base_date.date().isoformat()  # 2026-03-02
        week_end = (base_date + timedelta(days=13)).date().isoformat()  # 2026-03-15
        await db.execute(
            "INSERT INTO weekly_reports (id, patient_id, week_start, week_end, summary_text, key_metrics, risk_level, recommendations, generated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (
                wr_id,
                "ah_kow_001",
                week_start,
                week_end,
                "Ah Kow (62M, Type 2) shows an upward fasting glucose trend over 14 days with partial improvement in the second week. Evening medication adherence is inconsistent and diet is heavy on high-carb hawker meals.",
                '[{"finding":"Fasting glucose rose from 8.2 to 11.4 mmol/L then eased to 10.2","severity":"critical","data_points":"2026-03-02: 8.2, 2026-03-12: 11.4, 2026-03-15: 10.2"}]',
                "high",
                '[{"priority":1,"action":"Improve evening Glipizide adherence","rationale":"Missed evening doses correlate with higher fasting readings"},{"priority":2,"action":"Reduce high-carb hawker meals","rationale":"Repeated >70g carb meals contribute to elevated post-meal glucose"}]',
                (base_date + timedelta(days=12, hours=10)).isoformat(),
            ),
        )
        print("✓ Weekly reports seeded")

        # ── Pre-loaded chat messages for Ah Kow ──
        chat_msgs = [
            (uid(), "ah_kow_001", "patient", "我今天午餐吃了炒粿条", "mandarin",
             (base_date + timedelta(days=12, hours=5)).isoformat()),
            (uid(), "ah_kow_001", "assistant",
             "I see you had char kway teow for lunch! That's a tasty hawker favourite, but it has about 90g of carbs. Your doctor suggested keeping daily carbs under 200g. Maybe try fish soup bee hoon next time — it's lighter and still very shiok! 😊",
             "english", (base_date + timedelta(days=12, hours=5, minutes=1)).isoformat()),
            (uid(), "ah_kow_001", "patient", "my blood sugar 很高 today lah",
             "singlish_mandarin_mix", (base_date + timedelta(days=13, hours=2)).isoformat()),
            (uid(), "ah_kow_001", "assistant",
             "I understand your concern about your blood sugar being high. Your latest fasting reading was 10.2 mmol/L — it has come down from 11.4 last week, which is a good sign! Keep taking your evening Glipizide and try a short 15-minute walk after meals. You're making progress! 💪",
             "english", (base_date + timedelta(days=13, hours=2, minutes=1)).isoformat()),
        ]
        for msg in chat_msgs:
            await db.execute(
                "INSERT INTO chat_messages (id, patient_id, role, content, language, timestamp) VALUES (?,?,?,?,?,?)",
                msg
            )
        print("✓ Chat messages seeded")

        await db.commit()
        print("\n✅ Database seeded successfully!")

    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(seed_all())
