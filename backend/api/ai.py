import json
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from core.db import get_db
from models.dashboard import Dashboard
from models.chart import Chart
import uuid
import google.generativeai as genai

# Initialize key if present (users will set this in .env or environment)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

router = APIRouter(prefix="/api/ai", tags=["ai"])

class ChatMessage(BaseModel):
    role: str # "user" or "model"
    parts: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    schema_context: dict

class GenerateRequest(BaseModel):
    history: List[ChatMessage]
    schema_context: dict
    org_id: int
    source_id: int

SYSTEM_PROMPT = """
You are Dashmaxxing, an expert Data Analyst AI. 
Your goal is to figure out EXACTLY what dashboard the user wants to build based on the provided Data Schema.

CURRENT CAPABILITIES LIMITATION:
- You can ONLY generate Time-Series Line Charts, Bar Charts, and Pie Charts using basic SQL aggregations.
- You CANNOT build D3.js, custom complex UI, or predictive ML models. Advise the user gently if they request anything outside basic grouping/aggregations.

RULES:
- When the user states their goal, do NOT immediately generate code. 
- You MUST ask follow-up questions to understand dimensions, filters, and breakdowns they want to see to give them the BEST possible dashboard.
- You can judge when you have enough context. You have a MAXIMUM of 5 follow-up questions. Do not ask more than 5.
- If you feel you have enough context before reaching the 5-question limit, tell the user exactly: "I have enough context! Click Generate when you are ready."
- Keep your questions concise and conversational.
"""

@router.post("/chat")
async def chat_with_ai(request: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server. Please add it to your environment variables.")
    
    try:
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            system_instruction=SYSTEM_PROMPT
        )
        
        formatted_history = []
        
        # Gemini strictly requires the history sequence to begin with a User message.
        # We will dynamically prepend a hidden setup message containing the database schema context.
        formatted_history.append({
            "role": "user", 
            "parts": [f"This is the current database schema you have access to. Familiarize yourself with it:\n\nDATA SCHEMA:\n{json.dumps(request.schema_context)}\n\nUnderstand? Proceed to greet me."]
        })

        for msg in request.history:
            formatted_history.append({"role": msg.role, "parts": [msg.parts]})

        # The last message from the sequence is the one we actually want to 'send'
        last_msg = formatted_history.pop()

        chat = model.start_chat(history=formatted_history)
        
        response = chat.send_message(last_msg["parts"][0])
        return {"reply": response.text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_dashboard(request: GenerateRequest, db: AsyncSession = Depends(get_db)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server.")
        
    model = genai.GenerativeModel(
        model_name="gemini-flash-latest",
        system_instruction="You are an expert who outputs ONLY valid JSON representing a dashboard layout. Schema: {dashboard_name: string, charts: [{title: string, type: 'line'|'bar'|'pie', sql_query: string, layout: {w: int, h: int, x: int, y: int}}]}"
    )
    
    formatted_history = ""
    for msg in request.history:
         formatted_history += f"{msg.role.upper()}: {msg.parts}\n"
         
    prompt = f"Based on this SCHEMA context:\n{json.dumps(request.schema_context)}\n\nAnd this interaction history:\n{formatted_history}\n\nGenerate the JSON for the dashboard. Format it EXACTLY as the requested schema. Use the interaction history to decide on a good 'dashboard_name'. Return NOTHING but the JSON."
    
    response = model.generate_content(prompt)
    
    try:
        raw = response.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        
        # 1. Create Dashboard
        dashboard_name = parsed.get("dashboard_name", "AI Generated Dashboard")
        dashboard_slug = f"{dashboard_name.lower().replace(' ', '-')}-{str(uuid.uuid4())[:8]}"
        
        new_dashboard = Dashboard(
            name=dashboard_name,
            slug=dashboard_slug,
            org_id=request.org_id
        )
        db.add(new_dashboard)
        await db.flush() # Get the ID
        
        # 2. Create Charts
        for chart_data in parsed.get("charts", []):
            new_chart = Chart(
                title=chart_data["title"],
                type=chart_data["type"],
                sql_query=chart_data["sql_query"],
                layout=chart_data["layout"],
                dashboard_id=new_dashboard.id,
                source_id=request.source_id
            )
            db.add(new_chart)
        
        await db.commit()
        return {"dashboard_id": new_dashboard.id, "slug": new_dashboard.slug}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": "Failed to process AI response", "detail": str(e)}
