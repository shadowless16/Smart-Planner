# main.py

from fastapi import FastAPI, Request, HTTPException, APIRouter, Query
from calendar_sync import create_event
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json
import os.path
from pathlib import Path
from itsdangerous import URLSafeSerializer, BadSignature
import tempfile

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

def get_client_secrets_file():
    # Try to load credentials from environment variable first
    google_creds_env = os.getenv("GOOGLE_CREDENTIALS")
    if google_creds_env:
        # Write the credentials to a temporary file and return its path
        temp = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
        temp.write(google_creds_env.encode())
        temp.close()
        return temp.name
    # Fallback to credentials.json file
    return CLIENT_SECRETS_FILE

# Get environment-specific redirect URI
def get_redirect_uri():
    # Always use the Render.com production URL for OAuth callback
    return 'https://smart-planner-dad4.onrender.com/auth/callback'

REDIRECT_URI = get_redirect_uri()

# In-memory store (use MongoDB later)
user_sessions = {}

SECRET_KEY = os.getenv('COOKIE_SECRET', 'super-secret-key')
COOKIE_NAME = 'planner_token'
serializer = URLSafeSerializer(SECRET_KEY, salt='planner-google-oauth')

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
        secrets_file = get_client_secrets_file()
        if not os.path.exists(secrets_file):
            raise HTTPException(
                status_code=500,
                detail="Google OAuth credentials file (credentials.json) not found. Please configure your Google OAuth credentials."
            )
        flow = Flow.from_client_secrets_file(
            secrets_file,
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

    secrets_file = get_client_secrets_file()
    flow = Flow.from_client_secrets_file(
        secrets_file,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Store token in a secure cookie (per device)
    creds_dict = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }
    cookie_val = serializer.dumps(creds_dict)
    response = HTMLResponse(content="<h2>✅ Auth Successful! You can now use the planner.</h2>")
    response.set_cookie(
        key=COOKIE_NAME,
        value=cookie_val,
        httponly=True,
        max_age=60*60*24*30,  # 30 days
        samesite="lax"
    )
    return response

def get_user_creds(request: Request):
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=401, detail="User not authenticated")
    try:
        creds = serializer.loads(cookie)
        return creds
    except BadSignature:
        raise HTTPException(status_code=401, detail="Invalid session cookie")

@app.get("/calendar/events")
def list_events(request: Request, start: str = None, end: str = None):
    creds = get_user_creds(request)
    service = build("calendar", "v3", credentials=Credentials(**creds))
    from typing import Optional
    from datetime import datetime
    def clean_google_time(dt_str):
        # Remove Z if +00:00 is present, else keep Z
        if dt_str.endswith('Z') and ('+' in dt_str or '-' in dt_str):
            return dt_str[:-1]
        return dt_str
    # If start and end are provided, use them; else default to today
    if start and end:
        try:
            time_min = clean_google_time(start)
            time_max = clean_google_time(end)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format for start or end")
    else:
        now = datetime.utcnow()
        time_min = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
        time_max = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat() + 'Z'
    events_result = service.events().list(
        calendarId="primary",
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
        maxResults=2500
    ).execute()
    events = events_result.get("items", [])
    return {"events": events}

@app.get("/logout")
def logout():
    response = HTMLResponse(content="<h2>Logged out successfully.</h2>")
    response.delete_cookie(key=COOKIE_NAME)
    return response

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
def create_task(task: TaskRequest, request: Request):
    creds = get_user_creds(request)
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