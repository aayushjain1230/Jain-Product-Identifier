from fastapi import FastAPI, File, UploadFile
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Optional
import base64
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)

# Load Non-Jain list
with open("non_jain_ingredients.txt", "r", encoding="utf-8") as f:
    non_jain_text = "\n".join(f.readlines())

SYSTEM_PROMPT = f"""
You are a Jain dietary compliance checker.
You must classify ingredients strictly based on this NON-JAIN list: {non_jain_text}

Rules:
1. Animal or microorganism-derived = NON-JAIN
2. Root vegetables = NON-JAIN
3. Above-ground plants = JAIN
4. Ambiguous ingredients = UNCERTAIN
"""

class IngredientResult(BaseModel):
    name: str
    reason: Optional[str] = None

class Summary(BaseModel):
    overall_jain_safe: bool
    non_jain_ingredients_found: List[str]
    note: Optional[str] = None

class OutputFormat(BaseModel):
    non_jain_ingredients: List[IngredientResult]
    uncertain_ingredients: List[IngredientResult]
    jain_ingredients: List[IngredientResult]
    summary: Summary

app = FastAPI(title="Jain Product Identifier")

@app.post("/is_jain")
async def identify_jain(image: UploadFile = File(...)):
    image_bytes = await image.read()
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    response = client.responses.parse(
        model="gpt-4o",
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "input_text", "text": "Analyze the ingredients in the label image."},
                {"type": "input_image", "image_url": f"data:image/jpeg;base64,{base64_image}"},
            ]}
        ],
        text_format=OutputFormat,
    )

    return response.output_parsed.model_dump()
