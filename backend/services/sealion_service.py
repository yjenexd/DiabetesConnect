"""SEA-LION API service for multilingual understanding and response localisation."""
import os
import json
import re
import logging
import httpx

logger = logging.getLogger(__name__)

SEALION_API_URL = os.getenv("SEALION_API_URL", "https://api.sea-lion.ai/v1")
SEALION_API_KEY = os.getenv("SEALION_API_KEY", "")
USE_MOCK = os.getenv("SEALION_MOCK", "true").lower() == "true"


def _mock_detect_language(text: str) -> str:
    """Simple language detection for mock mode."""
    has_chinese = bool(re.search(r'[\u4e00-\u9fff]', text))
    singlish_particles = ['lah', 'leh', 'lor', 'meh', 'sia', 'hor', 'wah', 'aiyo']
    has_singlish = any(p in text.lower() for p in singlish_particles)
    malay_words = ['saya', 'sudah', 'makan', 'ubat', 'awak', 'tidak', 'nak', 'boleh']
    has_malay = any(w in text.lower().split() for w in malay_words)

    if has_chinese and has_singlish:
        return "singlish_mandarin_mix"
    if has_chinese:
        return "mandarin"
    if has_malay:
        return "malay"
    if has_singlish:
        return "singlish"
    return "english"


