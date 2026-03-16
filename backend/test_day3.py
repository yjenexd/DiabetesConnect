"""Day 3 Test: Mock fallback verification for live demo."""
import asyncio
import sys
sys.path.insert(0, ".")

from services.sealion_service import (
    understand_input, localise_response,
    _mock_detect_language, _mock_detect_intent, _mock_extract_entities
)


async def test_mock_fallbacks():
    print("=" * 60)
    print("DAY 3 TEST: Mock Fallback Verification")
    print("=" * 60)

    passed = 0
    failed = 0

    # --- Test 1: Mock language detection ---
    print("\n--- Test 1: Mock Language Detection ---")
    tests_lang = [
        ("I ate chicken rice", "english"),
        ("我今天吃了炒粿条", "mandarin"),
        ("Saya sudah makan ubat", "malay"),
        ("wah today so hungry sia", "singlish"),
        ("my blood sugar 很高 lah", "singlish_mandarin_mix"),
    ]
    for text, expected in tests_lang:
        result = _mock_detect_language(text)
        ok = result == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] '{text[:40]}' -> {result} (expected: {expected})")

    # --- Test 2: Mock intent detection ---
    print("\n--- Test 2: Mock Intent Detection ---")
    tests_intent = [
        ("I ate chicken rice for lunch", "report_meal"),
        ("I took my metformin", "report_medication"),
        ("my glucose is 11.2", "report_glucose"),
        ("I feel very dizzy today", "report_symptom"),
        ("hello how are you", "general_chat"),
        ("i ate medicine", "report_medication"),
    ]
    for text, expected in tests_intent:
        result = _mock_detect_intent(text)
        ok = result == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] '{text[:40]}' -> {result} (expected: {expected})")

    # --- Test 3: Mock entity extraction ---
    print("\n--- Test 3: Mock Entity Extraction ---")
    tests_entities = [
        ("I ate chicken rice", "food", "chicken rice"),
        ("took my metformin", "medication", "metformin"),
        ("blood sugar is 11.2 mmol", "value", "11.2"),
        ("blood sugar is 7.8", "value", "7.8"),
    ]
    for text, key, expected in tests_entities:
        result = _mock_extract_entities(text)
        got = result.get(key, "MISSING")
        ok = got == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] '{text[:40]}' -> {key}={got} (expected: {expected})")

    # --- Test 4: Full understand_input mock pipeline ---
    print("\n--- Test 4: Full understand_input (Mock Mode) ---")
    test_inputs = [
        ("I ate chicken rice for lunch", "english", "report_meal"),
        ("我今天午餐吃了炒粿条", "mandarin", "report_meal"),
        ("my blood sugar 很高 today, I ate char kway teow lah", "singlish_mandarin_mix", "report_meal"),
        ("I took my Metformin already", "english", "report_medication"),
        ("Saya sudah makan ubat", "malay", "report_medication"),
        ("今天的血糖是11.2", "mandarin", "report_glucose"),
        ("wah today glucose damn high sia", "singlish", "report_glucose"),
    ]
    for text, exp_lang, exp_intent in test_inputs:
        result = await understand_input(text)
        lang_ok = result["detected_language"] == exp_lang
        intent_ok = result["intent"] == exp_intent
        ok = lang_ok and intent_ok
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        details = f'lang={result["detected_language"]}, intent={result["intent"]}'
        print(f"  [{status}] '{text[:45]}' -> {details}")

    # --- Test 5: Mock localisation ---
    print("\n--- Test 5: Mock Localisation ---")
    english_text = "Your blood sugar is a bit high. Try a short walk after your meal."
    for lang in ["english", "singlish", "mandarin", "malay", "singlish_mandarin_mix"]:
        result = await localise_response(english_text, lang)
        is_ok = (lang == "english" and result == english_text) or (lang != "english" and result != english_text)
        status = "PASS" if is_ok else "FAIL"
        if is_ok:
            passed += 1
        else:
            failed += 1
        preview = result[:80] + "..." if len(result) > 80 else result
        print(f"  [{status}] {lang}: {preview}")

    # --- Test 6: Whisper service import check ---
    print("\n--- Test 6: Whisper Service Structure ---")
    try:
        from services.whisper_service import transcribe_audio
        import inspect
        sig = inspect.signature(transcribe_audio)
        params = list(sig.parameters.keys())
        ok = "audio_base64" in params and "language" in params
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] transcribe_audio signature: ({', '.join(params)})")
        ok2 = asyncio.iscoroutinefunction(transcribe_audio)
        status2 = "PASS" if ok2 else "FAIL"
        if ok2:
            passed += 1
        else:
            failed += 1
        print(f"  [{status2}] transcribe_audio is async: {ok2}")
    except Exception as e:
        failed += 2
        print(f"  [FAIL] Could not import whisper_service: {e}")

    # --- Test 7: Claude service import check ---
    print("\n--- Test 7: Claude Service Structure ---")
    try:
        from services.claude_service import (
            chat_with_tools, generate_clinical_analysis,
            check_anomalies, draft_patient_recommendation, analyse_meal_photo
        )
        import inspect
        funcs = [
            ("chat_with_tools", chat_with_tools),
            ("generate_clinical_analysis", generate_clinical_analysis),
            ("check_anomalies", check_anomalies),
            ("draft_patient_recommendation", draft_patient_recommendation),
            ("analyse_meal_photo", analyse_meal_photo),
        ]
        for name, fn in funcs:
            is_async = asyncio.iscoroutinefunction(fn)
            status = "PASS" if is_async else "FAIL"
            if is_async:
                passed += 1
            else:
                failed += 1
            print(f"  [{status}] {name} is async: {is_async}")
    except ImportError as e:
        failed += 5
        print(f"  [FAIL] Could not import claude_service: {e}")

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
    print(f"{'=' * 60}")
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(test_mock_fallbacks())
    sys.exit(0 if success else 1)
