import os
import json
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/classify', methods=['POST'])
def classify_ingredients():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    image_data = file.read()

    # THE UPDATED PROMPT: Specifically asks for veg and vegan flags
    prompt = """
    Analyze the provided image of a food product's ingredient list. 
    Classify each ingredient into three categories: 'jain_ingredients', 'non_jain_ingredients', and 'uncertain_ingredients'.
    
    For EVERY ingredient found, also determine if it is Vegetarian and if it is Vegan.
    - 'is_veg': true if it contains no meat/fish/egg.
    - 'is_vegan': true if it contains no animal-derived products (dairy/honey/etc).

    Provide the output in strict JSON format with this structure:
    {
      "summary": {"note": "General assessment of the product"},
      "jain_ingredients": [{"name": "Ingredient Name", "is_veg": true, "is_vegan": true}],
      "non_jain_ingredients": [{"name": "Ingredient Name", "reason": "Why it is non-jain", "is_veg": true, "is_vegan": false}],
      "uncertain_ingredients": [{"name": "Ingredient Name", "reason": "Why it is uncertain", "is_veg": true, "is_vegan": true}]
    }
    """

    try:
        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_data}
        ])
        
        # Clean response text to ensure it's valid JSON
        json_text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(json_text)
        return jsonify(data)
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
