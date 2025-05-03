# main.py

from fastapi import FastAPI, Request, HTTPException, APIRouter, Query
from calendar_sync import create_event
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from task_ai import suggest_subtasks
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta

load_dotenv()  # ensure OPENAI_API_KEY is loaded

app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Google OAuth setup
CLIENT_SECRETS_FILE = "credentials.json"  # Downloaded from Google Cloud
SCOPES = ["https://www.googleapis.com/auth/calendar"]
REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI', 'http://localhost:8000/auth/callback')

# In-memory store (use MongoDB later)
user_sessions = {}

SESSION_FILE = "user_token.json"

# Load session from file if it exists
if os.path.exists(SESSION_FILE):
    with open(SESSION_FILE, "r") as f:
        try:
            user_sessions["user"] = json.load(f)
        except Exception:
            pass

# Serve static files
app.mount("/templates/static", StaticFiles(directory="../templates/static"), name="static")

# Template rendering
templates = Jinja2Templates(directory="../templates")

@app.get("/")
def home():
    return RedirectResponse(url="/frontend")

@app.get("/auth")
def auth():
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    auth_url, _ = flow.authorization_url(prompt='consent')
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
def auth_callback(request: Request):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Store token (basic example – secure this in prod)
    user_sessions["user"] = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }
    # Save session to file for persistence
    with open(SESSION_FILE, "w") as f:
        json.dump(user_sessions["user"], f)

    return HTMLResponse(content="<h2>✅ Auth Successful! You can now use the planner.</h2>")

@app.get("/calendar/events")
def list_events():
    if "user" not in user_sessions:
        raise HTTPException(status_code=401, detail="User not authenticated")

    creds = Credentials(**user_sessions["user"])
    service = build("calendar", "v3", credentials=creds)

    # Get today's date range
    now = datetime.utcnow()
    # Get time range from 12:00 AM to 12:00 PM
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
    noon = now.replace(hour=12, minute=0, second=0, microsecond=0).isoformat() + 'Z'

    events_result = service.events().list(
        calendarId="primary",
        timeMin=start_of_day,
        timeMax=noon,
        singleEvents=True,
        orderBy="startTime"
    ).execute()

    events = events_result.get("items", [])

    # Generate a full 24-hour timeline
    timeline = []
    for hour in range(24):
        time_label = (datetime(2000, 1, 1, hour, 0)).strftime('%I %p').lstrip('0')
        timeline.append({"time": time_label, "task": None})

    # Map tasks to the timeline
    for event in events:
        start = event.get("start", {}).get("dateTime", event.get("start", {}).get("date"))
        if start:
            start_hour = datetime.fromisoformat(start.replace('Z', '+00:00')).hour
            timeline[start_hour]["task"] = event.get("summary", "Untitled Event")

    return {"timeline": timeline}

class TaskRequest(BaseModel):
    task_summary: str
    task_description: str
    start_time: str
    end_time: str

class SuggestRequest(BaseModel):
    task_summary: str

@app.post("/create_task")
def create_task(task: TaskRequest):
    if "user" not in user_sessions:
        raise HTTPException(status_code=401, detail="User not authenticated")

    creds = user_sessions["user"]
    try:
        result = create_event(
            creds,
            task.task_summary,
            task.task_description,
            task.start_time,
            task.end_time
        )
        if result["status"] == "success":
            return {"message": f"Task '{result['event_summary']}' added to Google Calendar!"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create task")
    except Exception as e:
        import traceback
        print("Error in /create_task:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/suggest")
def suggest(request: SuggestRequest):
    try:
        subtasks = suggest_subtasks(request.task_summary)
        return {"subtasks": subtasks}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

# Initialize the router
router = APIRouter()

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.get("/ai/suggest-tasks")
async def suggest_tasks():
    prompt = (
        "Suggest 5 useful daily tasks for a productive person today. "
        "Return just the task titles, each on a new line."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        output = response.choices[0].message.content.strip()
        tasks = output.split("\n")
        return JSONResponse(content={"suggestions": tasks})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/ai/goal-suggestions")
async def goal_suggestions(goal: str = Query(...)):
    prompt = (
        f"Suggest 5 daily micro-tasks that will help a person achieve the goal: '{goal}'. "
        "Make each task title short and actionable."
    )
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    output = response.choices[0].message.content.strip()
    return {"suggestions": output.split("\n")}

# Add this before app.include_router calls
api_router = APIRouter(prefix="/api")

@api_router.post("/generate-content")
async def generate_content(request: Request):
    data = await request.json()
    prompt = data.get('prompt', '')
    if not prompt:
        return JSONResponse({"error": "No prompt provided"}, status_code=400)
    
    system_instruction = "You are a professional content writer. Generate short, engaging content for LinkedIn and Twitter based on this idea:"
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        return JSONResponse({"generatedContent": completion.choices[0].message.content.strip()})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/frontend", response_class=HTMLResponse)
def render_frontend(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

app.include_router(router)
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)