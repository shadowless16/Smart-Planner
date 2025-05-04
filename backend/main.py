# main.py

from fastapi import FastAPI, Request, HTTPException, APIRouter, Query
from calendar_sync import create_event
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json
import os.path
from pathlib import Path

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from task_ai import suggest_subtasks, get_mood_based_tasks
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta

load_dotenv()  # ensure OPENAI_API_KEY is loaded

app = FastAPI()

# CORS for frontend (support both local and production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://localhost:3000",
        "file://"  # Allow local file access during development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google OAuth setup
CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
SCOPES = ["https://www.googleapis.com/auth/calendar"]

# Get environment-specific redirect URI
def get_redirect_uri():
    env = os.getenv('ENVIRONMENT', 'development')
    if env == 'production':
        return 'https://smart-planner-dad4.onrender.com/auth/callback'
    return 'http://localhost:8000/auth/callback'

REDIRECT_URI = get_redirect_uri()

# In-memory store (use MongoDB later)
user_sessions = {}

SESSION_FILE = os.path.join(os.path.dirname(__file__), "user_token.json")

# Load session from file if it exists
if os.path.exists(SESSION_FILE):
    with open(SESSION_FILE, "r") as f:
        try:
            user_sessions["user"] = json.load(f)
        except Exception:
            pass

# Update static file and template serving with absolute paths and MIME types
BASE_DIR = Path(__file__).resolve().parent.parent
templates_dir = BASE_DIR / "templates"
static_dir = templates_dir / "static"

# Configure templates and static files
templates = Jinja2Templates(directory=str(templates_dir))
app.mount("/static", StaticFiles(directory=str(static_dir), html=True), name="static")

# Add a route to serve manifest.json with correct MIME type
@app.get("/manifest.json")
async def serve_manifest():
    manifest_path = static_dir / "manifest.json"
    return FileResponse(manifest_path, media_type="application/json")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Add a route for service worker
@app.get("/service-worker.js")
async def serve_service_worker():
    sw_path = static_dir / "service-worker.js"
    return FileResponse(sw_path, media_type="application/javascript")

@app.get("/auth")
def auth():
    try:
        if not os.path.exists(CLIENT_SECRETS_FILE):
            raise HTTPException(
                status_code=500,
                detail="Google OAuth credentials file (credentials.json) not found. Please configure your Google OAuth credentials."
            )
            
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )
        auth_url, _ = flow.authorization_url(prompt='consent')
        return RedirectResponse(auth_url)
    except Exception as e:
        print(f"Error in /auth: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Google OAuth flow: {str(e)}"
        )

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
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat() + 'Z'

    events_result = service.events().list(
        calendarId="primary",
        timeMin=start_of_day,
        timeMax=end_of_day,
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

class MoodTopicRequest(BaseModel):
    mood_or_topic: str

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

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize the routers
router = APIRouter(prefix="/api")  # Change the prefix to /api

@router.get("/suggest-tasks")  # Change from /ai/suggest-tasks
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

@router.get("/goal-suggestions")  # Change from /ai/goal-suggestions
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

@app.post("/generate-content")  # Changed from /api/generate-content
async def generate_content(request: Request):
    data = await request.json()
    prompt = data.get('prompt', '')
    if not prompt:
        return JSONResponse({"error": "No prompt provided"}, status_code=400)
    
    system_instruction = """You are a professional content writer. Generate two versions of content based on this idea:
    1. A LinkedIn post (professional, detailed, can be longer)
    2. A Twitter post (concise, engaging, maximum 280 characters)
    
    Format your response exactly like this:
    LinkedIn:
    [Your LinkedIn content here]

    Twitter:
    [Your Twitter content here]"""
    
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        return JSONResponse({"generatedContent": completion.choices[0].message.content.strip()})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/suggest-by-mood")
def suggest_by_mood(request: MoodTopicRequest):
    try:
        tasks = get_mood_based_tasks(request.mood_or_topic)
        return {"suggestions": tasks}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

# Mount the router at the end
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)