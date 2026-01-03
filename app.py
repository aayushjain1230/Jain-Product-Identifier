import os
import json
import re
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

PROMPT = """
Analyze the provided image of a product ingredient list. Return strict JSON only.
For each detected ingredient produce an object with:
- name: original ingredient string
- classification: one of "Jain", "Non-Jain", or "Uncertain"
- reason: short explanation (optional)
- is_veg: true or false (boolean)
- is_vegan: true or false (boolean)

The overall response must have this shape:
{
  "summary": {"note": "General assessment"},
  "jain_ingredients": [ ... ],
  "non_jain_ingredients": [ ... ],
  "uncertain_ingredients": [ ... ]
}
Do not include any extra commentary or markdown fences. If you return booleans as strings, they must be convertible to real booleans.
"""

def extract_json(text: str):
    # remove code fences if present
    text = re.sub(r"```(?:json)?", "", text, flags=re.I).strip()
    # try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # fallback: find first { or [ and last matching } or ]
    first_obj = min([i for i in (text.find('{') if text.find('{')!=-1 else len(text), text.find('[') if text.find('[')!=-1 else len(text))])
    if first_obj == len(text):
        return None
    # pick braces based on whichever appears first
    if text[first_obj] == '{':
        last = text.rfind('}')
    else:
        last = text.rfind(']')
    if last == -1:
        return None
    json_sub = text[first_obj:last+1]
    try:
        return json.loads(json_sub)
    except Exception:
        return None

def to_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("true", "yes", "y", "1")
    return False

def normalize_item(it: dict):
    return {
        "name": it.get("name", "") or "",
        "classification": (it.get("classification") or "").strip(),
        "reason": it.get("reason") or it.get("explanation") or "",
        "is_veg": to_bool(it.get("is_veg", False)),
        "is_vegan": to_bool(it.get("is_vegan", False))
    }

def group_items_from_list(items_list):
    output = {"jain_ingredients": [], "non_jain_ingredients": [], "uncertain_ingredients": []}
    for raw in items_list:
        if not isinstance(raw, dict):
            continue
        it = normalize_item(raw)
        cls = it["classification"].lower()
        if cls == "jain":
            output["jain_ingredients"].append(it)
        elif cls in ("non-jain", "nonjain", "non jain", "non_jain"):
            output["non_jain_ingredients"].append(it)
        else:
            output["uncertain_ingredients"].append(it)
    return output

@app.route('/')
def index():
    return render_template('index.html')

# New lightweight route for cron-job.org to keep the app awake
@app.route('/health')
def health_check():
    return "OK", 200

@app.route('/classify', methods=['POST'])
def classify_ingredients():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    image_data = file.read()

    try:
        response = model.generate_content([
            PROMPT,
            {"mime_type": "image/jpeg", "data": image_data}
        ])
        raw_text = (response.text or "").strip()
        parsed = extract_json(raw_text)

        result = {"summary": {"note": "No results returned by model."},
                  "jain_ingredients": [], "non_jain_ingredients": [], "uncertain_ingredients": []}

        if isinstance(parsed, dict):
            # If model already returned grouped object, normalize lists
            for key in ("jain_ingredients", "non_jain_ingredients", "uncertain_ingredients"):
                lst = parsed.get(key) or []
                if isinstance(lst, list):
                    result[key] = [normalize_item(x) for x in lst if isinstance(x, dict)]
            # carry summary if present
            if isinstance(parsed.get("summary"), dict) and parsed["summary"].get("note"):
                result["summary"] = {"note": parsed["summary"]["note"]}
            else:
                result["summary"] = {"note": f"Processed {sum(len(result[k]) for k in result if k.endswith('_ingredients'))} ingredient(s)."}
        elif isinstance(parsed, list):
            # model returned a flat list of items
            grouped = group_items_from_list(parsed)
            result.update(grouped)
            result["summary"] = {"note": f"Processed {len(parsed)} ingredient(s)."}
        else:
            # parsing failed; return helpful debug note in summary
            result["summary"] = {"note": "Could not parse model output as JSON."}

        return jsonify(result)

    except Exception as e:
        print("Error calling Gemini:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
