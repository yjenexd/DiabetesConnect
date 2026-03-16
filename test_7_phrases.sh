#!/bin/bash

echo "=== Testing 7 Core Phrases Through understand_input ===" && echo

# Test 1: English meal
echo "1️⃣  English Meal"
curl -s "http://localhost:8000/api/test/understand-input?text=I%20ate%20chicken%20rice%20for%20lunch" | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'Language: {d[\"detected_language\"]}, Intent: {d[\"intent\"]}, Food: {d[\"entities\"].get(\"food\", \"none\")}')" && echo

# Test 2: Mandarin meal
echo "2️⃣  Mandarin Meal (我今天午餐吃了炒粿条)"
curl -s "http://localhost:8000/api/test/understand-input?text=%E6%88%91%E4%BB%8A%E5%A4%A9%E5%8D%88%E9%A4%90%E5%90%83%E4%BA%86%E7%82%92%E7%B2%BF%E6%9D%A2" | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'Language: {d[\"detected_language\"]}, Intent: {d[\"intent\"]}, Food: {d[\"entities\"].get(\"food\", \"none\")}')" && echo

# Test 3: Singlish + Mandarin mixed
echo "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecht/echo "3️-inecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Me%20echo "3️⃣  Sing20lah" | python3 -c "import json,echo "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecht/echo "3️-inecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Me%20echo "3️⃣  Sing20lah" | python3 -c "import json,echo "3�t:8000/apiecho "3️⃣  Singlut?techo "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Srt jecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Mandarin Mix (my blecht/echo "3️-inecho "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-Me%20echo "3️⃣  Sing20lah" | python3 -c "import json,echo "3️⃣  Singlish-Mandarin Mix (my blecho "3️⃣  Singlish-0ubat" | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'Language: {d[\"detected_language\"]}, Intent: {d[\"intent\"]}, Med: {d[\"entities\"].get(\"medication\", \"none\")}')" && echo

# Test 6: Mandarin glucose
echo "6️⃣  Mandarin Glucose (今天的血糖是11.2)"
curl -s "http://localhost:8000/api/test/understand-input?text=%E4%BB%8A%E5%A4%A9%E7%9A%84%E8%A1%80%E7%B3%96%E6%98%AF11.2" | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'Language: {d[\"detected_language\"]}, Intent: {d[\"intent\"]}, Value: {d[\"entities\"].get(\"value\", \"none\")}')" && echo

# Test 7: Singlish glucose
echo "7️⃣  Singlish Glucose (wah today glucose damn high sia)"
curl -s "http://localhost:8000/api/test/understand-input?text=wah%20today%20glucose%20damn%20high%20sia" | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'Language: {d[\"detected_language\"]}, Intent: {d[\"intent\"]}')" && echo

echo "=== All Tests Complete ==="