def _mock_detect_intent(text: str) -> str:
    """Simple intent detection for mock mode."""
    lower = text.lower()
    
    # Massively expanded food keywords - 10x more coverage
    food_kw = [
        # Eating verbs & meal context
        'ate', 'eat', 'eating', 'eaten', 'lunch', 'dinner', 'breakfast', 'snack', 
        'meal', 'food', 'had', 'just had', 'having', 'consumed', 'consumed', 'finished',
        'munching', 'chewing', 'swallowed', 'gulped', 'dined', 'feasted', 'tasty',
        'delicious', 'yummy', 'nom nom', 'hungry', 'fed', 'stuffed',
        
        # Singapore Hawker Classics
        'chicken rice', 'hainanese chicken', 'roasted chicken', 'poached chicken',
        'char kway teow', 'kway teow', 'stir fried noodles', 'fried kuay teow',
        'nasi lemak', 'nasi lemah', 'nasi goreng', 'nasi kuning', 'nasi kunyit',
        'roti prata', 'roti canai', 'paratha', 'thosai', 'dosai', 'uthappam',
        'hokkien mee', 'hokkien', 'mee goreng', 'mee rebus', 'mee rubus', 'mei fun',
        'laksa', 'laksa lemak', 'laksa johor', 'curry laksa', 'asam laksa',
        'curry mee', 'curry noodles', 'bee hoon', 'rice vermicelli',
        'fried rice', 'egg fried rice', 'pineapple rice', 'fried noodles',
        'wonton mee', 'wanton noodles', 'kolo mee', 'loh mee', 'lou mei',
        
        # Meat & Protein dishes
        'chicken cutlet', 'fish and chips', 'fried fish', 'grilled fish', 'steamed fish',
        'satay', 'sate', 'skewers', 'bbq', 'barbecue', 'grilled meat', 'roasted meat',
        'spring roll', 'spring rolls', 'egg roll', 'popiah', 'lumpia', 'pancake roll',
        'chicken wings', 'chicken lollipops', 'drumstick', 'thigh meat', 'breast meat',
        'pork', 'beef', 'mutton', 'lamb', 'fish', 'shrimp', 'prawn', 'crab', 'squid',
        'meat pie', 'curry puff', 'puff', 'pastry',
        
        # Rice & Noodle Bases
        'biryani', 'pilau', 'pulao', 'fried rice', 'steamed rice', 'brown rice',
        'jasmine rice', 'basmati', 'long grain', 'short grain',
        'pasta', 'spaghetti', 'fettuccine', 'penne', 'macaroni', 'lasagna',
        'rice noodles', 'egg noodles', 'instant noodles', 'ramen', 'udon', 'soba',
        
        # Western & International
        'pizza', 'pizza pie', 'margherita', 'pepperoni', 'pasta carbonara', 'bolognese',
        'burger', 'cheeseburger', 'hamburger', 'fries', 'chips', 'french fries',
        'fried chicken', 'kfc', 'mcdonald', 'mcd', 'burger king', 'subway', 'jollibee',
        'sandwich', 'hotdog', 'deli', 'wrap', 'tortilla', 'quesadilla', 'taco',
        
        # Asian dishes
        'dim sum', 'har gow', 'siu mai', 'yum cha', 'dumplings', 'congee', 'jook',
        'porridge', 'rice porridge', 'chicken porridge', 'fish porridge',
        'wonton soup', 'ramen', 'tonkotsu', 'miso soup', 'tom yum', 'pad thai',
        'pho', 'banh mi', 'gyoza', 'dumplings', 'momo', 'samosa',
        'tandoori', 'masala', 'curry', 'dal', 'chapati', 'naan', 'idli',
        
        # Baked & Sugary
        'bread', 'loaf', 'toast', 'bagel', 'croissant', 'donut', 'pastry',
        'cake', 'cupcake', 'cheesecake', 'brownie', 'cookie', 'biscuit',
        'muffin', 'scone', 'pie', 'tart', 'dessert', 'sweet dessert',
        'chocolate', 'candy', 'taffy', 'lollipop', 'marshmallow', 'gummies',
        'pudding', 'custard', 'gelato', 'ice cream', 'sorbet', 'yao guo',
        'wafer', 'biscuit', 'cracker', 'pretzel', 'granola', 'cereal',
        
        # Breakfast items
        'toast', 'jam', 'butter', 'eggs', 'omelette', 'scrambled', 'fried egg',
        'bacon', 'sausage', 'ham', 'hash brown', 'pancake', 'waffle', 'syrup',
        'oatmeal', 'porridge', 'granola', 'yogurt', 'milk', 'cheese',
        
        # Beverages (often eaten with food)
        'coffee', 'kopi', 'kopi-o', 'kopi-c', 'cappuccino', 'latte', 'espresso',
        'tea', 'teh', 'teh-o', 'teh-c', 'green tea', 'black tea', 'oolong',
        'juice', 'orange juice', 'apple juice', 'carrot juice', 'fruit juice',
        'soft drink', 'coke', 'pepsi', 'sprite', 'fanta', 'soda', 'carbonated',
        'beer', 'wine', 'alcohol', 'spirits', 'whisky', 'vodka',
        'smoothie', 'milkshake', 'shake', 'bubble tea', 'boba', 'milk tea',
        
        # Condiments & additions
        'gravy', 'sauce', 'ketchup', 'soy sauce', 'chilli', 'sambal', 'curry paste',
        'oil', 'butter', 'cheese', 'cream', 'mayo', 'dressing', 'vinegar',
        
        # Fruits & Veggies (as meals or sides)
        'apple', 'banana', 'orange', 'grape', 'mango', 'papaya', 'durian', 'mandarin',
        'watermelon', 'pineapple', 'strawberry', 'blueberry', 'kiwi', 'dragon fruit',
        'vegetable', 'broccoli', 'carrot', 'spinach', 'lettuce', 'cabbage', 'tomato',
        'potato', 'sweet potato', 'corn', 'peas', 'beans', 'mushroom', 'onion',
        'salad', 'coleslaw', 'stir fried veg', 'steamed veg',
        
        # Malay/Mandarin meal words
        'makan', 'makanan', 'nasi', 'mee', 'goreng', 'kuey', 'lontong', 'lemang',
        '吃', '饭', '面', '米', '午餐', '晚餐', '早餐', '零食', '食物', '吃饭',
        '炒粿条', '鸡饭', '叻沙', '糕点', '面条', '米粉', '馄饨', '汤面',
        '饺子', '春卷', '炒饭', '拌面', '炒面', '汤',
    ]
    
    # Massively expanded medication keywords - 10x more coverage
    med_kw = [
        # Medication action verbs
        'medicine', 'medication', 'medicinal', 'drug', 'dose', 'dosage', 'tablet', 
        'pill', 'capsule', 'injection', 'jab', 'intravenous', 'iv', 
        'took', 'take', 'taking', 'taken', 'consumed', 'consume', 'consumed', 
        'ingest', 'ingested', 'swallow', 'swallowed', 'had my', 'had a',
        'applied', 'apply', 'inject', 'injected', 'drank', 'drink', 'smeared',
        
        # Diabetes medications
        'metformin', 'glucophage', 'gliclazide', 'diamicron', 'glipizide', 'amaryl',
        'repaglinide', 'nateglinide', 'pioglitazone', 'rosiglitazone', 'avandia',
        'sitagliptin', 'januvia', 'vildagliptin', 'galvus', 'saxagliptin',
        'linagliptin', 'alogliptin', 'empagliflozin', 'jardiance', 'dapagliflozin',
        'forxiga', 'canagliflozin', 'invokana', 'ertugliflozin', 'segluromet',
        'insulin', 'humalog', 'lantus', 'levemir', 'tresiba', 'insulin glargine',
        'insulin aspart', 'insulin lispro', 'insulin glulisine', 'novorapid',
        'acarbose', 'miglitol', 'voglibose', 'precose', 'glyset',
        'sulfonylureas', 'glyburide', 'glibenclamide', 'tolbutamide',
        
        # Blood Pressure medications
        'lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan', 'olmesartan',
        'amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine',
        'atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'propranolol',
        'chlorthalidone', 'hydrochlorothiazide', 'hctz', 'furosemide', 'bumetanide',
        'spironolactone', 'amiloride', 'triamterene',
        
        # Cholesterol medications
        'atorvastatin', 'simvastatin', 'pravastatin', 'rosuvastatin', 'lovastatin',
        'ezetimibe', 'bempedoic acid', 'pcsk9 inhibitor', 'evolocumab', 'alirocumab',
        'inclisiran', 'pitavastatin', 'fluvastatin',
        
        # Blood thinners & antiplatelet
        'aspirin', 'clopidogrel', 'plavix', 'warfarin', 'coumadin', 'dabigatran',
        'apixaban', 'rivaroxaban', 'edoxaban', 'argatroban', 'ticagrelor',
        
        # Pain & Inflammation
        'paracetamol', 'acetaminophen', 'tylenol', 'ibuprofen', 'advil', 'motrin',
        'naproxen', 'aleve', 'meloxicam', 'indomethacin', 'diclofenac',
        'aspirin', 'ketorolac', 'toradol', 'piroxicam', 'tenoxicam',
        'analgesic', 'pain reliever', 'painkiller', 'pain medication',
        
        # Antibiotics
        'amoxicillin', 'penicillin', 'cephalexin', 'azithromycin', 'doxycycline',
        'ciprofloxacin', 'levofloxacin', 'metronidazole', 'sulfamethoxazole',
        'fluconazole', 'ketoconazole', 'terbinafine', 'erythromycin',
        
        # Other common meds
        'multivitamin', 'vitamin', 'supplement', 'mineral', 'mineral supplement',
        'probiotic', 'prebiotic', 'omega-3', 'fish oil', 'flaxseed', 'iron',
        'calcium', 'magnesium', 'potassium', 'zinc', 'vitamin c', 'vitamin d',
        'vitamin b', 'b-complex', 'folic acid', 'biotin', 'niacin',
        'antacid', 'tums', 'gaviscon', 'omeprazole', 'lansoprazole', 'pantoprazole',
        'metoclopramide', 'domperidone', 'loperamide', 'diphenoxylate',
        'antihistamine', 'cetirizine', 'loratadine', 'fexofenadine', 'diphenhydramine',
        'decongestant', 'pseudoephedrine', 'phenylephrine', 'xylometazoline',
        'cough syrup', 'dextromethorphan', 'guaifenesin', 'expectorant',
        'sleeping pill', 'melatonin', 'diphenhydramine', 'zolpidem', 'ambien',
        'antidepressant', 'sertraline', 'fluoxetine', 'paroxetine', 'citalopram',
        'anti-anxiety', 'lorazepam', 'alprazolam', 'diazepam', 'buspirone',
        
        # Traditional/Herbal (common in Singapore)
        'traditional medicine', 'herbal', 'chinese medicine', 'tcm', 'ayurvedic',
        'ginseng', 'cordyceps', 'reishi', 'shiitake', 'lingzhi',
        'turmeric', 'curcumin', 'ginger', 'garlic', 'honey',
        'jamu', 'balm', 'tiger balm', 'medicated oil', 'muscle rub',
        
        # Other terms
        'syrup', 'liquid', 'oral suspension', 'powder', 'cream', 'ointment', 'patch',
        'spray', 'inhaler', 'nebulizer', 'implant', 'suppository',
        'ubat', 'ubatan', 'makan ubat', 'ambil ubat', 'obat', 'obatan',
        '药', '吃药', '打针', '注射', '胰岛素', '血压药', '降糖药',
    ]
    
    # Massively expanded glucose/symptom keywords - 10x more coverage
    glucose_kw = [
        'glucose', 'blood glucose', 'blood sugar', 'sugar', 'sugar level', 'reading', 'level',
        'mmol', 'mg/dl', 'fasting', 'post meal', 'postprandial', 'pre-meal', 'premeal',
        'glucose test', 'blood test', 'checked', 'measured', 'tested',
        '血糖', '血糖读数', '消化值', 'gula darah', 'gula', 'kadar gula',
        'spike', 'spikes', 'spiking', 'drop', 'drops', 'dropping', 'dips',
        'fluctuat', 'fluctuating', 'unstable', 'manage', 'control', 'monitor',
        'high', 'too high', 'very high', 'elevated', 'hyperglycemia',
        'low', 'too low', 'very low', 'hypoglycemia', 'hypo',
    ]
    
    # Massively expanded symptom keywords - 10x more coverage
    symptom_kw = [
        # High/Low glucose indicators
        'high', 'low', 'too high', 'too low', 'very high', 'elevated', 'raised',
        'tinggi', 'rendah', 'terlalu tinggi', 'terlalu rendah', 'meningkat',
        '高', '低', '太高', '太低', '偏高', '偏低', '升高', '症状',
        
        # Fatigue/Energy related (EXTENSIVE)
        'tired', 'tiredness', 'fatigue', 'fatigued', 'exhausted', 'exhaustion',
        'sleepy', 'drowsy', 'somnolent', 'lethargy', 'lethargic', 'weak', 'weakness',
        'no energy', 'energy loss', 'sluggish', 'lethargic', 'unmotivated', 'apathetic',
        'brain fog', 'foggy', 'mental fatigue', 'concentration', 'focus', 'remember',
        'lazy', 'sluggish', 'slow', 'sluggish movements', 'slow movements',
        'lesu', 'penat', 'lelah', 'senak', 'tak ada tenaga', 'tenaga kurang', 'logam',
        '疲劳', '疲倦', '无力', '没精神', '乏力', '困', '累', '疲惫', '虚弱',
        
        # Dizziness/Neurological (EXTENSIVE)
        'dizzy', 'dizziness', 'vertigo', 'lightheaded', 'faint', 'fainting', 'woozy',
        'unsteady', 'balance problem', 'loss of balance', 'ataxia',
        'numb', 'numbness', 'tingling', 'pins and needles', 'prickling', 'paresthesia',
        'tingling sensation', 'burning', 'burning sensation', 'neuropathic pain',
        'pain', 'ache', 'soreness', 'hurt', 'aching', 'tender', 'tenderness',
        'sharp pain', 'dull pain', 'throbbing', 'stabbing', 'aching', 'sore',
        'muscle pain', 'joint pain', 'bone pain', 'nerve pain',
        'neuropathy', 'peripheral neuropathy', 'diabetic neuropathy',
        'pusing', 'pusing kepala', 'kepala berputar', 'kebas', 'kesemutan',
        'sakit', 'nyeri', 'sakitan', 'pedih', 'terasa aneh',
        '头晕', '眩晕', '麻木', '刺痛', '酸痛', '疼痛', '神经痛', '四肢无力',
        
        # Vision related (EXTENSIVE)
        'blurred', 'blurry', 'blur', 'blurred vision', 'vision changes', 'sight',
        'eye', 'eyes', 'eye problem', 'seeing double', 'double vision', 'diplopia',
        'floaters', 'spots', 'black spots', 'flashes', 'cataracts', 'glaucoma',
        'presbyopia', 'myopia', 'hyperopia', 'astigmatism', 'tunnel vision',
        'light sensitivity', 'photophobia', 'dry eyes', 'eye strain',
        '模糊', '视物不清', '眼睛', '看不清', 'kabur', 'penglihatan', 'mata',
        '视力下降', '视物模糊', '眼花', '看东西模糊', '重影', '眼睛不适',
        
        # Thirst/Urination (EXTENSIVE)
        'thirsty', 'thirst', 'dry mouth', 'cotton mouth', 'parched', 'drought',
        'urinate', 'pee', 'wee', 'frequent urination', 'urinating often', 'polyuria',
        'often', 'frequently', 'lot', 'lots', 'excessive', 'excessively',
        'nighttime urination', 'nocturia', 'bedwetting', 'enuresis',
        'urgency', 'urgent', 'need to pee', 'cannot hold', 'urgency incontinence',
        'mouth dry', 'lips dry', 'tongue dry', 'dry throat',
        '口渴', '尿频', '上厕所多', 'haus', 'sering kencing', 'buang air kecil sering',
        '频尿', '多尿', '夜间尿频', '口干', '嘴干', '口腔干燥',
        
        # Nausea/GI (EXTENSIVE)
        'nausea', 'nauseated', 'sick', 'vomit', 'vomiting', 'vomited', 'puke', 'puking',
        'nauseous', 'queasy', 'feels sick', 'gastric', 'stomach upset', 'stomach pain',
        'heartburn', 'indigestion', 'upset stomach', 'abdominal pain', 'belly pain',
        'diarrhea', 'constipation', 'loose stool', 'hard stool', 'irregular bowel',
        'appetite', 'loss of appetite', 'anorexia', 'no appetite', 'eating less',
        'bulking', 'cramping', 'crampy', 'diarrhea', 'cramps',
        'mual', 'muntah', 'sakit perut', 'perut tidak enak', 'mulas', 'diare',
        '恶心', '呕吐', '想吐', '胃痛', '腹痛', '腹泻', '便秘', '消化不良',
        
        # Headache/Neurological
        'headache', 'head ache', 'migraine', 'throbbing headache', 'tension headache',
        'headaches', 'head pain', 'skull pressure', 'temple pain',
        'shaking', 'tremor', 'trembling', 'shaky', 'shivering', 'chills',
        'sweating', 'sweat', 'perspiration', 'sweaty', 'perspiring',
        'fever', 'feverish', 'hot', 'cold', 'hot and cold',
        'chills', 'cold sweats', 'night sweats', 'hot flashes',
        'sakit kepala', 'migrain', 'gemetar', 'menggigil', 'keringat',
        '头痛', '偏头痛', '发抖', '出汗', '寒冷', '发烧', '虚汗', '冷汗',
        
        # Skin/Infection (EXTENSIVE)
        'rash', 'skin rash', 'irritation', 'itching', 'itchy', 'itch', 'scratching',
        'wound', 'wounds', 'wound care', 'sore', 'sores', 'boil', 'boils', 'abscess',
        'infection', 'infected', 'bacterial', 'fungal', 'yeast', 'candida',
        'pus', 'pussy', 'discharge', 'drainage', 'weeping', 'moisture',
        'dry skin', 'cracked skin', 'peeling', 'scaly', 'flaky',
        'bruise', 'bruising', 'discoloration', 'dark spot', 'ulcer', 'ulceration',
        'gatal', 'gatal-gatal', 'luka', 'infeksi', 'bisul', 'getah', 'nanah',
        '皮疹', '痒', '伤口', '感染', '粉刺', '溃疡', '皮肤干燥', '黑斑',
        
        # Emotional/Mental
        'anxious', 'anxiety', 'worried', 'worry', 'stress', 'stressed', 'depressed',
        'depression', 'mood', 'irritable', 'irritability', 'angry', 'mood swings',
        'emotional', 'sadness', 'hopeless', 'hopelessness', 'crying', 'panic',
        
        # Cardiovascular
        'chest pain', 'chest tightness', 'palpitations', 'heart racing', 'tachycardia',
        'pressure in chest', 'shortness of breath', 'breathless', 'breathlessness',
        'dyspnea', 'wheezing', 'asthma', 'heart attack', 'stroke', 'angina',
    ]

    # Check medication BEFORE food — "ate medicine" should be medication, not meal
    has_med = any(k in lower for k in med_kw)
    has_food = any(k in lower for k in food_kw)
    if has_med:
        return "report_medication"
    if has_food:
        return "report_meal"
    if any(k in lower for k in glucose_kw):
        return "report_glucose"
    if any(k in lower for k in symptom_kw):
        return "report_symptom"
    return "general_chat"


