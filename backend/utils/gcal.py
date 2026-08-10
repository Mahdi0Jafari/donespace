import os
import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from backend.extensions import db

# The scopes required for Calendar and Profile
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

import logging

logger = logging.getLogger(__name__)

# Mapping UI colour hex strings to Google Calendar colour IDs
UI_COLOR_TO_GCAL = {
    "purple": "9",
    "yellow": "10",
    "orange": "11",
    "cyan": "7",
    "green": "5",
    "blue": "3"
}

def get_credentials(user):
    """Rebuilds credentials from the user object and refreshes if needed."""
    if not user.google_access_token:
        logger.warning(f"[GCal] Sync skipped for user {user.email}: No google_access_token found.")
        return None
        
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    
    # Check if we have credentials in env, if not it won't work
    if not client_id or not client_secret:
        logger.error("[GCal] Sync skipped: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment.")
        return None

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES
    )

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Update user in DB
            user.google_access_token = creds.token
            if creds.expiry:
                user.google_token_expiry = creds.expiry
            db.session.commit()
        except Exception as e:
            logger.error(f"[GCal] Failed to refresh Google credentials for {user.email}: {e}")
            return None

    return creds

def get_calendar_service(user):
    creds = get_credentials(user)
    if not creds:
        return None
    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"[GCal] Failed to build calendar service for {user.email}: {e}")
        return None

SHARED_CALENDAR_ID = None

def ensure_donespace_calendar(service):
    """Finds or creates a single shared 'DoneSpace' calendar for the whole app."""
    global SHARED_CALENDAR_ID
    if SHARED_CALENDAR_ID:
        return SHARED_CALENDAR_ID
    
    try:
        # Check existing calendars
        page_token = None
        while True:
            calendar_list = service.calendarList().list(pageToken=page_token).execute()
            for calendar_list_entry in calendar_list['items']:
                if calendar_list_entry['summary'] == 'DoneSpace':
                    SHARED_CALENDAR_ID = calendar_list_entry['id']
                    return SHARED_CALENDAR_ID
            page_token = calendar_list.get('nextPageToken')
            if not page_token:
                break
        
        # Not found, create it
        calendar = {
            'summary': 'DoneSpace',
            'timeZone': 'Asia/Tehran',
            'description': 'Tasks and Meals from DoneSpace.ir'
        }
        created_calendar = service.calendars().insert(body=calendar).execute()
        SHARED_CALENDAR_ID = created_calendar['id']
        return SHARED_CALENDAR_ID
    except Exception as e:
        logger.error(f"[GCal] Failed to ensure calendar: {e}")
        return 'primary'  # Fallback to primary

from zoneinfo import ZoneInfo

def parse_date_to_iso(date_str, time_str=None, all_day=True, tz_name='Asia/Tehran'):
    """Converts a local date (and optional time) to a Google‑Calendar‑compatible dict.
    Returns either {'date': 'YYYY‑MM‑DD'} for all‑day events or
    {'dateTime': 'YYYY‑MM‑DDTHH:MM:SS+TZ', 'timeZone': tz_name} for timed events.
    """
    if not date_str:
        date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    if all_day:
        # Include explicit timeZone for all‑day events so Google shows correct local date.
        return {'date': date_str, 'timeZone': tz_name}
    if not time_str:
        time_str = "09:00"
    # Build a timezone‑aware datetime and let isoformat include the offset (e.g. +03:30).
    tz = ZoneInfo(tz_name)
    dt = datetime.datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    dt = dt.replace(tzinfo=tz)
    iso_str = dt.isoformat()
    return {'dateTime': iso_str, 'timeZone': tz_name}


