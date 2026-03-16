# Integration Smoke (End-to-End)

This repo is designed so a single command can verify the end-to-end demo flow without needing API keys.

## One-Command Smoke

Runs an ephemeral backend on a random port with a fresh SQLite DB (seeded), calls all key endpoints, and exits non-zero on failure.

```bash
python3 backend/scripts/smoke_runner.py
```

Options:

```bash
# Target an already-running backend:
python3 backend/scripts/smoke_runner.py --base-url http://localhost:8000

# Override IDs:
python3 backend/scripts/smoke_runner.py --patient-id ah_kow_001 --doctor-id dr_tan_001
```

## Manual QA Checklist (Demo Story)

Patient (Ah Kow):
- Dashboard loads and shows a rising fasting glucose trend over March 2–15, 2026.
- Medication adherence is not 100% (Glipizide misses are visible).
- At least 1 alert exists and can be acknowledged in doctor view.
- A lifestyle goal exists (daily carb limit).
- A referral exists (eye screening) and shows appointment date.
- A history request exists (family history) and is pending/respondable.
- A recommendation exists (sent) and appears in the patient view.

Doctor:
- Patient list loads with computed fields (`latest_glucose`, `adherence_pct`, `latest_alert_severity`, `risk_level`).
- Patient detail loads with `alerts`, `doctor_actions`, `weekly_reports`.
- Generate report succeeds and saves a `weekly_reports` row with `week_start` and `week_end`.

