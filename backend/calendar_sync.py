# calendar_sync.py

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from fastapi import HTTPException

def create_event(credentials_data: dict, summary: str, description: str, start_time: str, end_time: str):
    """ Create a new event in the user's Google Calendar """
    # Load the credentials
    creds = Credentials(
        token=credentials_data["token"],
        refresh_token=credentials_data["refresh_token"],
        token_uri=credentials_data["token_uri"],
        client_id=credentials_data["client_id"],
        client_secret=credentials_data["client_secret"],
        scopes=credentials_data["scopes"],
    )

    # Build Google Calendar API service
    service = build("calendar", "v3", credentials=creds)

    # Define event
    event = {
        "summary": summary,
        "description": description,
        "start": {
            "dateTime": start_time,
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "UTC",
        },
    }

    # Create event on Google Calendar
    try:
        created_event = service.events().insert(
            calendarId="primary", body=event
        ).execute()
        return {"status": "success", "event_id": created_event["id"], "event_summary": created_event["summary"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating event: {str(e)}")