def _weekday_code(day_index):
    """Convert Python weekday (0=Monday … 6=Sunday) to iCal two‑letter code.
    Google Calendar uses SU, MO, TU, WE, TH, FR, SA.
    """
    mapping = {0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'}
    return mapping.get(day_index % 7, 'MO')


def _build_rrule(task):
    """Create an RRULE string list based on task.recurrence, interval and customDays.
    Returns a list (or empty) suitable for `event['recurrence']`.
    """
    if not task.recurrence or task.recurrence == 'none':
        return []
    rrule = []
    freq = task.recurrence.upper()
    base = f"RRULE:FREQ={freq};INTERVAL={task.interval or 1}"
    # Add BYDAY if customDays provided (values 0=Sunday … 6=Saturday)
    if getattr(task, 'customDays', None):
        # task.customDays may be a JSON string; parse if needed
        days = task.customDays
        if isinstance(days, str):
            try:
                import json
                days = json.loads(days)
            except Exception:
                days = []
        if isinstance(days, list):
            days_codes = [_weekday_code(d) for d in days]
            base += f";BYDAY={','.join(days_codes)}"
        else:
            # fallback: no BYDAY
            pass
    rrule.append(base)
    # End conditions
    if task.endType == 'date' and task.endDate:
        rrule[0] += f";UNTIL={task.endDate.replace('-', '')}T235959Z"
    elif task.endType == 'occurrences' and task.endOccurrences:
        rrule[0] += f";COUNT={task.endOccurrences}"
    return rrule

def sync_task_to_gcal(user, task):
    """Creates or updates a task as a Google Calendar Event.
    Returns the created/updated Google event ID (or None on failure).
    """
    service = get_calendar_service(user)
    if not service:
        logger.warning(f"[GCal] Aborting sync for task '{task.title}': No calendar service available.")
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    
    # Clean up icon (don't use Material Icon text like 'local_dining' as emoji)
    icon_prefix = ""
    if task.icon:
        # If it's short (like a real emoji), use it. Otherwise ignore.
        if len(task.icon) <= 4 and "_" not in task.icon:
            icon_prefix = f"{task.icon} "
            
    # Build event payload
    event = {
        'summary': f"{icon_prefix}{task.title}",
        'description': task.description or "DoneSpace Task",
        'extendedProperties': {
            'private': {
                'task_id': str(task.id),
                'type': 'task'
            }
        },
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'popup', 'minutes': 30},
            ],
        },
        'transparency': 'transparent' # "Available" so it doesn't block schedule
    }
    
    # Time/Date logic
    if task.allDay:
        # All day event needs start date and end date (end date is exclusive in GCal)
        start_date = parse_date_to_iso(task.startDate or datetime.datetime.now().strftime('%Y-%m-%d'), all_day=True)
        # Add 1 day for end date
        end_dt = datetime.datetime.strptime(start_date['date'], "%Y-%m-%d") + datetime.timedelta(days=1)
        end_date = {'date': end_dt.strftime("%Y-%m-%d")}
        event['start'] = start_date
        event['end'] = end_date
    else:
        start_time = parse_date_to_iso(task.startDate, task.time, all_day=False, tz_name='Asia/Tehran')
        event['start'] = start_time
        # Parse ISO datetime (which may include timezone offset) and add default duration of 1 hour
        start_dt = datetime.datetime.fromisoformat(start_time['dateTime'])
        end_dt = start_dt + datetime.timedelta(hours=1)
        event['end'] = {
            'dateTime': end_dt.isoformat(),
            'timeZone': start_time['timeZone']
        }
        
    # Recurrence logic (using customDays, interval, and end conditions)
    rrule = _build_rrule(task)
    if rrule:
        event['recurrence'] = rrule

    # Color handling – use task.color if set, otherwise default based on assignees_rel
    if getattr(task, "color", None):
        event['colorId'] = UI_COLOR_TO_GCAL.get(task.color, "7")
    else:
        # Default to purple if no color set, else fallback to assignees
        default_color = "purple"
        event['colorId'] = UI_COLOR_TO_GCAL.get(default_color, "9") if not getattr(task, "assignees_rel", None) else "9"
    logger.debug(f"[GCal] Event payload for task '{task.title}': {event}")

    try:
        if task.google_event_id:
            # Update existing
            updated_event = service.events().update(
                calendarId=calendar_id, 
                eventId=task.google_event_id, 
                body=event
            ).execute()
        else:
            # Create new
            created_event = service.events().insert(
                calendarId=calendar_id, 
                body=event
            ).execute()
            task.google_event_id = created_event['id']
            db.session.commit()
            logger.info(f"[GCal] Successfully created Google Calendar event for task: '{task.title}'")
        return True
    except Exception as e:
        logger.error(f"[GCal] Failed to sync task '{task.title}' to GCal: {e}")
        # If event was deleted in GCal, creating it might fail or we might get 404 on update
        if "404" in str(e):
            task.google_event_id = None
            db.session.commit()
        return False

def sync_meal_to_gcal(user, meal, recipe=None):
    """Creates or updates a meal as a Google Calendar Event."""
    service = get_calendar_service(user)
    if not service:
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    
    # Build description with context metadata
    desc = f"Meal: {meal.type.capitalize() if meal.type else 'Dinner'}\n"
    if meal.cook:
        desc += f"Cook: {meal.cook}\n"
    if recipe:
        desc += "\n--- Recipe Details ---\n"
        desc += f"Category: {recipe.category}\n"
        if recipe.time:
            desc += f"Time: {recipe.time}\n"
        if recipe.notes:
            desc += f"\nNotes:\n{recipe.notes}\n"
        
    event = {
        'summary': f"{meal.emoji or '🍽️'} {meal.title}",
        'description': desc,
        'extendedProperties': {
            'private': {
                'meal_id': str(meal.id),
                'type': 'meal'
            }
        },
        'colorId': "11", # Tomato red
        'transparency': 'transparent'
    }
    
    # Meals are usually all-day events on that date
    start_date = parse_date_to_iso(meal.date, all_day=True)
    end_dt = datetime.datetime.strptime(start_date['date'], "%Y-%m-%d") + datetime.timedelta(days=1)
    end_date = {'date': end_dt.strftime("%Y-%m-%d")}
    event['start'] = start_date
    event['end'] = end_date

    try:
        if meal.google_event_id:
            updated_event = service.events().update(
                calendarId=calendar_id, 
                eventId=meal.google_event_id, 
                body=event
            ).execute()
        else:
            created_event = service.events().insert(
                calendarId=calendar_id, 
                body=event
            ).execute()
            meal.google_event_id = created_event['id']
            db.session.commit()
        return True
    except Exception as e:
        print(f"Error syncing meal to GCal: {e}")
        if "404" in str(e):
            meal.google_event_id = None
            db.session.commit()
        return False

def delete_event(user, event_id):
    """Deletes an event from Google Calendar."""
    if not event_id:
        return True
        
    service = get_calendar_service(user)
    if not service:
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting event: {e}")
        return False
