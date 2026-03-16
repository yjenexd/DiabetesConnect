#!/usr/bin/env python3
import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _wait_for_health(base_url: str, timeout_s: float = 15.0) -> None:
    deadline = time.time() + timeout_s
    last_err = None
    while time.time() < deadline:
        try:
            r = httpx.get(f"{base_url}/health", timeout=1.0)
            if r.status_code == 200:
                return
            last_err = f"status={r.status_code} body={r.text[:200]}"
        except Exception as e:
            last_err = str(e)
        time.sleep(0.25)
    raise RuntimeError(f"Backend did not become healthy in {timeout_s}s ({last_err})")


def _expect_keys(obj: Dict[str, Any], keys: List[str]) -> Tuple[bool, str]:
    missing = [k for k in keys if k not in obj]
    if missing:
        return False, f"missing keys: {missing}"
    return True, ""


def _safe_json(r: httpx.Response) -> Dict[str, Any]:
    try:
        return r.json()
    except Exception:
        raise RuntimeError(f"Expected JSON but got: {r.text[:300]}")


def _post_json(client: httpx.Client, url: str, payload: Dict[str, Any]) -> httpx.Response:
    return client.post(url, json=payload, timeout=10.0)


def _get(client: httpx.Client, url: str, params: Optional[Dict[str, Any]] = None) -> httpx.Response:
    return client.get(url, params=params, timeout=10.0)