def _mock_extract_entities(text: str) -> dict:
    """Extract food, medication, and glucose entities from text in mock mode."""
    entities = {}
    lower = text.lower()

    # Comprehensive food list (~150 items) - Singapore/SEA/Western
    foods = [
        # Chicken dishes
        'chicken rice', 'hainanese chicken', 'roasted chicken', 'chicken cutlet',
        'chicken lollipops', 'chicken wing', 'ayam', 'chicken leg', 'boneless chicken',
        # Noodle dishes
        'char kway teow', 'hokkien mee', 'mee goreng', 'mee rebus', 'laksa', 'curry mee',
        'bee hoon', 'wonton mee', 'kolo mee', 'loh mee', 'chow mein', 'lo mein',
        'pad thai', 'pho', 'ramen', 'udon', 'soba', 'crispy noodles', 'egg noodles',
        'rice noodles', 'wheat noodles', 'vermicelli', 'sotanghon', 'mee pok',
        # Rice dishes
        'fried rice', 'nasi goreng', 'nasi lemak', 'nasi kuning', 'biryani', 'risotto',
        'congee', 'porridge', 'arroz caldo', 'rice bowl', 'steamed rice',
        # Indian
        'roti prata', 'thosai', 'dosai', 'idumpuri', 'nan bread', 'paratha', 'puttu',
        'idli', 'samosa', 'pakora', 'bhaji', 'tandoori', 'curry', 'dhal',
        # Dim sum & dumplings
        'dim sum', 'siu mai', 'har gow', 'dumpling', 'wonton', 'gyoza', 'jiaozi',
        'xiaolongbao', 'shumai', 'cheong fun', 'turnip cake', 'chicken feet',
        # Seafood
        'fish and chips', 'grilled fish', 'fried fish', 'fish cake', 'prawn', 'shrimp',
        'squid', 'octopus', 'fish fillet', 'salmon', 'tuna', 'crab', 'lobster',
        'cockles', 'clams', 'mussels', 'fish head curry',
        # Western
        'pizza', 'pasta', 'burger', 'fried chicken', 'sandwich', 'hotdog',
        'steak', 'chicken chop', 'ribs', 'beef', 'pork', 'lamb', 'salad',
        'omelette', 'fried egg', 'scrambled egg', 'egg', 'bacon', 'ham',
        # Breads & grains
        'bread', 'toast', 'baguette', 'croissant', 'bagel', 'muffin', 'scone',
        'biscuit', 'cracker', 'cereal', 'granola', 'oatmeal', 'cornflakes',
        # Vegetables & fruits
        'apple', 'banana', 'orange', 'mango', 'pineapple', 'papaya', 'grapes',
        'watermelon', 'melon', 'strawberry', 'blueberry', 'berry', 'kiwi',
        'carrot', 'broccoli', 'spinach', 'lettuce', 'cabbage', 'cucumber',
        'tomato', 'potato', 'sweet potato', 'corn', 'peas', 'beans', 'mushroom',
        # Sweets
        'cake', 'cookie', 'biscuit', 'donut', 'pastry', 'dessert', 'chocolate',
        'candy', 'ice cream', 'pudding', 'jelly', 'kueh', 'kuehlapis', 'brownie',
        'mochi', 'ice popsicle', 'chendol', 'cendol', 'pisang goreng',
        # Beverages
        'coffee', 'kopi', 'tea', 'teh', 'juice', 'soft drink', 'soda', 'coke',
        'sprite', 'fanta', 'water', 'milk', 'soy milk', 'drinks', 'beverage',
        'smoothie', 'milkshake', 'latte', 'cappuccino', 'espresso', 'oolong',
        # Mandarin translations
        '炒粿条', '鸡饭', '叻沙', '糕点', '面条', '米粉', '馄饨', '汤面',
        '炒饭', '鸭饭', '鱼饭', '肉饭', '蔬菜', '水果', '肉', '鸡',
        # Malay
        'makan', 'makanan', 'nasi', 'mee', 'ayam', 'ikan', 'udang',
        # Singlish slang
        'carb', 'protein', 'fish', 'chicken', 'pork chop', 'ribs'
    ]
    for f in foods:
        if f in lower or f in text:
            entities["food"] = f
            break

    # Comprehensive medication list (~200 items)
    meds = [
        # Diabetes medications
        'metformin', 'gliclazide', 'glipizide', 'glibenclamide', 'repaglinide',
        'pioglitazone', 'rosiglitazone', 'sitagliptin', 'vildagliptin', 'linagliptin',
        'saxagliptin', 'empagliflozin', 'dapagliflozin', 'canagliflozin', 'ertugliflozin',
        'insulin glargine', 'insulin aspart', 'insulin lispro', 'insulin detemir',
        'insulin degludec', 'insulin', 'lantus', 'humalog', 'novorapid', 'apidra',
        'levemir', 'tresiba', 'mixtard', 'humulin', 'novomix', 'actraphane',
        'dulaglutide', 'liraglutide', 'semaglutide', 'exenatide', 'albiglutide',
        'acarbose', 'miglitol', 'voglibose', 'rosiglitazone', 'alogliptin',
        
        # Blood pressure medicines
        'lisinopril', 'enalapril', 'ramipril', 'perindopril', 'quinapril',
        'losartan', 'valsartan', 'irbesartan', 'olmesartan', 'candesartan',
        'amlodipine', 'diltiazem', 'verapamil', 'nifedipine', 'felodipine',
        'bisoprolol', 'atenolol', 'metoprolol', 'carvedilol', 'labetalol',
        'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'furosemide', 'spironolactone',
        
        # Cholesterol medicines
        'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin',
        'ezetimibe', 'fenofibrate', 'gemfibrozil', 'bezafibrate', 'ciprofibrate',
        'niacin', 'nicotinic acid', 'bempedoic acid', 'inclisiran', 'pcsk9',
        
        # Anticoagulants & antiplatelet
        'aspirin', 'clopidogrel', 'ticlopidine', 'prasugrel', 'ticagrelor',
        'warfarin', 'heparin', 'enoxaparin', 'dalteparin', 'fondaparinux',
        'apixaban', 'rivaroxaban', 'edoxaban', 'dabigatran', 'betrixaban',
        
        # Pain relief
        'paracetamol', 'acetaminophen', 'ibuprofen', 'naproxen', 'indomethacin',
        'diclofenac', 'meloxicam', 'piroxicam', 'celecoxib', 'etoricoxib',
        'tramadol', 'codeine', 'morphine', 'fentanyl', 'oxycodone',
        
        # Antibiotics
        'amoxicillin', 'ampicillin', 'penicillin', 'cephalexin', 'cephalosporin',
        'azithromycin', 'erythromycin', 'clarithromycin', 'tetracycline', 'doxycycline',
        'ciprofloxacin', 'levofloxacin', 'ofloxacin', 'norfloxacin', 'moxifloxacin',
        'trimethoprim', 'sulfamethoxazole', 'metronidazole', 'tinidazole',
        
        # Thyroid
        'levothyroxine', 'thyroxine', 'liothyronine', 'propylthiouracil',
        'methimazole', 'carbimazole',
        
        # Vitamins & supplements
        'vitamin', 'vitamin a', 'vitamin b', 'vitamin c', 'vitamin d', 'vitamin e',
        'multivitamin', 'supplement', 'zinc', 'iron', 'calcium', 'magnesium',
        'omega 3', 'fish oil', 'probiotics', 'chromium', 'cinnamon',
        
        # Respiratory
        'salbutamol', 'albuterol', 'ipratropium', 'tiotropium', 'salmeterol',
        'fluticasone', 'beclomethasone', 'budesonide', 'omalizumab',
        
        # GI & others
        'omeprazole', 'lansoprazole', 'pantoprazole', 'ranitidine', 'famotidine',
        'domperidone', 'metoclopramide', 'ondansetron', 'loperamide', 'bisacodyl',
        'dulcolax', 'lactulose', 'docusate', 'senna',
        
        # Traditional medicine
        'chinese medicine', 'herbal', 'ginseng', '红参', '人参', '冬虫夏草',
        '虫草', '黄芪', '党参', '灵芝', '三七', '丹参', '麦冬',
        
        # Generic terms
        'medicine', 'medication', 'drug', 'tablet', 'pill', 'capsule', 'injection',
        'syringe', 'inhaler', 'spray', 'ointment', 'cream', 'patch', 'drops',
        'ubat', 'ubatan', 'ubat-ubatan', 'dadah', 'pil', 'tablet',
        'meds', 'med', 'pharmaceutical', 'pharma'
    ]
    for m in meds:
        if m in lower:
            entities["medication"] = m
            break

    # Enhanced glucose value extraction
    # Pattern 1: Number with unit (e.g. "11.2 mmol", "200 mg/dl")
    glucose_match = re.search(r'(\d+\.?\d*)\s*(?:mmol|mg|mg\/dl|mgdl|mgl|mmol\/l)', lower)
    # Pattern 2: "glucose/sugar/blood sugar <value>" (in English)
    if not glucose_match:
        glucose_match = re.search(r'(?:glucose|sugar|blood sugar|readings?|level)[^\d]*(\d+\.?\d*)', lower)
    # Pattern 3: Chinese patterns (e.g. "血糖是11.2", "血糖11.2", "糖值11.2")
    if not glucose_match:
        glucose_match = re.search(r'(?:血糖|血糖值|glucose)[^\d]*(\d+\.?\d*)', lower + text)
    # Pattern 4: Malay patterns (e.g. "gula 11.2", "bacaan 11.2")
    if not glucose_match:
        glucose_match = re.search(r'(?:gula|bacaan|nilai)[^\d]*(\d+\.?\d*)', lower)
    # Pattern 5: Singlish patterns (e.g. "reading is 11.2", "is 11.2")
    if not glucose_match:
        glucose_match = re.search(r'is\s+(\d+\.?\d*)', lower)
    
    if glucose_match:
        entities["value"] = glucose_match.group(1)

    logger.debug("Extracted entities: %s", entities)
    return entities


async def understand_input(text: str) -> dict:
    """Understand patient input — detect language, intent, and entities."""
    if USE_MOCK:
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        entities = _mock_extract_entities(text)
        logger.info("Mock understand_input: lang=%s, intent=%s", lang, intent)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": entities,
            "english_text": text,
            "original_text": text,
        }

    # Real SEA-LION API call
    system_prompt = """You are a multilingual language understanding model for a Singapore healthcare app.
Given patient input (which may be in English, Mandarin, Malay, Singlish, or a mix), return JSON:
{
  "detected_language": "mandarin|malay|singlish|english|singlish_mandarin_mix",
  "intent": "report_meal|report_medication|report_glucose|ask_question|report_symptom|general_chat",
  "entities": {"food": "...", "medication": "...", "value": "..."},
  "english_text": "Normalised English translation",
  "original_text": "Original input as-is"
}
Return JSON only."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SEALION_API_URL}/chat/completions",
                headers={"Authorization": f"Bearer {SEALION_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "sea-lion-7b-instruct",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            result = json.loads(raw)
            logger.info("SEA-LION API understand_input: lang=%s, intent=%s", result.get("detected_language"), result.get("intent"))
            return result
    except Exception as e:
        # Fallback to mock
        logger.warning("SEA-LION API failed, falling back to mock: %s", e)
        lang = _mock_detect_language(text)
        intent = _mock_detect_intent(text)
        entities = _mock_extract_entities(text)
        return {
            "detected_language": lang,
            "intent": intent,
            "entities": entities,
            "english_text": text,
            "original_text": text,
        }


def _mock_localise_response(english_text: str, target_language: str) -> str:
    """Mock localisation - transform English into other Singapore languages without API."""
    if target_language == "english":
        return english_text

    # Simple translation mappings for common healthcare phrases
    translations = {
        "mandarin": {
            "Your blood sugar is": "您的血糖",
            "a bit high": "有点偏高",
            "too high": "太高",
            "a bit low": "有点偏低",
            "carbs": "碳水化合物",
            "Try a short walk": "建议散步",
            "after your meal": "饭后",
            "medication": "药物",
            "Take your": "请服用你的",
        },
        "malay": {
            "Your blood sugar is": "Gula darah awak",
            "a bit high": "agak tinggi",
            "too high": "terlalu tinggi",
            "a bit low": "agak rendah",
            "carbs": "karbohidrat",
            "Try a short walk": "Cuba jalan kaki",
            "after your meal": "selepas makan",
            "medication": "ubat",
        },
        "singlish": {
            "Your": "Your",  # Keep structure, add particles
            "Try": "Try",
        },
    }

    result = english_text

    if target_language == "mandarin":
        # Simple phrase substitution for demo
        for en, cn in translations["mandarin"].items():
            result = result.replace(en, cn)
        logger.debug("Mock Mandarin localisation applied")

    elif target_language == "malay":
        for en, ms in translations["malay"].items():
            result = result.replace(en, ms)
        logger.debug("Mock Malay localisation applied")

    elif target_language == "singlish":
        # Add Singlish particles to sentence endings
        particles = ["lah", "leh", "lor", "meh"]
        sentences = result.split(". ")
        localised = []
        for i, sent in enumerate(sentences):
            if sent.strip() and not sent.strip().endswith(("!", "?", "lah", "leh", "lor")):
                particle = particles[i % len(particles)]
                localised.append(f"{sent.strip()} {particle}")
            else:
                localised.append(sent.strip())
        result = ". ".join(localised)
        logger.debug("Mock Singlish localisation applied")

    elif target_language == "singlish_mandarin_mix":
        # Mix English with some Mandarin and particles
        # Apply some Mandarin first
        for en, cn in translations["mandarin"].items():
            if en.lower() in result.lower():
                result = result.replace(en, f"{cn} ({en})")
        # Add particles
        sentences = result.split(". ")
        localised = []
        for i, sent in enumerate(sentences):
            if sent.strip() and not sent.strip().endswith(("!", "?", "lah", "leh", "lor")):
                particle = ["lah", "leh", "lor"][i % 3]
                localised.append(f"{sent.strip()} {particle}")
            else:
                localised.append(sent.strip())
        result = ". ".join(localised)
        logger.debug("Mock Singlish/Mandarin mix localisation applied")

    return result


async def localise_response(english_text: str, target_language: str) -> str:
    """Translate Claude's English response to the patient's detected language."""
    if target_language == "english":
        return english_text

    if USE_MOCK:
        return _mock_localise_response(english_text, target_language)

    style_guides = {
        "singlish": 'Use Singlish particles (lah, leh, lor). Keep medical terms in English. Casual tone.',
        "mandarin": 'Translate to polite, warm Mandarin Chinese. Use 您 for elderly patients. Keep food and medication names in their original language.',
        "singlish_mandarin_mix": 'Mix English, Mandarin and Singlish naturally like a real Singaporean would speak.',
        "malay": 'Translate to polite Bahasa Melayu. Keep food and medication names in original language.',
    }
    style = style_guides.get(target_language, "Return as-is in English.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SEALION_API_URL}/chat/completions",
                headers={"Authorization": f"Bearer {SEALION_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "sea-lion-7b-instruct",
                    "messages": [
                        {"role": "system", "content": f"Localise this English health advice. {style} Never translate food or medication names."},
                        {"role": "user", "content": english_text},
                    ],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            result = resp.json()["choices"][0]["message"]["content"]
            logger.info("SEA-LION localised response to %s", target_language)
            return result
    except Exception as e:
        logger.warning("SEA-LION localisation failed, returning English: %s", e)
        return english_text