def run_smoke(base_url: str, patient_id: str, doctor_id: str) -> List[CheckResult]:
    results: List[CheckResult] = []

    with httpx.Client(base_url=base_url) as client:
        # 1) Health
        r = _get(client, "/health")
        if r.status_code != 200:
            results.append(CheckResult("health", False, f"status={r.status_code}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["status", "app"])
            results.append(CheckResult("health", ok, detail))

        # 2) Patient dashboard
        r = _get(client, f"/api/patients/{patient_id}/dashboard")
        if r.status_code != 200:
            results.append(CheckResult("patient_dashboard", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(
                obj,
                [
                    "patient",
                    "glucose_readings",
                    "meals",
                    "med_logs",
                    "medications",
                    "recommendations",
                    "lifestyle_goals",
                    "referrals",
                    "history_requests",
                ],
            )
            if ok:
                # Demo narrative checks (best-effort, not strict correctness).
                fasting = [g for g in obj.get("glucose_readings", []) if g.get("context") == "fasting"]
                fasting_sorted = sorted(fasting, key=lambda x: x.get("measurement_time", ""))
                if len(fasting_sorted) >= 2:
                    early = float(fasting_sorted[0]["value_mmol"])
                    late = float(fasting_sorted[-1]["value_mmol"])
                    if not (late > early):
                        ok = False
                        detail = f"expected rising fasting trend, got early={early} late={late}"

                med_logs = obj.get("med_logs", [])
                if med_logs:
                    taken = sum(1 for m in med_logs if m.get("action") == "taken")
                    if taken == len(med_logs):
                        ok = False
                        detail = "expected some missed/delayed meds in demo seed"

                if not obj.get("referrals"):
                    ok = False
                    detail = "expected at least 1 referral in demo seed"

                if not obj.get("history_requests"):
                    ok = False
                    detail = "expected at least 1 history request in demo seed"

                if not obj.get("recommendations"):
                    ok = False
                    detail = "expected at least 1 recommendation in demo seed"

            results.append(CheckResult("patient_dashboard_shape+story", ok, detail))

        # 3) Manual logs
        r = _post_json(
            client,
            f"/api/patients/{patient_id}/meals",
            {"food_name": "Char Kway Teow", "calories_estimate": 700, "carbs_grams": 90.0, "meal_type": "lunch"},
        )
        if r.status_code != 200:
            results.append(CheckResult("manual_log_meal", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["success", "meal_id"])
            results.append(CheckResult("manual_log_meal", ok, detail))

        r = _post_json(client, f"/api/patients/{patient_id}/glucose", {"value_mmol": 10.5, "context": "fasting"})
        if r.status_code != 200:
            results.append(CheckResult("manual_log_glucose", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["success", "reading_id"])
            results.append(CheckResult("manual_log_glucose", ok, detail))

        r = _post_json(
            client,
            f"/api/patients/{patient_id}/medications/log",
            {"medication_name": "Metformin", "action": "taken"},
        )
        if r.status_code != 200:
            results.append(CheckResult("manual_log_med", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["success", "log_id"])
            results.append(CheckResult("manual_log_med", ok, detail))

        # 4) Chat (text + voice fail path + photo)
        r = _post_json(
            client,
            "/api/chat",
            {"patient_id": patient_id, "message": "I ate chicken rice", "input_type": "text"},
        )
        if r.status_code != 200:
            results.append(CheckResult("chat_text", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["response", "english_response", "language", "tools_called", "alerts_generated"])
            results.append(CheckResult("chat_text_shape", ok, detail))

        r = _post_json(
            client,
            "/api/chat",
            {"patient_id": patient_id, "message": "", "input_type": "voice", "audio_base64": "not_base64"},
        )
        if r.status_code != 200:
            results.append(CheckResult("chat_voice", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["response", "english_response", "language", "tools_called", "alerts_generated"])
            results.append(CheckResult("chat_voice_shape", ok, detail))

        r = _post_json(
            client,
            "/api/chat",
            {"patient_id": patient_id, "message": "Analyse this meal photo", "input_type": "photo", "image_base64": "not_base64"},
        )
        if r.status_code != 200:
            results.append(CheckResult("chat_photo", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["response", "english_response", "language", "tools_called", "alerts_generated"])
            # We expect it to attempt logging a meal even if analysis fails.
            if ok and "log_meal" not in (obj.get("tools_called") or []):
                ok = False
                detail = "expected tools_called to include log_meal"
            results.append(CheckResult("chat_photo_shape+log", ok, detail))

        # 5) Doctor list + detail
        r = _get(
            client,
            f"/api/doctor/{doctor_id}/patients",
            params={"sort_by": "urgency", "filter_severity": "all"},
        )
        if r.status_code != 200:
            results.append(CheckResult("doctor_list", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["patients", "total_count"])
            if ok and obj.get("patients"):
                p0 = obj["patients"][0]
                ok, detail = _expect_keys(
                    p0,
                    [
                        "id",
                        "name",
                        "age",
                        "gender",
                        "risk_level",
                        "adherence_pct",
                        "latest_glucose",
                        "latest_alert_severity",
                    ],
                )
            results.append(CheckResult("doctor_list_shape", ok, detail))

        r = _get(client, f"/api/doctor/patients/{patient_id}/detail")
        if r.status_code != 200:
            results.append(CheckResult("doctor_detail", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(
                obj,
                [
                    "patient",
                    "glucose_readings",
                    "meals",
                    "med_logs",
                    "medications",
                    "alerts",
                    "lifestyle_goals",
                    "referrals",
                    "history_requests",
                    "recommendations",
                    "weekly_reports",
                    "doctor_actions",
                ],
            )
            if ok:
                if not obj.get("alerts"):
                    ok = False
                    detail = "expected seeded alerts"
                if not obj.get("doctor_actions"):
                    ok = False
                    detail = "expected seeded doctor_actions"
                if not obj.get("weekly_reports"):
                    ok = False
                    detail = "expected seeded weekly_reports"
            results.append(CheckResult("doctor_detail_shape+story", ok, detail))

        # 6) Generate report (should succeed even without valid keys by returning fallback analysis)
        r = _post_json(client, f"/api/doctor/patients/{patient_id}/generate-report", {})
        if r.status_code != 200:
            results.append(CheckResult("generate_report", False, f"status={r.status_code} body={r.text[:200]}"))
        else:
            obj = _safe_json(r)
            ok, detail = _expect_keys(obj, ["report_id", "analysis", "recommendations", "preview"])
            results.append(CheckResult("generate_report_shape", ok, detail))

    return results


def _start_backend(port: int, db_path: str) -> subprocess.Popen:
    env = os.environ.copy()
    # Absolute path -> sqlite:////abs/path.db
    db_path = os.path.abspath(db_path)
    env["DATABASE_URL"] = f"sqlite:////{db_path.lstrip('/')}"
    env["SEED_ON_STARTUP"] = "true"
    env.setdefault("CORS_ORIGINS", "http://localhost:5173")

    # Run uvicorn from backend/ so imports like `from api.routes ...` work.
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--port", str(port), "--log-level", "warning"]
    return subprocess.Popen(cmd, cwd=backend_dir, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="DiabetesConnect integration smoke runner.")
    parser.add_argument("--base-url", default=None, help="Use an existing backend URL (skips starting uvicorn).")
    parser.add_argument("--patient-id", default="ah_kow_001")
    parser.add_argument("--doctor-id", default="dr_tan_001")
    args = parser.parse_args()

    proc: Optional[subprocess.Popen] = None
    base_url = args.base_url
    temp_db = None
    ok = False

    try:
        if base_url is None:
            port = _pick_free_port()
            base_url = f"http://127.0.0.1:{port}"
            temp_db = f"/tmp/diabetesconnect_smoke_{int(time.time())}.db"
            proc = _start_backend(port, temp_db)
            _wait_for_health(base_url)

        checks = run_smoke(base_url, args.patient_id, args.doctor_id)
        failed = [c for c in checks if not c.ok]

        print(f"Base URL: {base_url}")
        for c in checks:
            status = "PASS" if c.ok else "FAIL"
            extra = f" ({c.detail})" if c.detail else ""
            print(f"{status:4} {c.name}{extra}")

        ok = not failed
        return 0 if ok else 1
    finally:
        if proc is not None:
            try:
                proc.send_signal(signal.SIGINT)
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
        if temp_db and os.path.exists(temp_db) and ok:
            os.unlink(temp_db)


if __name__ == "__main__":
    raise SystemExit(main())
